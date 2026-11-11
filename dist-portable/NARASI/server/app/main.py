"""NARASI backend — kontrak API sesuai PRD Bagian 9.3."""

import asyncio
import base64
import binascii
import logging
import re
import secrets
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterable
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse, ServerSentEvent
from fastapi.staticfiles import StaticFiles

from .cache import create_cache
from .config import get_settings
from .advisor import ACTIONS
from .corpus import Corpus
from .events import bus
from .evidence import EvidenceFinder
from .feeds import FactFeedIndex
from .models import (ActionRequest, AnalyzeRequest, AudioRequest, FeedbackRequest, FramesRequest, PrefetchRequest,
                     ReportRequest, ReportStatus, ReportUpdate, ScanRequest, ScanResponse)
from .notifier import Notifier
from .pipeline import DONE, Pipeline, Session
from .providers.factcheck import FactCheckAPI
from .providers.gemini import Gemini
from .providers.groq import GroqASR, GroqLLM
from .providers.llm import Budget, LLMRouter
from .providers.newsrss import NewsSearch
from .providers.tavily import TavilySearch
from .ratings import SEARCH_DOMAINS
from .reports import ReportStore
from .stats import Stats
from .usage import usage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx mencatat URL lengkap setiap permintaan; jangan sampai kunci API atau isi klaim masuk log.
for name in ("httpx", "httpx2"):
    logging.getLogger(name).setLevel(logging.WARNING)

MAX_FRAME_BYTES = 400_000
MAX_AUDIO_BYTES = 400_000
FRAME_MIMES = {"image/jpeg", "image/png", "image/webp"}
AUDIO_MIMES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/wav"}


def check_production(s) -> None:
    """Mode produksi menolak konfigurasi yang tidak aman alih-alih hanya memberi peringatan."""
    if s.environment != "production":
        return
    problems = []
    if len(s.dashboard_token) < 24:
        problems.append("DASHBOARD_TOKEN wajib diisi (minimal 24 karakter)")
    if s.testbed_fixtures:
        problems.append("TESTBED_FIXTURES harus false")
    if not s.viewer_salt:
        problems.append("VIEWER_SALT wajib diisi agar hitungan penonton konsisten antar-restart")
    if problems:
        raise RuntimeError("Konfigurasi produksi tidak lengkap: " + "; ".join(problems))
    if not s.redis_url:
        logging.getLogger("narasi").warning("REDIS_URL kosong: cache hilang saat restart dan kuota LLM terpakai ulang.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    check_production(s)
    client = httpx.AsyncClient(http2=False, timeout=10)
    cache = create_cache(s.redis_url)
    gemini = Gemini(client, s.gemini_api_key, s.gemini_model, s.gemini_embed_model,
                    s.gemini_thinking_budget, s.gemini_thinking_level, s.gemini_fallback_models,
                    s.gemini_rpm) if s.gemini_api_key else None
    asr = GroqASR(client, s.groq_api_key, s.groq_asr_model) if s.groq_api_key else None
    factcheck = FactCheckAPI(client, s.factcheck_api_key) if s.factcheck_api_key else None
    tavily = TavilySearch(client, s.tavily_api_key, SEARCH_DOMAINS) if s.tavily_api_key else None
    available = {
        "groq": GroqLLM(client, s.groq_api_key, s.groq_llm_model) if s.groq_api_key else None,
        "gemini": gemini,
    }
    chain = [available[name] for name in s.llm_order if available.get(name)]
    llm = LLMRouter(chain, gemini, cache, s.llm_cache_ttl_seconds,
                    Budget(s.llm_max_per_minute, s.llm_max_per_day)) if chain else None
    app.state.llm = llm
    feeds = FactFeedIndex(client, s.feeds_path) if s.fact_feeds else None
    news = NewsSearch(client) if s.news_search else None
    app.state.feeds = feeds
    finder = EvidenceFinder(Corpus(s.testbed_fixtures), cache, s.cache_ttl_seconds, s.evidence_timeout,
                            llm, factcheck, tavily, feeds, news)
    app.state.providers = {
        "gemini": bool(gemini), "groq": bool(asr), "factcheck": bool(factcheck), "tavily": bool(tavily),
        "feeds": feeds is not None, "news": news is not None,
        "llm": llm.names if llm else [], "cache": cache.name,
    }
    app.state.stats = Stats()
    if not s.dashboard_token:
        logging.getLogger("narasi").warning(
            "DASHBOARD_TOKEN kosong: laporan dan peringatan bisa dibaca siapa pun yang menjangkau server ini.")
    app.state.reports = ReportStore(s.reports_db_path, s.viewer_salt or secrets.token_hex(16),
                                    s.closed_report_retention_days)
    app.state.pipeline = Pipeline(s, cache, finder, app.state.stats, llm, asr, app.state.reports,
                                  Notifier(client, s.alert_webhook_url))
    app.state.rate = defaultdict(deque)
    app.state.background = set()
    app.state.summary_cache = {}
    flusher = asyncio.create_task(_flush_periodically(app.state.reports))
    # Indeks feed pemeriksa fakta disegarkan di latar; server tidak menunggu unduhan pertama.
    feeder = asyncio.create_task(feeds.run(max(5, s.feeds_refresh_minutes) * 60)) if feeds is not None else None
    yield
    flusher.cancel()
    if feeder:
        feeder.cancel()
    app.state.reports.close()
    await cache.close()
    await client.aclose()


async def _flush_periodically(store: ReportStore, every: float = 2.0) -> None:
    """Sinyal penonton ditulis berkelompok, bukan per permintaan (lihat reports.py)."""
    while True:
        await asyncio.sleep(every)
        try:
            await asyncio.to_thread(store.flush)
        except Exception:
            logging.getLogger("narasi").exception("flush laporan gagal")


SUMMARY_CACHE_SECONDS = 10.0


def _extension_origin_regex(extension_ids: list[str]) -> str:
    """Hanya extension NARASI resmi bila ID-nya diatur; tanpa itu, semua extension Chrome (mode pengembangan)."""
    ids = [i for i in extension_ids if re.fullmatch(r"[a-p]{32}", i)]
    return rf"chrome-extension://({'|'.join(ids)})" if ids else r"chrome-extension://[a-p]{32}"


app = FastAPI(title="NARASI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    # Service worker extension (berlaku juga untuk backend di luar host_permissions manifest).
    allow_origin_regex=_extension_origin_regex(get_settings().extension_ids),
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-Narasi-Install", "X-Dashboard-Token"],
)


def pipeline(request: Request) -> Pipeline:
    return request.app.state.pipeline


def _session(request: Request, session_id: str) -> Session:
    session = pipeline(request).get(session_id)
    if session is None:
        raise HTTPException(404, "Sesi tidak ditemukan atau sudah kedaluwarsa")
    return session


def _rate_limit(request: Request, install_id: str | None) -> None:
    """Batas per ID instalasi acak (bukan identitas pengguna)."""
    key = install_id or (request.client.host if request.client else "anon")
    window = request.app.state.rate[key]
    now = time.monotonic()
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= get_settings().rate_limit_per_minute:
        raise HTTPException(429, "Terlalu banyak permintaan, coba lagi sebentar")
    window.append(now)
    rate = request.app.state.rate
    if len(rate) > 20_000:  # buang ID instalasi yang sudah diam > 1 menit agar memori tidak terus tumbuh
        for k in [k for k, w in rate.items() if not w or w[-1] < now - 60]:
            rate.pop(k, None)


def _decode_data_url(value: str, allowed: set[str], max_bytes: int) -> tuple[str, bytes]:
    try:
        header, payload = value.split(",", 1)
        mime = header.removeprefix("data:").split(";")[0].lower()
        data = base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, "Data URL tidak valid")
    if mime not in allowed:
        raise HTTPException(415, f"Tipe {mime} tidak didukung")
    if len(data) > max_bytes:
        raise HTTPException(413, "Berkas terlalu besar")
    return mime, data


@app.get("/health")
async def health(request: Request) -> dict:
    providers = request.app.state.providers
    live = any(providers[k] for k in ("gemini", "groq", "factcheck", "tavily"))
    feeds = request.app.state.feeds
    return {"status": "ok", "mode": "live" if live else "local", "providers": providers,
            "feeds": feeds.snapshot() if feeds is not None else None}


@app.post("/v1/analyze")
async def analyze(body: AnalyzeRequest, request: Request,
                  x_narasi_install: str | None = Header(default=None)) -> dict:
    _rate_limit(request, x_narasi_install)
    session, cached = await pipeline(request).start(body, x_narasi_install)
    if cached is not None:
        return {"session_id": None, "cached": True, "result": cached.model_dump()}
    # Extension hanya merekam frame/audio bila backend benar-benar bisa memprosesnya.
    providers = request.app.state.providers
    accepts = {"frames": bool(providers["llm"]), "audio": providers["groq"]}
    return {"session_id": session.id, "cached": False, "result": None, "accepts": accepts}


@app.post("/v1/analyze/{session_id}/frames", status_code=202)
async def frames(session_id: str, body: FramesRequest, request: Request) -> dict:
    session = _session(request, session_id)
    if session.completing:
        raise HTTPException(409, "Sesi sudah ditutup")
    decoded = [_decode_data_url(f, FRAME_MIMES, MAX_FRAME_BYTES) for f in body.frames]
    pipeline(request).add_frames(session, decoded)
    return {"accepted": len(decoded)}


@app.post("/v1/analyze/{session_id}/audio", status_code=202)
async def audio(session_id: str, body: AudioRequest, request: Request) -> dict:
    session = _session(request, session_id)
    if session.completing:
        raise HTTPException(409, "Sesi sudah ditutup")
    mime, data = _decode_data_url(body.chunk, AUDIO_MIMES, MAX_AUDIO_BYTES)
    pipeline(request).add_audio(session, body.index, data, mime)
    return {"accepted": True}


@app.post("/v1/analyze/{session_id}/complete", status_code=202)
async def complete(session_id: str, request: Request) -> dict:
    pipeline(request).complete(_session(request, session_id))
    return {"completing": True}


@app.get("/v1/analyze/{session_id}/events", response_class=EventSourceResponse)
async def events(session_id: str, request: Request) -> AsyncIterable[ServerSentEvent]:
    session = _session(request, session_id)
    while True:
        try:
            item = await asyncio.wait_for(session.queue.get(), timeout=15)
        except TimeoutError:
            yield ServerSentEvent(comment="keep-alive")
            continue
        if item is DONE:
            return
        event, data = item
        yield ServerSentEvent(event=event, data=data)


@app.post("/v1/prefetch", status_code=202)
async def prefetch(body: PrefetchRequest, request: Request,
                   x_narasi_install: str | None = Header(default=None)) -> dict:
    _rate_limit(request, x_narasi_install)
    task = asyncio.create_task(pipeline(request).prefetch(body.platform, body.video_id, body.caption))
    request.app.state.background.add(task)
    task.add_done_callback(request.app.state.background.discard)
    return {"queued": True}


@app.post("/v1/scan")
async def scan(body: ScanRequest, request: Request,
               x_narasi_install: str | None = Header(default=None)) -> ScanResponse:
    # Satu batch (≤10 postingan) dihitung satu permintaan untuk rate limit.
    _rate_limit(request, x_narasi_install)
    return ScanResponse(results=await pipeline(request).scan(body.platform, body.items))


@app.post("/v1/feedback", status_code=202)
async def feedback(body: FeedbackRequest, request: Request,
                   x_narasi_install: str | None = Header(default=None)) -> dict:
    _rate_limit(request, x_narasi_install)
    request.app.state.stats.feedback(body.platform, body.video_id, body.claim_id, body.reason)
    return {"received": True}


def require_dashboard(x_dashboard_token: str | None = Header(default=None)) -> None:
    token = get_settings().dashboard_token
    if token and not secrets.compare_digest(x_dashboard_token or "", token):
        raise HTTPException(401, "Token dashboard tidak valid")


@app.get("/v1/usage", dependencies=[Depends(require_dashboard)])
async def usage_report(request: Request) -> dict:
    """Bukti hemat kuota: permintaan yang dikirim ke penyedia vs yang dihemat cache/singleflight."""
    llm = request.app.state.llm
    return {**usage.snapshot(), "budget": llm.budget.snapshot() if llm else None,
            "active_sessions": len(request.app.state.pipeline.sessions)}


@app.get("/v1/stats", dependencies=[Depends(require_dashboard)])
async def stats(request: Request, hours: int = 24) -> dict:
    return request.app.state.stats.summary(max(1, min(hours, 168)))


# ---------------------------------------------------------------- laporan TNI AD (FR18)

@app.post("/v1/reports", status_code=201)
async def create_report(body: ReportRequest, request: Request,
                        x_narasi_install: str | None = Header(default=None)) -> dict:
    _rate_limit(request, x_narasi_install)
    report = request.app.state.reports.add_report(
        platform=body.platform, video_id=body.video_id, url=body.url, reason=body.reason, note=body.note,
        install_id=x_narasi_install, client_result=body.result,
    )
    bus.publish("laporan", platform=body.platform, key=report["video_key"], reason=body.reason,
                label=report.get("label"))
    await pipeline(request).check_alert(report["video_key"], "Laporan pengguna", force=True)
    return {"id": report["id"], "status": report["status"]}


@app.get("/v1/reports", dependencies=[Depends(require_dashboard)])
async def list_reports(request: Request, status: ReportStatus | None = None) -> list[dict]:
    return request.app.state.reports.list_reports(status)


@app.patch("/v1/reports/{report_id}", dependencies=[Depends(require_dashboard)])
async def update_report(report_id: str, body: ReportUpdate, request: Request) -> dict:
    store = request.app.state.reports
    if not store.get_report(report_id):
        raise HTTPException(404, "Laporan tidak ditemukan")
    return store.update_report(report_id, body.status, body.note)


@app.get("/v1/summary", dependencies=[Depends(require_dashboard)])
async def summary(request: Request, hours: int = 24) -> dict:
    """Ringkasan Mode Satuan. Di-cache bersama: 1 atau 100 petugas membuka dashboard, query tetap sekali per 10 detik."""
    hours = max(1, min(hours, 168))
    cache = request.app.state.summary_cache
    hit = cache.get(hours)
    now = time.monotonic()
    if hit and now - hit[0] < SUMMARY_CACHE_SECONDS:
        return hit[1]
    data = await asyncio.to_thread(request.app.state.reports.summary, hours)
    data["stats"] = request.app.state.stats.summary(hours)
    data["generated_at"] = time.time()
    cache[hours] = (now, data)
    return data


@app.get("/v1/alerts", dependencies=[Depends(require_dashboard)])
async def alerts(request: Request, hours: int = 24) -> list[dict]:
    return request.app.state.reports.alerts(hours=max(1, min(hours, 168)))


# ---------------------------------------------------------------- realtime & aksi (dashboard)

@app.get("/v1/live", dependencies=[Depends(require_dashboard)])
async def live(request: Request) -> dict:
    """Potret awal untuk tampilan realtime: peristiwa terakhir, laju per menit, dan status sumber bukti."""
    feeds = request.app.state.feeds
    return {"events": bus.recent(120), **bus.snapshot(), "providers": request.app.state.providers,
            "feeds": feeds.snapshot() if feeds is not None else None,
            "active_sessions": sum(1 for s in request.app.state.pipeline.sessions.values() if s.finished_at is None),
            "usage": usage.snapshot()}


@app.get("/v1/stream", response_class=EventSourceResponse, dependencies=[Depends(require_dashboard)])
async def stream(request: Request) -> AsyncIterable[ServerSentEvent]:
    """Aliran peristiwa pipeline (masuk → klaim → bukti → vonis → laporan/aksi) untuk dashboard."""
    queue = bus.subscribe()
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
            except TimeoutError:
                yield ServerSentEvent(comment="keep-alive")
                continue
            yield ServerSentEvent(event=event["type"], data=event)
    finally:
        bus.unsubscribe(queue)


@app.post("/v1/actions", status_code=201, dependencies=[Depends(require_dashboard)])
async def record_action(body: ActionRequest, request: Request) -> dict:
    """Petugas mencatat aksi yang sudah dijalankan untuk satu narasi."""
    if body.action not in ACTIONS:
        raise HTTPException(422, "Aksi tidak dikenal")
    row = request.app.state.reports.add_action(body.narrative, body.action, body.note)
    request.app.state.summary_cache.clear()
    bus.publish("aksi", action=body.action, title=ACTIONS[body.action]["title"], narrative=body.narrative)
    return row


# Paket portabel: dashboard disajikan dari origin yang sama dengan API. Dipasang paling akhir agar /v1 dan /health
# tetap ditangani route di atas.
if get_settings().static_dir:
    app.mount("/", StaticFiles(directory=get_settings().static_dir, html=True, check_dir=False), name="dashboard")

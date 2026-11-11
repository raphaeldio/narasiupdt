"""Orkestrasi analisis bertahap: caption → teks di layar → audio → final (PRD Bagian 7.2)."""

import asyncio
import logging
import secrets
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from .cache import Cache, SingleFlight, memo
from .claims import MAX_CLAIMS, extract_claims, is_satire
from .conclusion import keep_cited, local_conclusion, order_evidence
from .config import Settings
from .events import bus
from .evidence import EvidenceFinder, merge_evidence
from .lang import LANGUAGE_NAMES, detect_language
from .models import AnalysisResult, AnalyzeRequest, Claim, Evidence, Modality, ScanItem, ScanResult, Stage
from .notifier import Notifier
from .providers.gemini import BudgetExhausted, Gemini
from .providers.groq import GroqASR
from .reports import ReportStore
from .scoring import Verdict, aggregate
from .signals import Risk, assess_risk
from .stats import Stats
from .text import claim_hash, lexical_similarity
from .tni import is_tni_related
from .topics import GENERAL, TOPICS, classify
from .usage import usage

log = logging.getLogger("narasi.pipeline")

MAX_SESSION_CLAIMS = 6
LEVEL_RANK = {"rendah": 0, "sedang": 1, "tinggi": 2}
SESSION_RETENTION = 120.0
ALERT_RECHECK_SECONDS = 60.0
DONE = object()


@dataclass
class Session:
    id: str
    req: AnalyzeRequest
    created: float = field(default_factory=time.monotonic)
    claims: dict[str, Claim] = field(default_factory=dict)
    evidence: dict[str, list[Evidence]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    transcript: dict[int, str] = field(default_factory=dict)
    ocr_text: str = ""
    # Ada modalitas (teks layar/audio) yang gagal atau dilewati: "tanpa klaim" tidak boleh diklaim.
    incomplete: bool = False
    # Penilaian AI untuk klaim tanpa rujukan (diisi sekali saat finalisasi).
    ai: dict | None = None
    # Klaim dari heuristik boleh diganti versi LLM yang lebih rapi (mis. kalimat terpotong di batas audio).
    heuristic_ids: set[str] = field(default_factory=set)
    # Klaim yang buktinya baru dari korpus lokal; sumber daring menyusul lewat _refresh.
    quick_ids: set[str] = field(default_factory=set)
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    tasks: set[asyncio.Task] = field(default_factory=set)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    deadline: asyncio.Task | None = None
    timed_out: bool = False
    completing: bool = False
    finished_at: float | None = None

    @property
    def caption_text(self) -> str:
        tags = " ".join(f"#{t.lstrip('#')}" for t in self.req.hashtags)
        return f"{self.req.caption} {tags}".strip()

    @property
    def all_text(self) -> str:
        """Semua teks yang sudah terbaca dari video: caption, teks layar, dan transkrip audio."""
        spoken = " ".join(self.transcript[i] for i in sorted(self.transcript))
        return " ".join(t for t in (self.caption_text, self.ocr_text, spoken) if t).strip()

    @property
    def key(self) -> str:
        return f"{self.req.platform}:{self.req.video_id}"

    def note(self, text: str) -> None:
        if text not in self.notes:
            self.notes.append(text)

    def emit(self, event: str, data: Any) -> None:
        self.queue.put_nowait((event, data))


def result_key(platform: str, video_id: str) -> str:
    return f"res:{platform}:{video_id}"


def judge(claims: list[Claim], evidence: list[Evidence], text: str,
          ai: dict | None = None) -> tuple[Verdict, Risk]:
    """Vonis gabungan: bukti dulu, lalu pola bahasa, lalu penilaian AI."""
    risk = assess_risk(text)
    verdict = aggregate(claims, evidence, risk, ai)
    # "Tidak ada klaim" hanya sah bila memang ada teks yang dibaca; konten tanpa teks tetap belum terverifikasi.
    if verdict.label == "neutral" and not text.strip():
        verdict.label = "unverified"
    return verdict, risk


def topics_of(claims: list[Claim], text: str) -> list[str]:
    ranked = [t for t, _ in Counter(c.topic for c in claims if c.topic != GENERAL).most_common(2)]
    return ranked or classify(text)


def language_of(claims: list[Claim], text: str) -> str:
    langs = Counter(c.language for c in claims)
    return langs.most_common(1)[0][0] if langs else detect_language(text)


def origin_counts(evidence: list[Evidence]) -> dict[str, int]:
    return dict(Counter(e.origin for e in evidence))


class Pipeline:
    def __init__(self, settings: Settings, cache: Cache, finder: EvidenceFinder, stats: Stats,
                 gemini: Gemini | None, asr: GroqASR | None, reports: ReportStore, notifier: Notifier):
        self.settings = settings
        self.reports = reports
        self.notifier = notifier
        self.cache = cache
        self.finder = finder
        self.stats = stats
        self.gemini = gemini
        self.asr = asr
        self.sessions: dict[str, Session] = {}
        self._prefetch_slots = asyncio.Semaphore(4)
        self._asr_flight = SingleFlight()
        self._alert_checked: dict[str, tuple[float, int]] = {}

    # ------------------------------------------------------------------ siklus sesi

    async def start(self, req: AnalyzeRequest,
                    install_id: str | None = None) -> tuple[Session | None, AnalysisResult | None]:
        self._evict()
        # Sinyal peringatan dini: penonton unik per video (hash ID instalasi, tanpa identitas).
        self.reports.record_view(req.platform, req.video_id, req.url, install_id)
        cached = await self.cache.get(result_key(req.platform, req.video_id))
        key = f"{req.platform}:{req.video_id}"
        bus.publish("masuk", platform=req.platform, key=key, cached=cached is not None)
        if cached is not None:
            result = AnalysisResult(**cached)
            result.cached = True
            self.stats.record(result, cache_hit=True)
            self._publish_verdict(result)
            await self.check_alert(f"{req.platform}:{req.video_id}", "Penyebaran terdeteksi")
            return None, result

        session = Session(id=secrets.token_urlsafe(12), req=req)
        self.sessions[session.id] = session
        self._spawn(session, self._run_caption(session))
        session.deadline = asyncio.create_task(self._deadline(session))
        if req.mode == "caption":
            session.note("Mode caption saja: teks di layar dan audio tidak dianalisis.")
            self.complete(session)
        return session, None

    def get(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)

    def add_frames(self, session: Session, frames: list[tuple[str, bytes]]) -> None:
        self._spawn(session, self._run_ocr(session, frames))

    def add_audio(self, session: Session, index: int, audio: bytes, mime: str) -> None:
        self._spawn(session, self._run_asr(session, index, audio, mime))

    def complete(self, session: Session) -> None:
        if session.completing:
            return
        session.completing = True
        asyncio.create_task(self._finalize(session))

    async def prefetch(self, platform: str, video_id: str, caption: str) -> None:
        """Siapkan cache klaim untuk video berikutnya (PRD 9.4) tanpa membuat sesi."""
        if not caption.strip() or await self.cache.get(result_key(platform, video_id)) is not None:
            return
        async with self._prefetch_slots:
            claims = extract_claims(caption, "caption")  # tanpa LLM: prefetch tidak boleh menghabiskan kuota
            await asyncio.gather(*(self.finder.find(c) for c in claims if c.kind == "factual"),
                                 return_exceptions=True)

    async def scan(self, platform: str, items: list[ScanItem]) -> list[ScanResult]:
        """Label cepat postingan feed: cache hasil penuh atau heuristik + korpus. Tanpa LLM, sesi, dan sinyal penonton."""
        async def one(item: ScanItem) -> ScanResult:
            try:
                cached = await self.cache.get(result_key(platform, item.id))
                if cached is not None:
                    full = AnalysisResult(**cached)
                    return ScanResult(id=item.id, label=full.label, score=full.score, tni_related=full.tni_related,
                                      claims=len(full.claims), cached=True)
                tags = " ".join(f"#{t.lstrip('#')}" for t in item.hashtags)
                text = f"{item.text} {tags}".strip()
                claims = extract_claims(item.text, "caption", item.hashtags)[:MAX_SESSION_CLAIMS]
                factual = [c for c in claims if c.kind == "factual"]
                async with self._prefetch_slots:
                    found = await asyncio.gather(*(self.finder.quick(c) for c in factual))
                verdict, risk = judge(claims, [e for ev in found for e in ev], text)
                return ScanResult(id=item.id, label=verdict.label, score=verdict.score,
                                  tni_related=any(c.tni_related for c in claims),
                                  claims=len(factual), cached=False, basis=verdict.basis,
                                  topic=topics_of(claims, text)[0], language=language_of(claims, text),
                                  risk=risk.score)
            except Exception:
                log.exception("scan gagal untuk %s:%s", platform, item.id)
                return ScanResult(id=item.id, label="error", score=None, tni_related=False, claims=0, cached=False)

        results = list(await asyncio.gather(*(one(i) for i in items)))
        bus.publish("pindai", platform=platform, count=len(results),
                    labels=dict(Counter(r.label for r in results)),
                    topics=dict(Counter(r.topic for r in results)))
        return results

    def _publish_verdict(self, result: AnalysisResult) -> None:
        claim = next((c.text for c in result.claims if c.kind == "factual"), None)
        bus.publish("vonis", platform=result.platform, key=f"{result.platform}:{result.video_id}",
                    label=result.label, score=result.score, basis=result.basis, topics=result.topics,
                    language=result.language, tni=result.tni_related, cached=result.cached,
                    claim=claim[:140] if claim else None, origins=origin_counts(result.evidence),
                    risk=(result.risk or {}).get("score", 0))

    async def check_alert(self, video_key: str, reason: str, force: bool = False) -> dict | None:
        """Kirim webhook sekali per level per video; laporan pengguna (force) selalu dikirim."""
        if not self.notifier.enabled:
            return None
        if not force:
            # Video viral dibuka ratusan penonton per menit, padahal sinyal penonton baru ditulis tiap ±2 dtk:
            # level peringatan hanya dihitung ulang bila datanya berubah (atau setelah 1 menit, jendela waktu bergeser).
            now, version = time.monotonic(), self.reports.version
            last = self._alert_checked.get(video_key)
            if last and last[1] == version and now - last[0] < ALERT_RECHECK_SECONDS:
                return None
            if len(self._alert_checked) > 50_000:
                self._alert_checked.clear()
            self._alert_checked[video_key] = (now, version)
        alert = self.reports.alert_for(video_key)
        if not alert:
            return alert
        min_rank = LEVEL_RANK.get(self.settings.alert_min_level, 2)
        tag = f"laporan-{alert['reports']}" if force else alert["level"]
        if (force or LEVEL_RANK[alert["level"]] >= min_rank) and self.reports.mark_notified(video_key, tag):
            await self.notifier.send(alert, reason)
        return alert

    def _spawn(self, session: Session, coro) -> None:
        task = asyncio.create_task(coro)
        session.tasks.add(task)
        task.add_done_callback(session.tasks.discard)

    def _evict(self) -> None:
        now = time.monotonic()
        for sid, s in list(self.sessions.items()):
            age_limit = s.finished_at + SESSION_RETENTION if s.finished_at else s.created + 300
            if now > age_limit:
                self.sessions.pop(sid, None)

    async def _deadline(self, session: Session) -> None:
        await asyncio.sleep(self.settings.session_deadline)
        if not session.completing:
            session.timed_out = True
            session.note("Batas waktu analisis tercapai; hasil memakai data yang sudah terkumpul.")
            self.complete(session)

    # ------------------------------------------------------------------ tahap

    async def _run_caption(self, session: Session) -> None:
        session.emit("stage", {"stage": "caption", "status": "started"})
        bus.publish("tahap", stage="caption", platform=session.req.platform, key=session.key)
        text, hashtags = session.caption_text, session.req.hashtags
        # 1. Label awal dalam milidetik: klaim heuristik dicocokkan ke cache kolektif dan korpus terkurasi.
        await self._ingest(session, extract_claims(text, "caption", hashtags), quick=True, heuristic=True)
        if session.claims:
            await self._emit_result(session, "caption")
        # 2. Sumber daring (Fact Check, Tavily, embedding) untuk klaim yang sama.
        await self._refresh(session)
        # 3. LLM hanya bila heuristik belum menghasilkan vonis berbasis bukti (hemat kuota per menit).
        if self.gemini and not self._has_verdict(session):
            await self._ingest(session, await self._extract_llm(text, "caption", hashtags), replace_heuristic=True)
        session.emit("stage", {"stage": "caption", "status": "done"})
        await self._emit_result(session, "caption")

    async def _run_ocr(self, session: Session, frames: list[tuple[str, bytes]]) -> None:
        if not self.gemini:
            session.note("Teks di layar (OCR) belum dianalisis: LLM vision (Groq/Gemini) belum dikonfigurasi di backend.")
            session.incomplete = True
            session.emit("stage", {"stage": "ocr", "status": "skipped"})
            return
        session.emit("stage", {"stage": "ocr", "status": "started"})
        bus.publish("tahap", stage="ocr", platform=session.req.platform, key=session.key)
        try:
            data = await asyncio.wait_for(
                # Satu OCR per video untuk semua penonton (frame tiap penonton hampir sama).
                self.gemini.ocr_and_claims(frames, session.req.caption, self.settings.ocr_timeout,
                                           key=f"{session.req.platform}:{session.req.video_id}"),
                self.settings.ocr_timeout,
            )
        except BudgetExhausted:
            session.note("Teks di layar dilewati: kuota LLM sedang penuh.")
            session.incomplete = True
            session.emit("stage", {"stage": "ocr", "status": "skipped"})
            return
        except Exception as exc:
            log.warning("OCR gagal: %r", exc)
            session.note("Teks di layar gagal dianalisis (batas waktu atau galat layanan).")
            session.incomplete = True
            session.emit("stage", {"stage": "ocr", "status": "failed"})
            return
        finally:
            frames.clear()  # retensi 0: frame tidak disimpan
        session.ocr_text = str(data.get("ocr_text") or "")[:4000]
        claims = self._claims_from_llm(data.get("claims", []), "ocr")
        if not claims and data.get("ocr_text"):
            claims = extract_claims(str(data["ocr_text"]), "ocr")
        await self._ingest(session, claims)
        session.emit("stage", {"stage": "ocr", "status": "done"})
        await self._emit_result(session, "ocr")

    async def _run_asr(self, session: Session, index: int, audio: bytes, mime: str) -> None:
        if not self.asr:
            session.note("Audio belum dianalisis: ASR (Groq) belum dikonfigurasi di backend.")
            session.incomplete = True
            session.emit("stage", {"stage": "audio", "status": "skipped"})
            return
        session.emit("stage", {"stage": "audio", "status": "started", "chunk": index})
        if index == 0:
            bus.publish("tahap", stage="audio", platform=session.req.platform, key=session.key)
        try:
            # Potongan audio ke-n video yang sama ditranskripsi sekali untuk semua penonton.
            key = f"asr:{session.req.platform}:{session.req.video_id}:{index}"
            text, source = await asyncio.wait_for(
                memo(self.cache, self._asr_flight, key, self.settings.llm_cache_ttl_seconds,
                     lambda: self.asr.transcribe(audio, mime, self.settings.asr_timeout)),
                self.settings.asr_timeout,
            )
            usage.record("asr", source)
        except Exception as exc:
            log.warning("ASR gagal: %s", exc)
            session.note("Sebagian audio gagal ditranskripsi.")
            session.incomplete = True
            session.emit("stage", {"stage": "audio", "status": "failed", "chunk": index})
            return
        session.transcript[index] = text
        # Per potongan cukup heuristik; LLM dipanggil sekali untuk seluruh transkrip saat finalisasi
        # (hemat kuota per menit: satu video tidak memakan satu panggilan LLM per 5 detik audio).
        await self._ingest(session, extract_claims(self._transcript(session), "audio"), heuristic=True)
        session.emit("stage", {"stage": "audio", "status": "done", "chunk": index})
        await self._emit_result(session, "audio")

    @staticmethod
    def _transcript(session: Session) -> str:
        return " ".join(session.transcript[i] for i in sorted(session.transcript))

    async def _finalize(self, session: Session) -> None:
        while pending := [t for t in session.tasks if not t.done()]:
            await asyncio.wait(pending)
        if session.deadline and session.deadline is not asyncio.current_task():
            session.deadline.cancel()
        if self.gemini and session.transcript:
            claims = await self._extract_llm(self._transcript(session), "audio", [])
            await self._ingest(session, claims, replace_heuristic=True)
        await self._assess_ai(session)
        try:
            result = await self._emit_result(session, "final", final=True)
            self._publish_verdict(result)
            # Sesi yang habis waktu (mis. pengguna menggulir lewat sebelum frame/audio terkirim) tidak boleh
            # mengunci hasil tak lengkap di cache kolektif untuk penonton berikutnya.
            if not session.timed_out:
                await self.cache.set(result_key(result.platform, result.video_id), result.model_dump(),
                                     self.settings.cache_ttl_seconds)
            self.stats.record(result, cache_hit=False)
            self.reports.record_result(result)
            if result.label in ("hoax", "caution"):
                alert = self.reports.alert_for(session.key)
                if alert:
                    bus.publish("peringatan", platform=result.platform, key=session.key, level=alert["level"],
                                label=result.label, rising=alert["rising"], tni=result.tni_related,
                                topic=(result.topics or ["umum"])[0])
            await self.check_alert(f"{result.platform}:{result.video_id}", "Deteksi otomatis")
        except Exception as exc:
            log.exception("finalisasi gagal")
            session.emit("error", {"message": str(exc)})
        session.finished_at = time.monotonic()
        session.emit("done", {})
        session.queue.put_nowait(DONE)

    async def _assess_ai(self, session: Session) -> None:
        """Belum ada bukti dan pola bahasanya tidak mencurigakan: minta penilaian awal AI (satu panggilan, di-cache)."""
        if not self.gemini or not hasattr(self.gemini, "assess"):
            return
        claims = list(session.claims.values())
        evidence = [e for ev in session.evidence.values() for e in ev]
        verdict, _ = judge(claims, evidence, session.all_text)
        factual = [c.original or c.text for c in claims if c.kind == "factual"]
        if verdict.label != "unverified" or not factual:
            return
        try:
            raw = await asyncio.wait_for(self.gemini.assess(factual, self.settings.llm_timeout),
                                         self.settings.llm_timeout)
        except Exception as exc:
            log.warning("penilaian AI gagal: %s", exc)
            return
        if isinstance(raw, dict) and raw.get("verdict") in ("likely_false", "misleading", "likely_true", "unknown"):
            try:
                confidence = max(0.0, min(1.0, float(raw.get("confidence") or 0)))
            except (TypeError, ValueError):
                confidence = 0.0
            session.ai = {"verdict": raw["verdict"], "confidence": round(confidence, 2),
                          "reason": str(raw.get("reason") or "").strip()[:300]}

    # ------------------------------------------------------------------ klaim dan bukti

    async def _extract(self, text: str, source: Modality, hashtags: list[str]) -> list[Claim]:
        """Klaim dari LLM bila tersedia dan berhasil; heuristik bila tidak."""
        return await self._extract_llm(text, source, hashtags) or extract_claims(text, source, hashtags)

    async def _extract_llm(self, text: str, source: Modality, hashtags: list[str]) -> list[Claim]:
        if not self.gemini or not text.strip():
            return []
        try:
            raw = await asyncio.wait_for(
                self.gemini.extract_claims(text, source, self.settings.llm_timeout), self.settings.llm_timeout
            )
        except Exception as exc:
            log.warning("ekstraksi klaim LLM gagal, memakai heuristik: %s", exc)
            return []
        claims = self._claims_from_llm(raw, source)
        if is_satire(text, hashtags):
            for c in claims:
                if c.kind == "factual":
                    c.kind = "satire"
        return claims

    @staticmethod
    def _claims_from_llm(raw: list[dict[str, Any]], source: Modality) -> list[Claim]:
        claims = []
        for item in raw:
            text = str(item.get("text", "")).strip()
            if len(text) < 10:
                continue
            kind = item.get("kind") if item.get("kind") in ("factual", "opinion", "satire") else "factual"
            original = str(item.get("original") or "").strip()[:300] or None
            language = str(item.get("language") or "").strip().lower()[:5]
            if language not in LANGUAGE_NAMES:
                language = detect_language(original or text)
            topic = str(item.get("topic") or "").strip().lower()
            claims.append(Claim(
                id=claim_hash(text), text=text[:300], source=source, kind=kind,
                tni_related=bool(item.get("tni_related")) or is_tni_related(text),
                topic=topic if topic in TOPICS else classify(f"{text} {original or ''}", 1)[0],
                language=language, original=original if language != "id" else None,
                queries=_clean_queries(item.get("queries"), text),
            ))
        claims.sort(key=lambda c: (c.kind != "factual", not c.tni_related))
        return claims[:MAX_CLAIMS]

    async def _ingest(self, session: Session, claims: list[Claim], *, quick: bool = False,
                      heuristic: bool = False, replace_heuristic: bool = False) -> None:
        async with session.lock:
            fresh: list[Claim] = []
            requery: list[Claim] = []
            for c in claims:
                if c.id in session.claims:
                    self._adopt_queries(session.claims[c.id], c, requery)
                    continue
                # LLM menulis ulang klaim yang sama dengan kata lain; yang mirip klaim lama tidak dihitung dua kali,
                # kecuali klaim lama hasil heuristik dari sumber yang sama: versi LLM menggantikannya.
                similar = next((k for k in [*session.claims.values(), *fresh]
                                if lexical_similarity(c.text, k.text) >= 0.6), None)
                if similar is not None:
                    if not (replace_heuristic and similar.id in session.heuristic_ids and similar.source == c.source):
                        self._adopt_queries(similar, c, requery)
                        continue
                    session.claims.pop(similar.id, None)
                    session.evidence.pop(similar.id, None)
                    session.heuristic_ids.discard(similar.id)
                    session.quick_ids.discard(similar.id)
                fresh.append(c)
            fresh = fresh[: max(0, MAX_SESSION_CLAIMS - len(session.claims))]
            for c in fresh:
                session.claims[c.id] = c
                if heuristic:
                    session.heuristic_ids.add(c.id)
        if fresh:
            bus.publish("klaim", platform=session.req.platform, key=session.key, count=len(fresh),
                        topics=sorted({c.topic for c in fresh}), tni=any(c.tni_related for c in fresh),
                        language=fresh[0].language)
        await self._check(session, [c for c in fresh if c.kind == "factual"], quick=quick)
        if not quick:
            await self._requery(session, [c for c in requery if c.kind == "factual"])

    @staticmethod
    def _adopt_queries(existing: Claim, new: Claim, requery: list[Claim]) -> None:
        """Klaim yang sudah ada (mis. dari heuristik) memakai kata kunci pencarian rumusan LLM."""
        if new.queries and not existing.queries:
            existing.queries = new.queries
            requery.append(existing)

    async def _requery(self, session: Session, claims: list[Claim]) -> None:
        """Cari ulang di Fact Check dengan kata kunci LLM; hasil kalimat klaim utuh sudah ada di sesi."""
        results = await asyncio.gather(*(self.finder.find_by_queries(c) for c in claims), return_exceptions=True)
        for claim, found in zip(claims, results):
            if isinstance(found, BaseException):
                log.warning("pencarian kata kunci gagal: %s", found)
                continue
            if claim.id in session.claims and found:
                session.evidence[claim.id] = merge_evidence(session.evidence.get(claim.id, []), found)

    async def _refresh(self, session: Session) -> None:
        """Ganti bukti korpus-saja (label awal) dengan hasil pencarian daring lengkap."""
        claims = [session.claims[i] for i in list(session.quick_ids) if i in session.claims]
        session.quick_ids.clear()
        await self._check(session, claims)

    async def _check(self, session: Session, claims: list[Claim], quick: bool = False) -> None:
        lookup = self.finder.quick if quick else self.finder.find
        results = await asyncio.gather(*(lookup(c) for c in claims), return_exceptions=True)
        for claim, found in zip(claims, results):
            if isinstance(found, BaseException):
                log.warning("pencarian bukti gagal: %s", found)
                session.note("Sebagian sumber bukti tidak dapat dihubungi.")
                found = []
            if claim.id in session.claims:
                session.evidence[claim.id] = found
                if quick:
                    session.quick_ids.add(claim.id)
        if claims and not quick:
            found_all = [e for c in claims for e in session.evidence.get(c.id, [])]
            bus.publish("bukti", platform=session.req.platform, key=session.key, claims=len(claims),
                        origins=origin_counts(found_all))

    @staticmethod
    def _has_verdict(session: Session) -> bool:
        evidence = [e for ev in session.evidence.values() for e in ev]
        return aggregate(list(session.claims.values()), evidence).top_claim_id is not None

    async def _emit_result(self, session: Session, stage: Stage, final: bool = False) -> AnalysisResult:
        async with session.lock:
            claims = list(session.claims.values())
            evidence = [e for ev in session.evidence.values() for e in ev]
        text = session.all_text
        verdict, risk = judge(claims, evidence, text, session.ai)
        if verdict.label == "neutral" and session.incomplete:
            verdict.label = "unverified"  # isi video belum terbaca semua, jadi belum bisa disebut tanpa klaim
        ordered = order_evidence(evidence, verdict.top_claim_id)[:6]

        conclusion = local_conclusion(verdict, claims, ordered, risk, session.ai)
        if final and self.gemini and ordered and verdict.top_claim_id:
            conclusion = await self._llm_conclusion(claims, ordered, verdict.label, verdict.score) or conclusion

        result = AnalysisResult(
            platform=session.req.platform, video_id=session.req.video_id, stage=stage, final=final,
            score=verdict.score, label=verdict.label, confidence=verdict.confidence,
            tni_related=any(c.tni_related for c in claims), claims=claims, evidence=ordered,
            conclusion=conclusion, notes=list(session.notes), basis=verdict.basis,
            topics=topics_of(claims, text), language=language_of(claims, text), risk=risk.as_dict(),
            ai=session.ai,
        )
        session.emit("result", result.model_dump())
        return result

    async def _llm_conclusion(self, claims: list[Claim], evidence: list[Evidence], label: str,
                              score: int | None) -> str | None:
        assert self.gemini
        payload = [{"publisher": e.publisher, "title": e.title, "rating": e.rating, "date": e.date,
                    "claim_reviewed": e.claim_reviewed or e.title} for e in evidence]
        try:
            text = await asyncio.wait_for(
                self.gemini.conclusion([c.text for c in claims if c.kind == "factual"], payload, label, score,
                                       self.settings.llm_timeout),
                self.settings.llm_timeout,
            )
        except Exception as exc:
            log.warning("kesimpulan LLM gagal: %s", exc)
            return None
        return keep_cited(text, len(evidence)) or None


MAX_QUERIES = 3


def _clean_queries(raw: Any, claim_text: str) -> list[str]:
    """Query pencarian dari LLM: unik, pendek, dan bukan salinan kalimat klaim."""
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for q in raw:
        q = " ".join(str(q).split())[:100]
        if len(q) >= 3 and q.lower() != claim_text.lower() and q.lower() not in (o.lower() for o in out):
            out.append(q)
    return out[:MAX_QUERIES]

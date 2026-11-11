"""Uji beban satu satuan: banyak prajurit membuka video viral yang sama secara serentak.

Server NARASI asli dijalankan (uvicorn, HTTP + SSE sungguhan) dengan penyedia LLM/ASR tiruan
yang meniru latensi Groq dan MENGHITUNG setiap permintaan, jadi uji ini tidak memakai kuota.

    uv run --env-file local.env python scripts/load_test.py --users 300 --videos 25

Yang diukur per pengguna: waktu sampai label pertama (SSE "result" pertama) dan sampai hasil final.
Yang dibandingkan: permintaan LLM yang benar-benar dikirim vs bila tiap pengguna memanggil sendiri.
"""

import argparse
import asyncio
import base64
import contextlib
import json
import os
import random
import shutil
import socket
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

import httpx  # noqa: E402
import uvicorn  # noqa: E402

PLACES = ["Aceh", "Papua", "Poso", "Ambon", "Natuna", "Sorong", "Merauke", "Bireuen", "Timika", "Nduga",
          "Sampang", "Kupang", "Atambua", "Wamena", "Jayapura", "Ternate", "Tual", "Nabire", "Biak", "Fakfak",
          "Sabang", "Lhokseumawe", "Langsa", "Meulaboh", "Sigli", "Takengon", "Kendari", "Palu", "Luwuk", "Tolitoli"]
TINY_JPEG = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0" + bytes(200) + b"\xff\xd9").decode()
TINY_WEBM = "data:audio/webm;base64," + base64.b64encode(b"\x1a\x45\xdf\xa3" + bytes(400)).decode()


class FakeLLM:
    """Meniru Groq: ±0,8 dtk per permintaan teks, ±1,5 dtk untuk OCR."""

    name = "simulasi"

    def __init__(self):
        self.calls: dict[str, int] = {}

    async def _hit(self, kind: str, delay: float):
        self.calls[kind] = self.calls.get(kind, 0) + 1
        await asyncio.sleep(delay * random.uniform(0.8, 1.2))

    async def extract_claims(self, text, source, timeout, priority="low"):
        await self._hit("claims", 0.8)
        return [{"text": " ".join(text.split()[:18]), "kind": "factual", "tni_related": True,
                 "queries": ["TNI serang"]}]

    async def ocr_and_claims(self, frames, caption, timeout):
        await self._hit("ocr", 1.5)
        return {"ocr_text": "TNI SIAGA PERANG", "claims": [{"text": "TNI siaga perang di perbatasan", "kind": "factual"}]}

    async def classify_stance(self, claim, items, timeout):
        await self._hit("stance", 0.6)
        return []

    async def conclusion(self, claims, evidence, label, score, timeout):
        await self._hit("conclusion", 0.8)
        return ""


class FakeASR:
    def __init__(self):
        self.calls = 0

    async def transcribe(self, audio, mime, timeout):
        self.calls += 1
        await asyncio.sleep(0.5)
        return "warga diminta mengungsi karena TNI akan menggelar operasi besar"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    values = sorted(values)
    return values[min(len(values) - 1, int(round(p / 100 * (len(values) - 1))))]


async def one_user(client: httpx.AsyncClient, uid: int, video: int, multimodal: bool, out: dict) -> None:
    place = PLACES[video % len(PLACES)]
    body = {"platform": "tiktok", "video_id": f"beban-{out['run']}-{video}", "url": f"https://tiktok.com/v/{video}",
            "caption": f"Viral! Beredar kabar TNI akan menyerang {place} pada 1 Desember, warga diminta segera "
                       f"mengungsi sebelum operasi dimulai",
            "hashtags": ["tni", place.lower()], "mode": "multimodal" if multimodal else "caption"}
    t0 = time.perf_counter()
    try:
        r = await client.post("/v1/analyze", json=body, headers={"X-Narasi-Install": f"prajurit-{uid}"})
        r.raise_for_status()
        data = r.json()
        if data["cached"]:
            dt = time.perf_counter() - t0
            out["first"].append(dt)
            out["final"].append(dt)
            out["cached"] += 1
            out["cache_lat"].append(dt)
            return
        sid = data["session_id"]
        if multimodal:
            await client.post(f"/v1/analyze/{sid}/frames", json={"frames": [TINY_JPEG]})
            await client.post(f"/v1/analyze/{sid}/audio", json={"index": 0, "chunk": TINY_WEBM})
            await client.post(f"/v1/analyze/{sid}/complete")
        first = None
        async with client.stream("GET", f"/v1/analyze/{sid}/events") as resp:
            event = None
            async for line in resp.aiter_lines():
                if line.startswith("event:"):
                    event = line.split(":", 1)[1].strip()
                elif line.startswith("data:") and event == "result":
                    payload = json.loads(line.split(":", 1)[1])
                    if first is None:
                        first = time.perf_counter() - t0
                    if payload.get("final"):
                        out["labels"][payload["label"]] = out["labels"].get(payload["label"], 0) + 1
                elif line.startswith("data:") and event == "done":
                    break
        out["first"].append(first if first is not None else time.perf_counter() - t0)
        out["final"].append(time.perf_counter() - t0)
        out["sessions"] += 1
        out["session_modes"].append(multimodal)
        out["session_first"].append(out["first"][-1])
    except Exception as exc:
        out["errors"].append(f"{type(exc).__name__}: {exc}")


async def wave(base: str, users: int, videos: int, run: str, multimodal_share: float, spread: float) -> dict:
    out = {"run": run, "first": [], "final": [], "cached": 0, "sessions": 0, "errors": [], "labels": {}, "session_modes": [],
           "cache_lat": [], "session_first": [], "probe": []}
    rnd = random.Random(7)
    # Distribusi viral: sebagian kecil video ditonton sebagian besar prajurit.
    weights = [1 / (i + 1) for i in range(videos)]
    plan = [(u, rnd.choices(range(videos), weights)[0], rnd.random() < multimodal_share,
             rnd.uniform(0, spread)) for u in range(users)]
    # Satu klien per prajurit (seperti browser masing-masing); satu pool bersama untuk ratusan aliran SSE
    # membuat klien uji sendiri yang menjadi hambatan, bukan server.
    async with contextlib.AsyncExitStack() as stack:
        clients = [await stack.enter_async_context(httpx.AsyncClient(base_url=base, timeout=40)) for _ in plan]

        async def delayed(u, v, m, d):
            await asyncio.sleep(d)
            await one_user(clients[u], u, v, m, out)

        async def probe():
            # Klien terpisah (koneksi sendiri): latensi /health selama beban = respons server untuk pengguna lain.
            async with httpx.AsyncClient(base_url=base, timeout=10) as pc:
                while not stop.is_set():
                    t1 = time.perf_counter()
                    await pc.get("/health")
                    out["probe"].append(time.perf_counter() - t1)
                    await asyncio.sleep(0.05)

        stop = asyncio.Event()
        prober = asyncio.create_task(probe())
        t = time.perf_counter()
        await asyncio.gather(*(delayed(*p) for p in plan))
        out["wall"] = time.perf_counter() - t
        stop.set()
        await prober
    out["distinct_videos"] = len({p[1] for p in plan})
    out["multimodal"] = sum(p[2] for p in plan)
    out["modes"] = [p[2] for p in plan]
    return out


def summarize(name: str, w: dict) -> dict:
    row = {
        "gelombang": name, "pengguna": len(w["first"]) + len(w["errors"]), "video_unik": w["distinct_videos"],
        "multimodal": w["multimodal"], "sesi_baru": w["sessions"], "dari_cache": w["cached"],
        "galat": len(w["errors"]), "durasi_dtk": round(w["wall"], 2),
        "label_pertama_p50": round(pct(w["first"], 50), 3), "label_pertama_p95": round(pct(w["first"], 95), 3),
        "final_p50": round(pct(w["final"], 50), 3), "final_p95": round(pct(w["final"], 95), 3),
        "final_maks": round(max(w["final"], default=0), 3),
        "cache_p50": round(pct(w["cache_lat"], 50), 3), "cache_p95": round(pct(w["cache_lat"], 95), 3),
        "health_p50": round(pct(w["probe"], 50), 3), "health_p95": round(pct(w["probe"], 95), 3),
        "sesi_label_pertama_p50": round(pct(w["session_first"], 50), 3),
        "sesi_label_pertama_p95": round(pct(w["session_first"], 95), 3),
    }
    print(f"\n== {name} ==")
    for k, v in row.items():
        print(f"  {k:<20} {v}")
    if w["errors"]:
        print("  contoh galat:", w["errors"][:3])
    return row


def serve(port: int) -> None:
    """Proses server: NARASI asli + penyedia tiruan yang menghitung permintaan (lihat /_sim/calls)."""
    os.environ.update({"LLM_MAX_PER_MINUTE": "0",
                       "LLM_MAX_PER_DAY": "0", "TESTBED_FIXTURES": "false"})
    from app.main import app
    from app.providers.llm import LLMRouter
    from app.usage import usage

    llm, asr = FakeLLM(), FakeASR()
    durations: dict[str, list[float]] = {}

    @app.middleware("http")
    async def timing(request, call_next):
        t = time.perf_counter()
        response = await call_next(request)
        if not request.url.path.endswith("/events"):
            route = "/v1/analyze" if request.url.path == "/v1/analyze" else request.url.path.rsplit("/", 1)[-1]
            durations.setdefault(route, []).append(time.perf_counter() - t)
        return response

    from app.pipeline import Session
    original_emit = Session.emit

    def emit(self, event, data):
        # Waktu dari sesi dibuat sampai label pertama / hasil final dikirim ke aliran SSE pengguna.
        if event == "result":
            age = time.monotonic() - self.created
            if not getattr(self, "_first_sent", False):
                self._first_sent = True
                durations.setdefault("sse_label_pertama", []).append(age)
            if data.get("final"):
                durations.setdefault("sse_final", []).append(age)
        original_emit(self, event, data)

    Session.emit = emit

    @app.get("/_sim/calls")
    async def sim_calls() -> dict:
        server = {k: {"n": len(v), "p50_ms": round(pct(v, 50) * 1000, 1), "p95_ms": round(pct(v, 95) * 1000, 1)}
                  for k, v in durations.items() if k != "calls"}
        durations.clear()
        return {"llm": llm.calls, "asr": asr.calls, "usage": usage.snapshot(), "server": server}

    class Server(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets)
            pipeline = app.state.pipeline
            router = LLMRouter([llm], None, pipeline.cache)
            pipeline.gemini = pipeline.finder.gemini = app.state.llm = router
            pipeline.asr = asr
            app.state.providers.update({"llm": ["simulasi"], "groq": True})
            usage.reset()

    Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)).run()


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--videos", type=int, default=25)
    ap.add_argument("--spread", type=float, default=3.0, help="pengguna datang tersebar dalam N detik")
    ap.add_argument("--multimodal", type=float, default=0.3, help="porsi pengguna yang mengirim frame+audio")
    ap.add_argument("--json", type=str, default="")
    ap.add_argument("--serve", type=int, default=0, help=argparse.SUPPRESS)
    args = ap.parse_args()
    port = free_port()
    tmp = tempfile.mkdtemp(dir=ROOT / "var")
    env = {**os.environ, "REPORTS_DB_PATH": str(Path(tmp) / "load.db")}
    proc = await asyncio.create_subprocess_exec(sys.executable, __file__, "--serve", str(port), env=env)
    base = f"http://127.0.0.1:{port}"
    try:
        async with httpx.AsyncClient(base_url=base) as c:
            for _ in range(200):
                try:
                    if (await c.get("/health")).status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                await asyncio.sleep(0.1)
            else:
                raise SystemExit("server uji tidak mau start")
        print(f"Server NARASI (proses terpisah) di {base} | {args.users} prajurit, {args.videos} video, "
              f"{int(args.multimodal * 100)}% multimodal, datang dalam {args.spread} dtk")

        cold = await wave(base, args.users, args.videos, "a", args.multimodal, args.spread)
        rows = [summarize("Gelombang 1: video baru (cache kosong)", cold)]
        async with httpx.AsyncClient(base_url=base) as c:
            after_cold = (await c.get("/_sim/calls")).json()
        print("  waktu proses server     ", after_cold["server"])
        warm = await wave(base, args.users, args.videos, "a", args.multimodal, args.spread)
        rows.append(summarize("Gelombang 2: video yang sama (cache terisi)", warm))
        async with httpx.AsyncClient(base_url=base) as c:
            final = (await c.get("/_sim/calls")).json()
        print("  waktu proses server     ", final["server"])
    finally:
        proc.terminate()
        await proc.wait()
        for _ in range(20):  # Windows melepas berkas SQLite proses server sesaat setelah proses berhenti
            shutil.rmtree(tmp, ignore_errors=True)
            if not Path(tmp).exists():
                break
            await asyncio.sleep(0.25)

    # Pembanding: tiap pengguna memanggil sendiri (klaim caption; multimodal + OCR, ASR, klaim audio),
    # dan kode lama (cache hasil per video saja, tanpa cache LLM/singleflight): tiap sesi baru memanggil sendiri.
    users = 2 * args.users
    naive = sum(1 + 3 * m for w in (cold, warm) for m in w["modes"])
    old = sum(1 + 3 * m for w in (cold, warm) for m in w["session_modes"])
    actual = sum(final["llm"].values()) + final["asr"]
    print("\n== Pemakaian kuota (LLM + ASR) ==")
    print(f"  pengguna total           {users}")
    print(f"  tanpa cache sama sekali  ~{naive} permintaan")
    print(f"  kode lama (cache hasil)  ~{old} permintaan")
    print(f"  terkirim sekarang        {actual} permintaan {final['llm']} + ASR {final['asr']}"
          f" (gelombang 2 menambah {actual - sum(after_cold['llm'].values()) - after_cold['asr']})")
    print(f"  hemat vs tanpa cache     {100 * (1 - actual / max(naive, 1)):.1f}%")
    print(f"  hemat vs kode lama       {100 * (1 - actual / max(old, 1)):.1f}%")

    if args.json:
        Path(args.json).write_text(json.dumps({
            "params": vars(args), "waves": rows, "requests": {"naive": naive, "old_code": old, "actual": actual},
            "provider_calls": final,
        }, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    if "--serve" in sys.argv:
        serve(int(sys.argv[sys.argv.index("--serve") + 1]))
    else:
        asyncio.run(main())

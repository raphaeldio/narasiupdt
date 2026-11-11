"""Uji beban ReportStore: banyak penonton, banyak video, dashboard dibuka berulang.

    uv run python scripts/bench_reports.py
"""

import random
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models import AnalysisResult, Claim  # noqa: E402
from app.reports import ReportStore  # noqa: E402

VIDEOS = 2000
VIEWS = 200_000
REPORTS = 1000


def main() -> None:
    with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / "var") as tmp:
        store = ReportStore(str(Path(tmp) / "bench.db"), "salt")
        rnd = random.Random(1)
        for i in range(VIDEOS):
            r = AnalysisResult(platform=rnd.choice(["tiktok", "instagram", "youtube"]), video_id=str(i), stage="final",
                               final=True, score=rnd.choice([90, 60, None]), label=rnd.choice(["hoax", "caution", "unverified"]),
                               confidence="high", tni_related=rnd.random() < 0.5,
                               claims=[Claim(id=str(i), text=f"Klaim nomor {i % 150} tentang TNI di wilayah {i % 37}",
                                             source="caption")], evidence=[], conclusion=None)
            store.record_result(r)

        t = time.perf_counter()
        for i in range(VIEWS):
            v = int(rnd.paretovariate(1.2)) % VIDEOS  # sebagian kecil video sangat viral
            store.record_view(rnd.choice(["tiktok", "instagram", "youtube"]), str(v), "", f"user{rnd.randrange(50_000)}")
        store.flush()
        dt = time.perf_counter() - t
        print(f"record_view: {VIEWS:,} pemeriksaan dalam {dt:.2f} dtk = {VIEWS / dt:,.0f}/dtk")

        for i in range(REPORTS):
            store.add_report(platform="tiktok", video_id=str(rnd.randrange(VIDEOS)), url="", reason="mencatut_tni",
                             note="", install_id=f"r{i}", client_result=None)

        t = time.perf_counter()
        store._alerts_cache.clear()
        summary = store.summary(24)
        print(f"summary (tanpa cache): {(time.perf_counter() - t) * 1000:.0f} ms, "
              f"{summary['videos_flagged']} video -> {summary['narratives_total']} narasi")
        t = time.perf_counter()
        for _ in range(100):
            store.summary(24)
        print(f"summary x100 (dengan cache alerts): {(time.perf_counter() - t) * 1000 / 100:.1f} ms/panggilan")
        t = time.perf_counter()
        for i in range(200):
            store.alert_for(f"tiktok:{i}")
        print(f"alert_for per video: {(time.perf_counter() - t) * 1000 / 200:.2f} ms")
        store.close()


if __name__ == "__main__":
    main()

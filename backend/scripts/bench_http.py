"""Bandingkan throughput endpoint ringan (/health) vs pemeriksaan video yang sudah di-cache."""

import asyncio
import sys
import time

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
N = 1500


async def run(label, make):
    async with httpx.AsyncClient(base_url=BASE, timeout=20, limits=httpx.Limits(max_connections=50)) as c:
        sem = asyncio.Semaphore(50)

        async def one(i):
            async with sem:
                await make(c, i)

        t = time.perf_counter()
        await asyncio.gather(*(one(i) for i in range(N)))
        print(f"{label}: {N / (time.perf_counter() - t):.0f} req/dtk")


async def main():
    await run("/health", lambda c, i: c.get("/health"))
    await run("/v1/analyze (cache, TNI)", lambda c, i: c.post(
        "/v1/analyze", headers={"X-Narasi-Install": f"b{i}"},
        json={"platform": "tiktok", "video_id": "n0c0", "caption": "x", "mode": "caption"}))


asyncio.run(main())

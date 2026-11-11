"""Uji asap setelah pemasangan di satuan: N prajurit membuka satu video baru bersamaan.

    uv run python scripts/smoke_test.py http://<server> --token <DASHBOARD_TOKEN> --users 20

Memakai kuota sungguhan (sekali per video, bukan per prajurit). Lulus bila semua prajurit mendapat
hasil final, label pertama cepat, dan /v1/usage menunjukkan permintaan LLM tidak berlipat.
"""

import argparse
import asyncio
import json
import secrets
import statistics
import time

import httpx

CAPTION = ("Beredar video yang menyebut TNI akan menutup seluruh jalan tol Trans Jawa mulai besok untuk latihan "
           "perang, warga diminta menimbun bahan bakar")


async def viewer(base: str, uid: int, video_id: str) -> dict:
    t0 = time.perf_counter()
    async with httpx.AsyncClient(base_url=base, timeout=60) as c:
        r = await c.post("/v1/analyze", headers={"X-Narasi-Install": f"uji-{uid}"},
                         json={"platform": "tiktok", "video_id": video_id, "caption": CAPTION,
                               "hashtags": ["tni"], "mode": "caption"})
        r.raise_for_status()
        data = r.json()
        if data["cached"]:
            dt = time.perf_counter() - t0
            return {"first": dt, "final": dt, "label": data["result"]["label"], "cached": True}
        first = final = label = None
        event = None
        async with c.stream("GET", f"/v1/analyze/{data['session_id']}/events") as s:
            async for line in s.aiter_lines():
                if line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:") and event == "result":
                    payload = json.loads(line[5:])
                    first = first or time.perf_counter() - t0
                    if payload["final"]:
                        final, label = time.perf_counter() - t0, payload["label"]
                elif event == "done":
                    break
        return {"first": first, "final": final, "label": label, "cached": False}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://localhost:8000")
    ap.add_argument("--token", default="")
    ap.add_argument("--users", type=int, default=20)
    args = ap.parse_args()
    headers = {"X-Dashboard-Token": args.token} if args.token else {}

    async with httpx.AsyncClient(base_url=args.base, timeout=10, headers=headers) as c:
        health = (await c.get("/health")).json()
        before = (await c.get("/v1/usage")).json()
    print(f"Server {args.base}: mode={health['mode']} penyedia={health['providers']}")

    video_id = f"uji-{secrets.token_hex(4)}"
    t = time.perf_counter()
    results = await asyncio.gather(*(viewer(args.base, i, video_id) for i in range(args.users)),
                                   return_exceptions=True)
    wall = time.perf_counter() - t
    ok = [r for r in results if isinstance(r, dict) and r["final"] is not None]
    errors = [r for r in results if not isinstance(r, dict)]

    async with httpx.AsyncClient(base_url=args.base, timeout=10, headers=headers) as c:
        after = (await c.get("/v1/usage")).json()
    sent = {k: n - before["calls"].get(k, 0) for k, n in after["calls"].items() if n - before["calls"].get(k, 0)}
    saved = {k: n - before["saved"].get(k, 0) for k, n in after["saved"].items() if n - before["saved"].get(k, 0)}

    firsts = [r["first"] for r in ok]
    finals = [r["final"] for r in ok]
    print(f"{args.users} prajurit serentak, video {video_id}, selesai dalam {wall:.2f} dtk")
    print(f"  hasil final diterima   {len(ok)}/{args.users} (galat {len(errors)}) label={sorted({r['label'] for r in ok})}")
    if ok:
        print(f"  label pertama          median {statistics.median(firsts):.3f} dtk, maks {max(firsts):.3f} dtk")
        print(f"  hasil final            median {statistics.median(finals):.3f} dtk, maks {max(finals):.3f} dtk")
    print(f"  permintaan terkirim    {sent}")
    print(f"  permintaan dihemat     {saved}")
    llm_sent = sum(n for k, n in sent.items() if k.startswith("llm."))
    passed = not errors and len(ok) == args.users and llm_sent <= 4
    print("LULUS" if passed else "GAGAL")
    if errors:
        print("  contoh galat:", repr(errors[0]))


if __name__ == "__main__":
    asyncio.run(main())

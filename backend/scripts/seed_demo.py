"""Isi backend demo dengan lalu lintas simulasi: banyak penonton, unggahan ulang lintas platform, laporan.

    uv run python scripts/seed_demo.py http://localhost:8002
    uv run python scripts/seed_demo.py https://server-demo DASHBOARD_TOKEN   # server produksi
"""

import asyncio
import random
import sys
import time

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
TOKEN = sys.argv[2] if len(sys.argv) > 2 else ""

# (caption, jumlah unggahan ulang, bobot popularitas)
NARRATIVES = [
    ("BREAKING!! TNI akan menyerang Aceh pada 1 November 2026, warga diminta segera mengungsi. Sebarkan!", 6, 40),
    ("Viral! Anggota Kodim 0612/Tasikmalaya memukuli warga saat razia warung obat Tramadol", 3, 12),
    ("Video latihan perang TNI di Natuna ini terjadi minggu lalu, tanda konflik sudah dimulai", 4, 8),
    ("Pendaftaran Bintara TNI AD 2026 dibuka gratis lewat situs resmi rekrutmen TNI AD", 2, 5),
    ("TNI menggelar bakti sosial pengobatan gratis di Aceh pada 1 November 2026", 2, 3),
    ("Minum air rebusan daun sirsak bisa menyembuhkan kanker dalam 3 hari", 3, 6),
    # Isu di luar TNI dan konten berbahasa asing ikut masuk dashboard.
    ("Katanya besok semua ATM diblokir!! Sebarkan sebelum dihapus, media menutupi kabar ini", 3, 9),
    ("Klik link ini untuk klaim hadiah saldo gratis dari pemerintah, daftar sekarang sebelum ditutup", 2, 5),
    ("The FBI and DHS seized voting machines in Texas and Arizona before November 7, 2026", 2, 4),
    ("Lagi ngopi santai sore sama teman-teman, cuaca enak banget", 1, 2),
]
PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"]


async def main() -> None:
    rnd = random.Random(7)
    videos = []
    for n, (caption, copies, weight) in enumerate(NARRATIVES):
        for c in range(copies):
            platform = PLATFORMS[c % len(PLATFORMS)]
            videos.append((platform, f"n{n}c{c}", caption, weight))
    weights = [v[3] for v in videos]
    async with httpx.AsyncClient(base_url=BASE, timeout=20) as client:
        sem = asyncio.Semaphore(50)

        async def check(platform, vid, caption, user):
            async with sem:
                await client.post("/v1/analyze", headers={"X-Narasi-Install": user}, json={
                    "platform": platform, "video_id": vid, "url": f"https://{platform}.example/{vid}",
                    "caption": caption, "mode": "caption"})

        # Gelombang 1 memastikan setiap video punya hasil analisis.
        await asyncio.gather(*(check(p, v, c, "seed") for p, v, c, _ in videos))
        await asyncio.sleep(1.5)
        t = time.perf_counter()
        jobs = []
        for i in range(3000):
            p, v, c, _ = rnd.choices(videos, weights)[0]
            jobs.append(check(p, v, c, f"user{rnd.randrange(1200)}"))
        await asyncio.gather(*jobs)
        dt = time.perf_counter() - t
        print(f"3000 pemeriksaan dari 1200 pengguna dalam {dt:.1f} dtk ({3000 / dt:.0f}/dtk lewat HTTP)")

        for i, (p, v) in enumerate([("tiktok", "n0c0"), ("instagram", "n0c1"), ("tiktok", "n0c0"),
                                    ("instagram", "n1c1"), ("youtube", "n2c2"), ("tiktok", "n1c0")]):
            await client.post("/v1/reports", headers={"X-Narasi-Install": f"reporter{i}"}, json={
                "platform": p, "video_id": v, "url": f"https://{p}.example/{v}", "reason": "mencatut_tni",
                "note": "Beredar di grup WhatsApp warga" if i % 2 == 0 else ""})
        await asyncio.sleep(2.5)
        t = time.perf_counter()
        res = await client.get("/v1/summary", headers={"X-Dashboard-Token": TOKEN} if TOKEN else {})
        if res.status_code == 401:
            print("Data demo terkirim. /v1/summary butuh token: jalankan ulang dengan DASHBOARD_TOKEN sebagai argumen kedua.")
            return
        s = res.json()
        print(f"/v1/summary: {(time.perf_counter() - t) * 1000:.0f} ms -> {s['status']}: {s['headline']}")
        for n in s["narratives"]:
            print(f"  [{n['level']}] {n['videos']} video, {n['viewers_1h']} penonton/jam, {n['reports']} laporan: {(n['claim'] or '-')[:60]}")


asyncio.run(main())

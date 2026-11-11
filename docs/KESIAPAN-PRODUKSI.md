# NARASI — Kesiapan Produksi untuk Server Satuan

Diuji 3 November 2026 di laptop pengembang (Windows 11, Python 3.14). Semua angka di bawah berasal dari
berkas mentah di `docs/bukti/`, dan semuanya bisa diulang dengan perintah yang dicantumkan.

## Ringkasan

| Yang dibuktikan | Hasil |
|---|---|
| Server bisa dijalankan | Ada bug di versi sebelumnya: `extension_ids` dan `closed_report_retention_days` tidak ada di config, jadi server **gagal start**. Sudah diperbaiki; 67 tes lulus |
| Real time, 300 prajurit serentak | Label pertama p50 **35 ms**, p95 **200 ms**; hasil final p95 **1,9 dtk**; **0 galat** |
| Real time, 1.000 prajurit serentak | Server mengirim label pertama lewat SSE dalam p50 **4,3 ms**, p95 **14 ms**; **0 galat** |
| Hemat kuota (simulasi 2.000 pemeriksaan) | **83 permintaan** LLM+ASR. Tanpa cache butuh ±4.046 (**hemat 97,9%**); dibanding kode sebelumnya ±308 (**hemat 73%**) |
| Hemat kuota (API sungguhan) | 20 prajurit membuka 1 video baru bersamaan → **1 permintaan LLM**, 19 lainnya menumpang hasil yang sama |
| Penonton berikutnya | Diambil dari cache dengan **0 permintaan LLM** (p95 34 ms) |

## Cara kerja penghematan kuota

Masalah utama di satuan: satu video viral dibuka ratusan prajurit dalam hitungan detik. Kode sebelumnya
sudah menyimpan *hasil akhir* per video ke cache, tetapi sebelum hasil pertama selesai, setiap prajurit
memulai sesi sendiri dan memanggil LLM sendiri. Kode sekarang menangani itu di tiga lapis:

1. **Singleflight**: permintaan serentak dengan masukan yang sama digabung jadi satu panggilan. Ini
   berlaku untuk ekstraksi klaim, OCR (sekali per video), ASR (sekali per potongan audio per video), sikap
   bukti, kesimpulan, dan pencarian Fact Check/Tavily/embedding per klaim.
   (`app/cache.py` `SingleFlight`, `app/providers/llm.py`, `app/evidence.py`, `app/pipeline.py`)
2. **Cache LLM kolektif per isi masukan** (default 30 hari). Caption yang sama di video unggahan ulang
   tidak dikirim lagi ke LLM. Kalau seorang prajurit keburu menggulir lewat, panggilan yang sedang
   berjalan tetap diselesaikan dan disimpan untuk penonton berikutnya, jadi kuotanya tidak terbuang.
3. **Pagar kuota untuk seluruh server** (`LLM_MAX_PER_MINUTE`, `LLM_MAX_PER_DAY`). Kalau batasnya
   tercapai, klaim memakai heuristik dan label tetap keluar. 20% kuota per menit dicadangkan untuk OCR,
   karena OCR tidak punya pengganti heuristik.

Redis di `deploy/` disimpan ke disk (AOF), jadi cache tidak hilang dan kuota tidak terpakai ulang
setelah server restart. Ringkasan pemakaian bisa dipantau di `GET /v1/usage` (butuh token dashboard).

## Bukti 1 — Uji beban satuan (tanpa memakai kuota)

`backend/scripts/load_test.py` menjalankan server NARASI sungguhan (uvicorn, HTTP dan SSE) di proses
terpisah. LLM dan ASR diganti tiruan yang meniru latensi Groq (teks ±0,8 dtk, OCR ±1,5 dtk, ASR ±0,5 dtk)
dan menghitung setiap permintaan. Setiap prajurit memakai klien HTTP sendiri. Pilihan video mengikuti
distribusi viral: beberapa video ditonton sebagian besar prajurit. 30% prajurit mengirim frame dan audio.

```bash
cd backend && uv run --env-file local.env python scripts/load_test.py --users 300 --videos 25
```

```bash
cd backend && uv run --env-file local.env python scripts/load_test.py --users 1000 --videos 60 --spread 5
```

**Waktu yang dirasakan pengguna (ujung ke ujung, detik)**

| Skenario | Pengguna | Sesi baru / dari cache | Galat | Label pertama p50 / p95 | Final p50 / p95 / maks |
|---|---|---|---|---|---|
| 300 prajurit, video baru | 300 | 102 / 198 | 0 | 0,035 / 0,200 | 0,095 / 1,876 / 2,149 |
| 300 prajurit, video sama | 300 | 0 / 300 | 0 | 0,016 / 0,034 | 0,016 / 0,034 / 0,044 |
| 1.000 prajurit, video baru | 1.000 | 155 / 845 | 0 | 1,110 / 1,498 | 1,116 / 2,031 / 3,630 |
| 1.000 prajurit, video sama | 1.000 | 0 / 1.000 | 0 | 0,231 / 0,303 | 0,231 / 0,303 / 0,316 |

**Waktu di sisi server (ms)**

| Skenario | `/v1/analyze` p50 / p95 | Label pertama ke SSE p50 / p95 | Final ke SSE p50 / p95 |
|---|---|---|---|
| 300 prajurit | 2,6 / 13,1 | 1,3 / 3,0 | 773 / 1.980 |
| 1.000 prajurit | 78,7 / 103,5 | 4,3 / 14,0 | 654 / 2.029 |

Pada uji 1.000 prajurit, sebagian besar waktu ujung-ke-ujung (±1 dtk) habis di sisi **klien uji**:
1.000 klien HTTP berjalan di satu proses Python, di laptop yang sama dengan server. Server sendiri tetap
mengirim label pertama dalam ±4 ms. Waktu final mengikuti latensi LLM; prosesnya tidak antre.

**Permintaan berkuota**

| Skenario | Tanpa cache sama sekali | Kode sebelumnya (cache hasil saja) | Sekarang |
|---|---|---|---|
| 300 prajurit × 2 gelombang | ±1.266 | ±207 | **54** (klaim 26, OCR 14, ASR 14) |
| 1.000 prajurit × 2 gelombang | ±4.046 | ±308 | **83** (klaim 31, OCR 26, ASR 26) |

Gelombang kedua (video yang sama) menambah **0** permintaan. Berkas mentah:
`docs/bukti/beban_300.{txt,json}` dan `docs/bukti/beban_1000.{txt,json}`.

## Bukti 2 — Uji asap dengan API sungguhan

Backend dijalankan dengan kunci asli (Groq, Gemini, Fact Check, Tavily). Lalu 20 prajurit membuka satu
video baru pada saat yang sama (`docs/bukti/smoke_live.txt`):

```
20 prajurit serentak, selesai dalam 4.64 dtk
  hasil final diterima   20/20 (galat 0) label=['caution']
  label pertama          median 0.487 dtk, maks 0.600 dtk
  hasil final            median 4.481 dtk, maks 4.599 dtk
  permintaan terkirim    {'factcheck': 2, 'tavily': 1, 'embed': 1, 'evidence': 1, 'llm.conclusion': 1}
  permintaan dihemat     {'evidence:shared': 19, 'llm.conclusion:shared': 19}
LULUS
```

Tanpa singleflight, uji ini akan mengirim 20 permintaan LLM, 40 Fact Check, 20 Tavily, dan 20 embedding.
Skrip yang sama bisa dipakai sebagai uji pasca-pemasangan di satuan:

```bash
cd backend && uv run python scripts/smoke_test.py http://<ip-server> --token <DASHBOARD_TOKEN> --users 20
```

## Bukti 3 — Penyimpanan laporan & peringatan dini

`docs/bukti/bench_laporan.txt` (`scripts/bench_reports.py`):

- Sinyal penonton: 200.000 pemeriksaan dalam 13 dtk, atau ±15.000 per detik.
- Ringkasan dashboard: 98 ms tanpa cache. Hasilnya di-cache bersama 10 dtk, jadi 1 atau 100 petugas
  yang membuka dashboard tetap hanya memicu 1 query.
- Level peringatan per video sekarang hanya dihitung ulang kalau data penonton berubah. Sebelumnya ada
  satu query SQL untuk setiap penonton.

## Pemasangan di server satuan

Kebutuhan: satu server atau PC Linux/Windows dengan Docker. 2 vCPU dan 2 GB RAM sudah cukup untuk ratusan
prajurit, karena pekerjaan beratnya ada di layanan LLM.

```bash
cd deploy && cp .env.production.example .env
```

Isi `.env`. Minimal `DASHBOARD_TOKEN`, `VIEWER_SALT`, dan kunci API yang tersedia. Lalu jalankan:

```bash
cd deploy && docker compose up -d --build
```

- `http://<ip-server>/` membuka dashboard Mode Satuan. API ada di origin yang sama, dan nginx sudah
  disetel untuk SSE (tanpa buffering).
- Extension untuk prajurit dibangun dengan alamat server. Alamat itu otomatis masuk izin host:

```bash
cd extension && WXT_BACKEND_URL=http://<ip-server> npm run build
```

- Dengan `ENVIRONMENT=production`, server **menolak start** kalau `DASHBOARD_TOKEN` kosong atau kurang dari
  24 karakter, `VIEWER_SALT` kosong, atau data uji testbed masih aktif.
- Container API berjalan sebagai pengguna non-root, punya healthcheck, dan memakai 1 worker async (sesi
  dan SSE disimpan di memori proses). Restart otomatis aktif dan log dirotasi.
- Data laporan (`narasi-data`) dan cache (`narasi-cache`) disimpan di volume Docker.

## Batasan dan yang belum diverifikasi

- **Docker tidak terpasang di laptop ini**, jadi `deploy/docker-compose.yml`, kedua `Dockerfile`, dan
  `nginx.conf` belum pernah di-build atau dijalankan. Uji di atas memakai uvicorn langsung dan cache memori,
  bukan Redis. Jalankan `docker compose up` sekali lalu uji asap di server satuan sebelum dipakai.
- Klien uji dan server berjalan di laptop yang sama. Di server khusus angkanya seharusnya sama atau lebih
  baik, tapi itu belum diukur.
- Latensi LLM pada uji beban adalah tiruan. Latensi sungguhan bergantung pada Groq/Gemini dan paket kuotanya.
  Batas akun gratis tetap berlaku (Gemini ±20 generate/hari/model; Groq 7.000 token/menit). Untuk pemakaian
  satuan, aktifkan billing atau Dev Tier dan sesuaikan `LLM_MAX_PER_MINUTE` / `LLM_MAX_PER_DAY`.
- Hanya 1 worker per server. Untuk lebih dari satu server, sesi perlu dipindah ke Redis.
- Selector Instagram, TikTok, dan Facebook masih belum diuji di akun sungguhan (batasan ini sudah ada
  sebelumnya, lihat README).

# Deploy NARASI untuk Juri

Tujuannya: server + dashboard jalan online, juri cukup pasang ekstensi dari satu file zip.

## 1. Siapkan server (sekali)

VPS Linux apa saja (1 vCPU / 2 GB RAM cukup), dengan port **80** dan **443** terbuka. Pasang Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Salin repo ke server (git clone atau scp), lalu masuk ke folder `deploy/`.

## 2. Isi konfigurasi

```bash
cp .env.production.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # untuk DASHBOARD_TOKEN
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # untuk VIEWER_SALT
```

Isi di `.env`:

| Kunci | Isi |
|---|---|
| `DASHBOARD_TOKEN`, `VIEWER_SALT` | dua nilai acak di atas |
| `DOMAIN` | `<ip-server>.sslip.io` (gratis, tanpa beli domain), atau domain sendiri |
| `CORS_ORIGINS` | `'["https://<DOMAIN>"]'` (pakai tanda kutip tunggal di luar) |
| `EXTENSION_IDS` | biarkan `[]`: ID ekstensi "Load unpacked" berbeda di tiap laptop juri |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, `FACTCHECK_API_KEY` | kunci API tim |
| `LLM_MAX_PER_DAY` | naikkan sesuai kuota paket API selama masa penjurian |

## 3. Nyalakan (dengan HTTPS otomatis)

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
curl https://<DOMAIN>/health
```

Sertifikat Let's Encrypt dibuat otomatis oleh Caddy saat pertama kali diakses.

## 4. Isi data demo (opsional, supaya grafik dashboard tidak kosong)

Dari laptop tim:

```bash
cd backend
uv run python scripts/seed_demo.py https://<DOMAIN> <DASHBOARD_TOKEN>
```

## 5. Buat paket juri

Isi dulu tautan video contoh di `docs/PANDUAN-JURI.md`, lalu dari laptop tim (Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\paket-juri.ps1 -Server https://<DOMAIN>
```

Hasilnya `dist-juri\NARASI-juri.zip` (ekstensi yang sudah diarahkan ke server + `PANDUAN-JURI.txt` berisi
link dashboard bertoken). File ini **tidak** di-commit karena memuat token. Kirim zip itu ke juri.

## Sebelum hari penjurian

- Coba sendiri zip-nya di laptop/profil Chrome yang bersih.
- Cek kuota API masih cukup (`/v1/usage` di dashboard).
- Siapkan video demo sebagai cadangan kalau jaringan atau platform bermasalah.
- Selesai penjurian: ganti `DASHBOARD_TOKEN` atau matikan server (`docker compose down`).

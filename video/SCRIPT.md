# NARASI — Naskah Video Demo 60 Detik

Format 1920×1080, 30 fps, 1800 frame. Tempo 120 BPM, jadi 1 beat = 0,5 detik = 15 frame. Semua cut jatuh di kelipatan 15 frame.
Gaya bahasanya santai, kayak creator ngomong ke temen, tapi tetap hormat soal TNI AD.

## Peta rubrik

| Kriteria (bobot) | Scene yang menjawab |
|---|---|
| Relevansi & Manfaat untuk TNI AD (25%) | 1 Hook, 2 Masalah, 6 Lapor + Mode Satuan |
| Inovasi Teknis (25%) | 5 Inovasi (multimodal + bukti) |
| Fungsionalitas Purwarupa (25%) | 4 Demo Asli (rekaman langsung di YouTube Shorts) |
| Kelayakan Implementasi (15%) | 7 Siap Dipakai |
| Kualitas Dokumentasi (10%) | Seluruh video: alurnya jelas, angka diambil dari rekaman asli |

---

## 1 · HOOK — 0:00–0:06 (frame 0–180)
**Kasus asli:** YouTube Shorts [DwvC_FjYxoU](https://www.youtube.com/shorts/DwvC_FjYxoU) (@gallerykicau, Juli 2025). Narasinya dicap **[HOAKS]** oleh Komdigi di Laporan Isu Hoaks 1 Oktober 2025 ("Video Pengiriman 18.000 Personel TNI ke Aceh"). Videonya ternyata latihan Yonkav 1 Kostrad di Baturaja, Sumatera Selatan.

**Visual**
- Video aslinya diputar di dalam bingkai.
- Glitch merah, disusul counter hari sejak dibantah.

**Teks layar**
- f15: "'18.000 pasukan TNI dikirim ke Aceh.'"
- f75: **"HOAKS."** (stempel merah)
- f120: "Udah dibantah Komdigi. Tapi videonya masih tayang."
- Counter naik ke **393 hari sejak dibantah** (1 Okt 2025 sampai 29 Okt 2026).

**VO**
> "Delapan belas ribu pasukan TNI dikirim ke Aceh? Hoaks. Udah dibantah Komdigi, tapi videonya masih tayang."

**SFX**
- glitch di f75
- tick di counter

## 2 · MASALAH — 0:06–0:12 (frame 180–360)
**Visual**
- Split jadi 3 kolom:
  - Caption: kelihatan aman, warna hijau.
  - Teks layar: nyala merah.
  - Gelombang suara: nyala merah.
- Ikon pindah tab dicoret.
- Kata "DOMAIN KOGNITIF" slam ke tengah.

**Teks layar**
- f180: "Caption-nya aman…"
- f225: "…hoaksnya nyumput di suara & layar."
- f300: "Ini serangan ke **domain kognitif**."

**VO**
> "Ini serangan ke ruang kognitif. Hoaksnya nyumput di suara dan teks layar. Siapa yang sempat ngecek?"

## 3 · REVEAL — 0:12–0:15 (frame 360–450)
**Visual:** logo NARASI slam masuk, ikon ekstensi nyala hijau.

**Teks layar**
- "NARASI"
- "Tameng kognitif, langsung di layar."

**VO**
> "Makanya, kita bikin NARASI."

**SFX:** thud + riser

## 4 · DEMO ASLI — 0:15–0:30 (frame 450–900) · *Fungsionalitas*
**Visual**
- Rekaman layar asli (YouTube Shorts di Edge + ekstensi NARASI), chip "DEMO LANGSUNG · VIDEO ASLI".
- Yang terjadi di rekaman, dihitung sejak video mulai diputar:
  - **2,1 detik:** badge muncul dari caption, labelnya "Belum Terverifikasi".
  - **4,8 detik:** teks layar kebaca dan cocok dengan bantahan Komdigi. Label naik jadi **"100% Indikasi Hoaks"** + tag **"Mencatut TNI"**.
  - **13 detik:** audio selesai dicek dan hasil final terkunci.
- Zoom ke badge. Timer di pojok jalan sesuai waktu nyata dari `public/rec/demo.json`.

**Teks layar**
- "Ini demo asli, bukan mockup."
- "Detik ke-4,8: ketahuan." (angkanya otomatis diambil dari rekaman)
- "…terus makin akurat: teks layar + suara ikut dicek."

**VO**
> "Ini demo asli ya. Dari caption doang, belum cukup bukti. Tapi begitu teks di layarnya kebaca, detik kelima: indikasi hoaks, mencatut nama TNI. Terus makin akurat, suaranya juga ikut dicek."

## 5 · INOVASI — 0:30–0:38 (frame 900–1140) · *Inovasi Teknis*
**Visual**
- Strip 3 sumber nyala satu-satu per 2 beat: Caption → Teks layar (OCR) → Audio (Whisper).
- Lalu kursor klik badge dan panel bukti terbuka.
- Callout menunjuk tiga bagian panel: "Klaim terdeteksi", "Sumber" (resmi, % cocok), "Kesimpulan [1]".

**Teks layar**
- "Baca caption. Baca layar. Dengerin suara."
- "Bukan nebak. Ada buktinya."

**VO**
> "NARASI baca caption, baca layar, dengerin suara. Bukan nebak, buktinya langsung dari sumber resmi."

## 6 · LAPOR + MODE SATUAN — 0:38–0:48 (frame 1140–1440) · *Relevansi & Manfaat*
**Visual**
- Tombol emas "Laporkan ke TNI AD" ditekan.
- Whip transition ke rekaman dashboard Mode Satuan:
  - KPI naik
  - chip "naik cepat"
  - notifikasi Telegram muncul

**Teks layar**
- "Lapor sekali klik."
- "Penerangan tahu duluan."

**VO**
> "Mau lapor? Sekali klik. Laporannya langsung masuk ke tim Penerangan, dan narasi yang naik cepat ketahuan sebelum viral."

## 7 · SIAP DIPAKAI — 0:48–0:55 (frame 1440–1650) · *Kelayakan*
**Visual:** 3 kartu masuk nge-beat, tiap 70 frame:
1. Chrome Enterprise
2. Server on-premise
3. Gembok privasi

**Teks layar**
- "Pasang serentak di perangkat satuan."
- "Bisa jalan on-premise."
- "Nggak nyimpen video. Nggak baca akun."

**VO**
> "Bisa dipasang serentak di perangkat satuan, jalan di server sendiri, dan nggak nyimpen video siapa pun."

## 8 · PENUTUP — 0:55–1:00 (frame 1650–1800)
**Visual**
- 3 kata, satu per beat: "Tanpa pindah tab." · "Berbasis bukti." · "Multimodal."
- Lalu logo, tagline, dan nama tim.

**Teks layar:** "NARASI — jaga ruang kognitif TNI AD"

**VO**
> "NARASI. Scroll tetap jalan, hoaks nggak lolos."

---

## Catatan produksi
- **Musik:** `public/music.wav`, disintesis sendiri lewat `node scripts/music.mjs`. Tempo 120 BPM, kunci A minor, hantaman jatuh di cut utama (stempel, reveal, whip, penutup). Tanpa sampel, jadi bebas lisensi.
- **VO:** `public/vo/s1.wav` … `s8.wav`, dibuat dengan Gemini TTS (`gemini-3.8-flash-tts`, suara Puck) lewat `node scripts/vo.mjs`. Key-nya diambil dari `backend/.env`.
  - Hening di awal/akhir otomatis dipotong.
  - Kalau masih melebihi durasi scene, VO dipercepat dengan `atempo` (s1 jadi 1,12×).
  - Mau pakai suara sendiri? Timpa file WAV-nya, lalu jalankan `node scripts/vo.mjs --fit` biar dipotong dan dinormalisasi ulang.
- **Ducking:** volume musik turun ke 0,2 waktu ada narasi, lalu naik ke 0,55 waktu jeda.
- **Rekaman demo:** ada di `public/rec/`, hasil `extension/e2e/record-demo.spec.ts`.
- **Sumber bantahan** (sudah masuk `backend/data/corpus.json`): Laporan Isu Hoaks Komdigi, Rabu 1 Oktober 2025, butir 2. Komdigi merujuk turnbackhoax.id (30 Sep 2025) dan akun TikTok resmi @yonkav1_kostrad.
- **Klaim kelayakan:** semuanya dari PRD (`docs/prd/build_prd.js`): force-install lewat Chrome Enterprise, on-premise, nol penyimpanan media, adapter platform ~100 baris.
- **Angka latensi:** yang tampil di video selalu waktu nyata dari rekaman, bukan target desain.

## Cara pakai
Semua perintah dijalankan dari folder project. Nggak ada yang di-install global.

- **Preview / edit:** `npm run studio` (di folder `video/`).
- **Render:** `npm run render`, hasilnya di `out/narasi-demo.mp4`.
- **Rekam ulang demo:** jalankan perintah ini dari folder `extension/`:
  ```bash
  RECORD_DEMO=1 RECORD_URL=https://www.youtube.com/shorts/DwvC_FjYxoU PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/record-demo.spec.ts
  ```
  - Perintah ini menimpa `public/rec/*` dan `src/rec.ts`.
  - Restart backend dulu sebelum merekam: cache-nya di memori. Kalau hasilnya sudah ter-cache, label langsung final dan momen "label naik dari Belum Terverifikasi ke Indikasi Hoaks" nggak kerekam.
  - Setiap rekaman ikut mengirim satu laporan ke backend lokal. Laporan itu kemudian muncul di dashboard.

---

# Iklan 30 detik (komposisi `NarasiAd`)

Gaya iklan: cepat, tanpa basa-basi, 120 BPM (1 beat = 15 frame). Semua footage rekaman layar asli dari
`extension/e2e/record-ad.spec.ts`: Shorts di-scroll pakai ekstensi, dashboard Realtime direkam bersamaan.

| Frame | Babak | Isi |
|---|---|---|
| 0–120 | Buka | Cincin 3D Shorts berputar tanpa jeda, "SCROLL." ×4, "Yang mana HOAKS?" |
| 120–360 | Feed | 5 Shorts acak di ponsel, badge muncul + burst Lottie, tally label |
| 360–510 | Hoaks | Label naik ke 100% Indikasi Hoaks, stempel, panel bukti, kirim laporan |
| 510–750 | Dashboard | Aliran data SVG ke dashboard; baris vonis lalu laporan masuk live; kamera pindah ke diagram alur |
| 750–825 | Showreel | Rangkuman, Rekomendasi, Laporan, Realtime, cincin platform |
| 825–900 | Logo | Heksagon SVG tergambar, ikon, huruf NARASI, tagline |

- Lottie: `node scripts/lottie.mjs` -> `public/lottie/*.json` (ditulis langsung sebagai JSON Bodymovin).
- Musik: `node scripts/music-ad.mjs` -> `public/music-ad.wav`.
- Rekam ulang (dari `extension/`, backend :8000 + dashboard :5174 jalan):
  `RECORD_AD=1 PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/record-ad.spec.ts`.
  Durasi webm Playwright tidak sama dengan jam tes, jadi detik kejadian dicari ulang lewat komposisi
  `Sheet` (lembar kontak), lalu angka di `src/ad/NarasiAd.tsx` (SEGS, PHONE_CLIPS, DASH_CLIPS, REEL) disesuaikan.
- Render: `npm run render:ad` -> `out/narasi-iklan.mp4`.

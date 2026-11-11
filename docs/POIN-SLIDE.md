# NARASI: Poin Slide untuk PPT

Isi tiap slide siap salin ke PowerPoint. **Judul** = judul slide, poin = isi bullet, *Visual* = saran tampilan.
Naskah lengkap yang dibacakan ada di [SCRIPT-PRESENTASI.md](SCRIPT-PRESENTASI.md). Sumber data ditaruh kecil di pojok bawah slide.

---

## BAGIAN 1 · LATAR BELAKANG

### Slide 1 — Judul / Hook
**"18.000 pasukan TNI dikirim ke Aceh"**
- HOAKS: dibantah Komdigi sejak 1 Oktober 2025
- Faktanya: latihan Yonkav 1 Kostrad di Baturaja
- **400+ hari** kemudian, videonya **masih tayang**

*Visual:* video Shorts aslinya diputar tanpa suara, lalu stempel merah "HOAKS" dan counter hari.
*Sumber:* Laporan Isu Hoaks Komdigi, 1 Okt 2025

### Slide 2 — Skala Masalah
**Hoaks bergerak lebih cepat dari bantahannya**
- **229 juta** orang Indonesia online
- **±194 juta** pengguna TikTok, hampir **2 jam/hari**
- **1.674 hoaks** setahun, **4–5 hoaks baru per hari**
- **341** hoaks menyasar pemerintahan & institusi negara
- Itu baru yang **ketahuan**

*Visual:* angka besar, muncul satu per satu.
*Sumber:* APJII 2025 · We Are Social & DataReportal 2025 · Komdigi (Okt 2024–Okt 2025)

### Slide 3 — Tim
**Tim PostgreMyself**
- Raphael Diovana Tarigan, Full Stack Engineer
- Membangun NARASI dari ujung ke ujung:
  - Ekstensi browser
  - Server analisis AI
  - Dashboard petugas Penerangan

*Visual:* foto + nama + peran.

### Slide 4 — Hoaks TNI Itu Nyata
**Hoaks TNI datang beruntun**
- **Sep 2025:** Puspen TNI bantah **5 hoaks sekaligus** soal prajurit provokator demo
- **Okt 2025:** "18.000 pasukan TNI ke Aceh", masih tayang sampai sekarang
- **Mar 2026:** hoaks "TNI Siaga 1, warga siapkan stok" di TikTok
- Polanya sama: **video pendek, viral dalam jam, bantahan datang dalam hari**

*Visual:* linimasa horizontal tiga titik.
*Sumber:* Antara, RMOL · Komdigi · Bisnis.com

### Slide 5 — Tiga Celah
**Kenapa cek fakta biasa kalah cepat?**
1. **Hoaksnya ngumpet:** caption aman, klaim ada di teks layar & suara
2. **Harus pindah tab:** hampir tidak ada yang berhenti scroll untuk cek fakta
3. **Penerangan tahu telat:** baru sadar setelah video viral
- Deepfake & hoaks berbasis AI naik signifikan di 2025 (Mafindo)
- Ini serangan ke **domain kognitif**, medan keempat setelah darat, laut, udara

*Visual:* tiga kolom dengan ikon (mata tertutup, tab, jam).

### Slide 5b — Hasil Survei *(opsional, kalau datanya sudah ada)*
**Suara prajurit & ASN TNI**
- [n] responden dari TNI AD, AL, AU
- [x]% pernah menemukan hoaks yang mencatut TNI (6 bulan terakhir)
- Indeks urgensi **[y]%**: kategori **[Sangat mendesak]**

---

## BAGIAN 2 · SOLUSI

### Slide 6 — Perkenalkan NARASI
**NARASI: Verification & Narrative Insights**
- **Ekstensi browser** untuk siapa saja yang menonton video
  - IG Reels · TikTok · YouTube Shorts · FB Reels
  - Membaca **caption, teks layar, dan suara**
  - Label berbasis bukti **langsung di atas caption**
- **Dashboard** untuk petugas Penerangan TNI AD
  - Video yang perlu segera ditangani
- Semua topik dicek, termasuk video berbahasa asing

*Visual:* logo lengkap `docs/logo/narasi-logo.png`, lalu screenshot badge + dashboard.

### Slide 7 — Enam Label NARASI
**Label yang jelas, berbasis bukti**
- 🔴 **Indikasi Hoaks:** ada bantahan resmi / cek fakta
- 🟠 **Perlu Diwaspadai:** ajakan "sebarkan!", sumber tidak jelas
- 🟢 **Didukung Sumber:** sesuai sumber resmi terpercaya
- ⚪ **Belum Terverifikasi:** belum ada bukti
- 🟣 **Opini/Satire:** candaan, parodi, pendapat
- ⚫ **Tanpa klaim:** tidak ada fakta yang perlu dicek

*Visual:* chip berwarna seperti tampilan di ekstensi.

### Slide 8 — Live Demo
**Demo langsung — bukan mockup**
1. Video hoaks asli di YouTube Shorts: label naik ke **Indikasi Hoaks** (detik ke-4,8)
2. Panel rincian: klaim, sumber, kesimpulan bersitasi
3. Video resmi & satire: **tidak asal dicap hoaks**
4. **Laporkan ke TNI AD**: sekali klik, anonim
5. Dashboard: realtime, peringatan dini, rekomendasi & simulasi

*Visual:* slide sederhana sebagai pengantar, lalu pindah ke browser. Siapkan rekaman `video/out/narasi-demo.mp4` sebagai cadangan.

---

## BAGIAN 3 · KEUNIKAN

### Slide 9 — Apa Bedanya?
**NARASI vs cara cek fakta yang ada**

| | Situs cek fakta | Moderasi platform | **NARASI** |
|---|---|---|---|
| Di mana | Pindah tab, cari sendiri | Tidak terlihat | **Di atas caption** |
| Yang dibaca | Teks | Tergantung platform | **Caption + layar + suara** |
| Dasar label | Artikel per kasus | Kebijakan internal | **Bukti bersitasi** |
| Kecepatan | Jam–hari | Tidak menentu | **±0,1 dtk** label awal |
| Untuk TNI AD | — | — | **Peringatan dini** |

*Visual:* tabel, kolom NARASI disorot warna sian.

### Slide 10 — Lima Pembeda
**Kenapa NARASI berbeda**
1. **Ada di tempat hoaks beredar:** tanpa pindah tab
2. **Multimodal:** caption, teks layar, dan suara
3. **Hoaks hanya lahir dari bukti:** AI tidak memvonis sendiri
4. **Tahan salah cocok:** "baksos TNI di Aceh" ≠ "TNI serang Aceh"
5. **Dua sisi satu sistem:** label untuk penonton + peringatan dini untuk Penerangan

*Visual:* lima ikon berderet.

---

## BAGIAN 4 · TEKNOLOGI

### Slide 11 — Alur Sistem
**Dari video ke vonis dalam hitungan detik**
- **Ekstensi** (WXT + React + TypeScript, Manifest V3): ambil caption, frame 480 px, audio
- **Server** (FastAPI, Python):
  - Ekstraksi klaim: LLM Groq, cadangan Gemini
  - Baca teks layar: OCR berbasis AI
  - Dengar suara: Whisper large-v3-turbo
  - Cari bukti: Komdigi, PPID TNI AD, TurnBackHoax/Mafindo, Google Fact Check, Tavily, Google News
- **Realtime** lewat Server-Sent Events: label awal ±0,1 dtk → label final
- **Penyimpanan:** Redis (cache bersama) + SQLite (laporan)
- **Dashboard** (React + Vite + Tailwind + shadcn + Recharts) → notifikasi **Telegram**

*Visual:* diagram alur: Video → Ekstensi → Server (Klaim → Bukti → Vonis) → Label di layar + Dashboard → Telegram.

### Slide 12 — Siap Skala Satuan
**Teruji untuk ribuan prajurit**
- **1.000 prajurit serentak: 0 galat**
- Label pertama dikirim server dalam **p50 4,3 ms**
- Pemakaian AI **hemat 97,9%** (83 vs ±4.046 permintaan)
- 20 prajurit buka video yang sama → cukup **1 panggilan AI**
- **Nggak pernah blank:** kuota habis / internet putus, label tetap keluar

*Visual:* tiga angka besar (1.000 · 0 galat · 97,9%).
*Sumber:* `docs/KESIAPAN-PRODUKSI.md`, `docs/bukti/`

### Slide 13 — Privasi *(opsional)*
**Aman untuk prajurit**
- Tidak menyimpan video siapa pun
- Tidak membaca akun pengguna
- ID penonton di-hash acak
- Laporan ke TNI AD anonim

---

## BAGIAN 5 · OUTCOME

### Slide 14 — Dampak Nyata
**Dampak di tiga lapis**
- **Prajurit & keluarga:** tameng kognitif langsung di layar, tidak ikut menyebarkan hoaks yang mencatut TNI
- **Penerangan TNI AD:** peringatan dini, bukti siap pakai, rekomendasi aksi sebelum viral
- **Pertahanan siber nasional:** data agregat narasi untuk analisis operasi informasi; bisa diperluas ke matra lain, Puspen TNI, Komdigi

*Visual:* tiga lapis/lingkaran konsentris.

### Slide 15 — Siap Dipasang
**Bukan cuma purwarupa**
- **Pasang serentak:** force-install lewat Chrome/Edge Enterprise
- **Server sendiri:** satu `docker-compose`, cukup 2 vCPU & 2 GB RAM, bisa on-premise
- **Mudah dirawat:** platform ganti tampilan → cukup perbaiki satu adapter
- **Langkah berikutnya:**
  - Pilot 30 hari di satu Kodim / Dispen
  - Perluas korpus bantahan bersama PPID TNI AD
  - Deteksi deepfake

*Visual:* tiga kartu + panah roadmap.

---

## BAGIAN 6 · PENUTUPAN

### Slide 16 — Penutup
**NARASI: scroll tetap jalan, hoaks nggak lolos.**
- 400+ hari setelah dibantah, hoaks masih tayang
- NARASI memastikan **bantahan muncul di layar yang sama, di detik yang sama**
- Tim PostgreMyself · Terima kasih

*Visual:* logo lengkap + tagline *Verification & Narrative Insights*.

---

## Slide Cadangan (setelah penutup, untuk tanya jawab)

### Slide 17 — Sumber Data
- APJII 2025: 229,43 juta pengguna internet (penetrasi 80,66%)
- We Are Social/Meltwater Jul 2025: ±194 juta pengguna TikTok; DataReportal Agu 2025: 1 jam 53 menit/hari
- Komdigi: 1.674 hoaks (22 Okt 2024–20 Okt 2025)
- Mafindo: 1.593 hoaks (21 Okt 2024–19 Okt 2025), deepfake & scam dominan
- Puspen TNI: bantahan 5 hoaks demo (5 Sep 2025)
- Komdigi: hoaks "Siaga 1 TNI" (25 Mar 2026)

### Slide 18 — FAQ Singkat
- **AI salah?** Label hoaks hanya dari bukti; AI cuma peringatan awal
- **Sensor?** Tidak. Konten tidak dihapus, hanya diberi label + sumber
- **Biaya?** 2.000 pemeriksaan = 83 permintaan AI
- **Kuota habis?** Tetap jalan dari bantahan tersimpan + pola bahasa
- **Hoaks baru?** Pola provokatif → *Perlu Diwaspadai* + naik ke peringatan dini

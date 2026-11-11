# NARASI: Naskah Presentasi Final Kartika Hackathon 2026

**Tim:** PostgreMyself · **Pembicara:** Raphael Diovana Tarigan (full stack engineer)
**Durasi:** ±10 menit presentasi + demo, sisanya tanya jawab.
Gaya bahasanya santai tapi tetap hormat. Nada bicara naik saat membacakan angka. Setelah angka besar, **jeda 1 detik**.

| Bagian | Waktu | Isi | Kriteria juri yang dijawab |
|---|---|---|---|
| 1 · Latar Belakang | 0:00–2:00 | Hook data, perkenalan tim, kasus hoaks TNI, tiga celah | Relevansi & Manfaat (25%) |
| 2 · Solusi | 2:00–5:45 | Apa itu NARASI, enam label, **live demo** | Fungsionalitas Purwarupa (25%) |
| 3 · Keunikan | 5:45–6:40 | Lima pembeda NARASI vs cara cek fakta yang ada | Inovasi Teknis (25%) |
| 4 · Teknologi | 6:40–8:00 | Alur sistem, stack, hasil uji beban, privasi | Inovasi Teknis (25%) |
| 5 · Outcome | 8:00–9:20 | Dampak bagi prajurit, Penerangan, pertahanan siber + kesiapan pasang | Kelayakan Implementasi (15%) + Relevansi |
| 6 · Penutupan | 9:20–10:00 | Kembali ke hook, tagline, terima kasih | — |
| Seluruh sesi | | | Kualitas Dokumentasi (10%): angka bersumber, repo + PRD + bukti uji tersedia |

> **Mau dipadatkan jadi 7 menit?** Latar Belakang 1:15, Solusi 2:45, Keunikan 0:45, Teknologi 1:00, Outcome 0:45, Penutupan 0:30. Lewati bagian bertanda *(opsional)*.

---

## 1 · LATAR BELAKANG (0:00–2:00)

**Slide 1:** layar hitam. Video Shorts "18.000 pasukan TNI dikirim ke Aceh" diputar tanpa suara. Lalu stempel merah **HOAKS** dan counter **"400+ hari sejak dibantah. Masih tayang."**

> *(Biarkan video jalan 3 detik, baru bicara.)*
>
> "Bapak-Ibu dewan juri, video ini bilang **delapan belas ribu pasukan TNI dikirim ke Aceh**.
>
> Faktanya? Ini latihan Yonkav 1 Kostrad di Baturaja. Komdigi sudah mencapnya **hoaks** sejak **1 Oktober 2025**.
>
> Tapi hari ini, **lebih dari 400 hari kemudian**, videonya **masih tayang**. *(jeda)* Bantahannya ada. Videonya juga ada. Masalahnya, dua-duanya nggak pernah ketemu di layar yang sama."

**Slide 2:** tiga angka besar, muncul satu-satu.

> "Sekarang lihat skalanya.
>
> - **229 juta** orang Indonesia sudah online. *(APJII 2025)*
> - Sekitar **194 juta** di antaranya pakai TikTok, rata-rata **hampir 2 jam sehari**. *(We Are Social/DataReportal 2025)*
> - Dalam setahun, Komdigi mencatat **1.674 hoaks**. Itu **4–5 hoaks baru setiap hari**, dan **341** di antaranya menyasar pemerintahan dan institusi negara. *(Komdigi, Okt 2024–Okt 2025)*
>
> Dan itu cuma yang **ketahuan**."

**Slide 3:** foto + peran.

> "Kami tim **PostgreMyself**. Saya **Raphael Diovana Tarigan**, full stack engineer, dan saya membangun **NARASI** dari ujung ke ujung: ekstensi browser, server analisis, sampai dashboard petugas."

**Slide 4: "Hoaks TNI itu nyata, dan datangnya beruntun."** Linimasa tiga kasus asli:

| Waktu | Kejadian | Sumber |
|---|---|---|
| 1 Okt 2025 | "18.000 pasukan TNI ke Aceh" dicap hoaks. Videonya masih tayang sampai hari ini | Laporan Isu Hoaks Komdigi |
| 5 Sep 2025 | Puspen TNI harus membantah **5 hoaks sekaligus** yang menuduh prajurit jadi provokator demo | Antara, RMOL |
| 25 Mar 2026 | Hoaks "Status TNI Siaga 1, warga siapkan stok" beredar di TikTok | Laporan Isu Hoaks Komdigi |

> "Ini bukan teori. Narasi palsu soal TNI muncul tiap ada momen genting, seperti demo, konflik global, atau bencana. Polanya selalu sama: **video pendek, nyebar dalam jam, bantahan datang dalam hari.**"

**Slide 5: "Kenapa cek fakta biasa kalah cepat?"** Tiga kolom:

> "Ada tiga celah:
>
> 1. **Hoaksnya ngumpet.** Caption-nya kelihatan aman, tapi klaimnya ada di **teks layar** dan **suara**. Tools cek fakta biasa cuma baca teks.
> 2. **Harus pindah tab.** Siapa yang mau berhenti scroll, buka Google, lalu cari situs cek fakta? Hampir nggak ada.
> 3. **Penerangan tahunya telat.** Tim Penerangan baru sadar setelah videonya viral, padahal momen emasnya ada di jam-jam pertama.
>
> Mafindo juga mencatat hoaks berbasis AI dan **deepfake** naik signifikan di 2025. Artinya celah ini makin lebar, bukan makin sempit.
>
> Ini serangan ke **domain kognitif**, medan keempat setelah darat, laut, dan udara. Dan di medan ini, prajurit dan keluarganya ada di garis depan setiap kali mereka scroll."

*(opsional, kalau hasil survei sudah masuk)* **Slide 5b:**
> "Kami juga survei **[n] prajurit dan ASN TNI**. **[x]%** pernah nemu hoaks yang mencatut TNI dalam 6 bulan terakhir, dan indeks urgensinya **[y]%**, kategori **[Sangat mendesak]**."

---

## 2 · SOLUSI (2:00–5:45)

**Slide 6: Reveal logo NARASI.** Pakai logo lengkap `docs/logo/narasi-logo.png`.

> "Jadi kami bikin **NARASI**. Isinya dua bagian:
>
> - **Ekstensi browser** untuk siapa saja yang nonton video di Instagram Reels, TikTok, YouTube Shorts, dan Facebook Reels. Ekstensi ini **membaca caption, membaca layar, dan mendengarkan suara** video, lalu menaruh **label berbasis bukti** langsung di atas caption. Nggak perlu pindah tab.
> - **Dashboard** untuk petugas Penerangan TNI AD, berisi video yang perlu segera ditangani.
>
> Yang dicek bukan cuma isu TNI. Kesehatan, politik, bencana, penipuan, isu luar negeri, bahkan video berbahasa asing juga ikut dicek. Tapi semua yang menyangkut TNI langsung naik ke meja Penerangan."

**Slide 6b: enam label NARASI** (tampilkan sebagai chip berwarna, 10 detik, cukup ditunjuk):

| Label | Artinya |
|---|---|
| **Indikasi Hoaks** | Ada bantahan resmi atau cek fakta yang menyatakan isinya keliru |
| **Perlu Diwaspadai** | Ada tanda mencurigakan: ajakan "sebarkan!", sumber tidak jelas, klaim dilebih-lebihkan |
| **Didukung Sumber** | Sesuai berita atau sumber resmi terpercaya |
| **Belum Terverifikasi** | Belum ada bukti yang membenarkan atau membantah |
| **Opini/Satire** | Candaan, parodi, atau pendapat pribadi |
| **Tanpa klaim** | Tidak ada pernyataan fakta yang perlu dicek |

> "Labelnya kami bikin sejelas mungkin. Dan yang paling penting: label **Indikasi Hoaks** cuma keluar kalau ada buktinya."

### Live demo (±2:50)

> **Persiapan (H-30 menit, jangan di depan juri):**
> 1. Klik dua kali `start_all.bat`. Dua jendela terbuka: server (:8000) dan dashboard (:5174). **Jangan ditutup.**
> 2. Ekstensi sudah di-*Load unpacked* dari `extension\.output\chrome-mv3` dan di-pin di toolbar. Di popup NARASI, pastikan semua platform dan label beranda menyala.
> 3. Pastikan **internet stabil** dan kunci AI di `backend/.env` aktif. Teks layar dan suara hanya dicek kalau layanan AI menyala.
> 4. **Restart server** sebelum tampil. Hasil pemeriksaan disimpan bersama, jadi kalau video sudah pernah dicek, labelnya langsung final dan momen "label naik" tidak kelihatan.
> 5. Siapkan 4 tab di Chrome/Edge (isi tautannya di tabel bawah, uji semuanya H-1):
>
> | Tab | Isi | Label yang diharapkan |
> |---|---|---|
> | 1 | YouTube Shorts `youtube.com/shorts/DwvC_FjYxoU` ("18.000 pasukan ke Aceh") | **Indikasi Hoaks · Mencatut TNI** |
> | 2 | Shorts resmi TNI AD (mis. kanal resmi TNI AD/Dispenad): `[tautan]` | **Didukung Sumber** atau **Belum Terverifikasi** |
> | 3 | Video satire/parodi atau opini: `[tautan]` | **Opini/Satire** atau **Tanpa klaim** |
> | 4 | Dashboard `http://localhost:5174` (monitor kedua kalau ada) | — |
>
> 6. **Soal data aman:** video yang diputar adalah konten publik yang **sudah dibantah resmi**. Laporan yang dikirim saat demo hanya masuk ke server lokal di laptop kami, bukan ke instansi mana pun. Sebutkan ini ke juri.
> 7. *(opsional)* Supaya dashboard terlihat "hidup", isi instans demo terpisah dengan lalu lintas simulasi: jalankan backend `--env-file demo.env` di port **8002**, dashboard `npm run dev -- --mode demo --port 5175`, lalu `uv run python scripts/seed_demo.py http://localhost:8002` (3.000 pemeriksaan dari 1.200 penonton **dummy** + laporan). Uji dulu H-1, karena tanpa kunci AI demo ini memakai daftar bantahan tersimpan.
> 8. **Cadangan:** rekaman demo asli `video/out/narasi-demo.mp4`. Putar hanya kalau jaringan atau laptop bermasalah.

> "Daripada cuma cerita, saya tunjukkan langsung. Ini **bukan mockup**. Ekstensinya jalan beneran, di YouTube beneran, pakai video hoaks yang tadi saya putar di awal."

**Demo 1: hoaks mencatut TNI (tab 1) · ±60 detik**
- Putar video Shorts. Hitung pelan dalam hati.
> "Perhatikan di atas caption. Label muncul dulu dari caption: **Belum Terverifikasi**, karena caption-nya sendiri kelihatan aman… *(tunggu)* … begitu tulisan di layarnya terbaca, label naik jadi **Indikasi Hoaks · Mencatut TNI**. Di rekaman kami, ini terjadi di **detik ke-4,8**. Lalu suaranya ikut dicek supaya hasilnya makin kuat."
- **Klik label**, panel rincian terbuka.
> "Ini rinciannya: **klaim apa** yang ditemukan di video, **sumber terpercaya** yang jadi bukti (bantahan resmi Komdigi), dan **kesimpulan** yang menyertakan tautan sumber. Siapa pun bisa mengeceknya sendiri. Jadi bukan sekadar 'kata AI'."

**Demo 2: tidak asal mencap hoaks (tab 2 & 3) · ±30 detik**
- Putar video resmi TNI AD.
> "Ini video resmi TNI AD. NARASI **tidak** asal mencap semua video soal TNI sebagai hoaks. Labelnya *[Didukung Sumber / Belum Terverifikasi]*."
- Putar video satire/opini.
> "Kalau candaan atau pendapat pribadi? Dilabeli **Opini/Satire**. Kita nggak memusuhi konten, kita cuma kasih konteks."

**Demo 3: lapor sekali klik · ±20 detik**
- Kembali ke tab 1 → panel rincian → **Laporkan ke TNI AD** → pilih alasan → kirim.
> "Prajurit atau warga cukup sekali klik. Laporannya **anonim**, identitas pelapor nggak ikut terkirim. Hasil analisisnya diambil dari server, jadi nggak bisa dipalsukan dari sisi pengguna."

**Demo 4: dashboard petugas · ±60 detik**
- Pindah ke tab Dashboard.
> "Dan ini sisi Penerangan. Di tab **Realtime**, video yang barusan kami tonton sudah lewat: dari video masuk sampai keputusan akhir, kelihatan langsung."
- Buka **Peringatan dini**, tunjuk laporan yang baru dikirim.
> "Laporan tadi sudah masuk. Video yang paling berbahaya atau paling cepat menyebar ada di urutan teratas. Makin banyak yang nonton dalam waktu singkat atau makin sering dilaporkan, prioritasnya makin naik, dan notifikasi bisa langsung terkirim ke Telegram petugas."
- Buka **Rekomendasi & simulasi**.
> "Untuk tiap narasi ada saran tindakan beserta alasannya, misalnya rilis klarifikasi, plus perkiraan berapa orang yang bisa terpapar kalau **ditindaklanjuti vs dibiarkan**. Angka simulasinya perkiraan, bukan pengukuran, tapi cukup untuk membantu memutuskan: **gerak sekarang, sebelum viral.**"
- Tunjuk **Laporan** sekilas.
> "Semua laporan masyarakat dilacak statusnya: baru, ditinjau, ditindaklanjuti, sampai ditutup."

*(opsional, kalau ada akun demo yang sudah login)* **Demo 5: beranda Instagram/Facebook · ±20 detik**
> Scroll beranda. "Di beranda Instagram dan Facebook, tiap postingan, entah tulisan, foto, atau video, juga dapat label kecil. Yang merah langsung kelihatan tanpa harus diklik."

## 3 · KEUNIKAN (5:45–6:40)

**Slide 7: "Apa bedanya dengan cek fakta yang sudah ada?"** Tabel perbandingan, kolom NARASI disorot:

| | Situs cek fakta / cek manual | Moderasi platform | **NARASI** |
|---|---|---|---|
| Di mana dicek | Harus pindah tab dan cari sendiri | Di balik layar, tidak terlihat | **Langsung di atas caption** |
| Yang dibaca | Teks | Tergantung platform | **Caption + teks layar + suara** |
| Dasar label | Artikel per kasus | Kebijakan internal | **Bukti bersitasi**, tautan bisa dicek |
| Kecepatan | Jam sampai hari | Tidak menentu | **±0,1 dtk label awal**, final dalam hitungan detik |
| Untuk TNI AD | Tidak ada | Tidak ada | **Peringatan dini + rekomendasi aksi** untuk Penerangan |

> "Jadi apa yang bikin NARASI beda? Lima hal:
>
> 1. **Ada di tempat hoaksnya beredar.** Label muncul di atas caption, saat video diputar. Nggak ada yang perlu pindah tab.
> 2. **Multimodal.** Caption, layar, *dan* suara. Tadi kita lihat sendiri: caption-nya aman, tapi hoaksnya ketahuan dari teks di layar.
> 3. **Hoaks hanya lahir dari bukti.** Label *Indikasi Hoaks* cuma keluar kalau ada bantahan resmi atau cek fakta. AI tidak boleh memvonis sendiri. Ini penting supaya TNI nggak dituduh menyensor.
> 4. **Tahan salah cocok.** Video *'baksos TNI di Aceh'* **tidak** ikut dicap hoaks walau kata-katanya mirip *'TNI serang Aceh'*. Kasus ini masuk tes otomatis kami.
> 5. **Dua sisi dalam satu sistem.** Penonton dapat label, dan di saat yang sama Penerangan TNI AD dapat **peringatan dini**: narasi mana yang naik cepat, berapa yang nonton, dan aksi apa yang disarankan."

---

## 4 · TEKNOLOGI (6:40–8:00)

**Slide 8: diagram alur sistem** (pakai urutan yang sama dengan diagram realtime di dashboard):

```
[Video di IG Reels / TikTok / YT Shorts / FB Reels]
        │  Extension NARASI (WXT + React + TS, Manifest V3)
        │  ambil: caption · frame 480px · potongan audio
        ▼
[Backend FastAPI]  ──SSE──▶  badge di layar (label awal ±0,1 dtk → label final)
   1. Ekstraksi klaim   : heuristik + LLM (Groq qwen3.8-27b, cadangan Gemini)
   2. OCR teks layar    : LLM vision, sekali per video
   3. Transkripsi suara : Whisper large-v3-turbo
   4. Cari bukti        : korpus Komdigi & PPID TNI AD · RSS TurnBackHoax/Mafindo,
                          Snopes, PolitiFact · Google Fact Check · Tavily · Google News
   5. Pencocokan        : embedding Gemini + aturan "beda peristiwa ≠ cocok"
   6. Vonis + kesimpulan bersitasi
        ▼
[Redis cache kolektif] + [SQLite laporan & sinyal penonton]
        ▼
[Dashboard Mode Satuan (React + Vite + Tailwind + shadcn + Recharts)]
   realtime · prioritas · rekomendasi aksi + simulasi · antrean laporan
        ▼
[Webhook Telegram ke petugas Penerangan]
```

> "Alurnya begini. Extension nangkep **tiga sinyal**: caption, frame layar, dan audio. Semuanya dikirim ke backend FastAPI kami.
>
> Di backend, klaim diekstrak, teks layar dibaca, suara ditranskripsi, lalu klaim itu **dicari buktinya** dari enam sumber sekaligus, mulai dari korpus resmi Komdigi dan PPID TNI AD sampai feed pemeriksa fakta internasional.
>
> Hasilnya didorong balik ke layar lewat **Server-Sent Events**. Jadi labelnya **makin akurat seiring waktu**: label awal keluar dalam ±0,1 detik, lalu naik jadi final setelah layar dan suara selesai dicek."

**Slide 9: siap skala satuan.** Tiga angka besar:

> "Kalau satu video viral dibuka ratusan prajurit sekaligus, permintaannya digabung jadi **satu panggilan AI** (*singleflight*) dan hasilnya disimpan di cache kolektif. Hasil uji kami:
>
> - **1.000 prajurit serentak: 0 galat.** Server mengirim label pertama dalam **p50 4,3 ms**.
> - Pemakaian AI **hemat 97,9%**: 83 permintaan, bukan ±4.046.
> - Uji dengan API asli: 20 prajurit buka video yang sama, cukup **1 panggilan LLM**.
>
> Dan NARASI **nggak pernah blank**. Kalau kuota AI habis atau internet putus, label tetap keluar dari daftar bantahan resmi yang tersimpan dan pola bahasa."

**Slide 10: privasi** *(opsional, 15 detik)*:
> "Kami **tidak menyimpan video** siapa pun dan tidak membaca akun. Penonton dihitung pakai hash ID instalasi acak. Laporan ke TNI AD anonim."

---

## 5 · OUTCOME (8:00–9:20)

**Slide 11: dampak nyata.**

> "Dampaknya ada di tiga lapis:
>
> - **Prajurit & keluarga:** jadi tameng kognitif langsung di layar, sehingga nggak ikut menyebarkan hoaks yang mencatut institusinya sendiri.
> - **Penerangan TNI AD:** dapat **sistem peringatan dini**, tahu narasi mana yang naik cepat, punya bukti siap pakai, dan punya rekomendasi aksi.
> - **Pertahanan siber nasional:** data agregat narasi per topik bisa jadi bahan analisis operasi informasi, dan bisa diperluas ke matra lain, Puspen TNI, atau Komdigi."

**Slide 12: siap dipasang di satuan.** Tiga kartu:

> "Dan ini bukan cuma purwarupa. Bisa dipakai beneran:
>
> 1. **Pasang serentak.** Lewat kebijakan Chrome/Edge Enterprise, extension bisa di-*force install* ke semua perangkat satuan tanpa prajurit perlu setting apa-apa.
> 2. **Server sendiri.** Satu `docker-compose` (API + Redis + dashboard). Cukup **2 vCPU dan 2 GB RAM** untuk ratusan prajurit, dan bisa **on-premise** di server satuan.
> 3. **Gampang dipakai & dirawat.** Buat pengguna, tinggal nonton seperti biasa; platform yang dicek bisa diatur dari ikon NARASI. Buat petugas, cukup klik `start_all.bat` atau satu `docker-compose`. Kalau platform medsos ganti tampilan, perbaikannya cukup di satu adapter.
>
> **Langkah berikutnya:** uji coba di satu Kodim atau satu Dispen selama 30 hari, menambah korpus bantahan bersama PPID TNI AD, lalu memperluas deteksi deepfake."

---

## 6 · PENUTUPAN (9:20–10:00)

**Slide 13: penutup.** Logo lengkap + tagline *Verification & Narrative Insights*.

> "Ingat video tadi? **Lebih dari 400 hari** setelah dibantah, masih tayang.
>
> Kita nggak bisa menghapus semua hoaks. Tapi kita bisa memastikan **bantahannya muncul di layar yang sama, di detik yang sama**.
>
> **NARASI: scroll tetap jalan, hoaks nggak lolos.** Saya Raphael dari tim PostgreMyself. Terima kasih."

---

## Kartu Q&A (persiapan jawaban)

| Pertanyaan juri | Jawaban singkat |
|---|---|
| "Bagaimana kalau AI-nya salah?" | Label hoaks **hanya** dari bukti cek fakta atau bantahan resmi. Berita biasa cuma bisa mendukung. Label dari gaya bahasa atau AI hanya peringatan awal, bukan vonis. NARASI itu alat bantu; sumbernya selalu ditautkan supaya bisa dicek sendiri. |
| "Ini sensor?" | Tidak. Konten tidak dihapus atau diblokir. Kami cuma menaruh label + sumber, dan pengguna tetap memutuskan. |
| "Biaya API kalau ribuan prajurit?" | Singleflight + cache kolektif: 2.000 pemeriksaan cuma 83 permintaan AI. Ada pagar kuota per menit/hari, dan kalau habis, otomatis pakai heuristik. |
| "Data prajurit aman?" | Tidak menyimpan video, tidak membaca akun, ID penonton di-hash, laporan anonim, bisa on-premise. |
| "Sudah dites di platform asli?" | Ya, demo tadi di YouTube Shorts asli. Ekstensi mendukung IG Reels, TikTok, YT Shorts, FB Reels, plus beranda IG/FB. Kalau platform mengubah tampilan, perbaikannya cukup di satu adapter. |
| "Kalau kuota AI habis?" | Label tetap keluar dari daftar bantahan resmi dan pola bahasa. Pemeriksaan teks layar/suara yang terlewat dicatat di panel rincian, jadi pengguna tahu. |
| "Hoaks yang benar-benar baru?" | Bisa masih *Belum Terverifikasi* sampai bantahan terbit. Tapi kalau gaya bahasanya provokatif jadi *Perlu Diwaspadai*, dan kalau penontonnya melonjak langsung naik ke Peringatan dini, sehingga Penerangan bisa membuat bantahannya duluan. |
| "Bahasa daerah/asing?" | Bahasa dideteksi otomatis, klaim diterjemahkan ke Bahasa Indonesia, dan bukti dicari dalam bahasa aslinya. |

## Sumber data (cantumkan kecil di pojok slide)

- APJII 2025: 229,43 juta pengguna internet, penetrasi 80,66%. [Bisnis.com](https://teknologi.bisnis.com/read/20250806/101/1899997/data-apjii-pengguna-internet-di-indonesia-tembus-22943-juta-orang-pada-2025)
- TikTok Indonesia ±194 juta pengguna (We Are Social/Meltwater, Jul 2025); 1 jam 53 menit/hari (DataReportal, Agu 2025). [RRI](https://rri.co.id/kupang/hiburan/1757559/indonesia-puncaki-daftar-pengguna-tiktok-terbanyak-dunia-2025), [GoodStats](https://goodstats.id/article/berapa-lama-orang-indonesia-habiskan-waktu-untuk-scroll-tiktok-dalam-sehari-bGKAs)
- Komdigi: 1.674 hoaks (22 Okt 2024–20 Okt 2025), 589 penipuan, 341 pemerintahan. [JawaPos](https://jawapos.com/nasional/2607250344/komdigi-temukan-1674-hoaks-publik-diminta-lebih-kritis-menyikapi-informasi-di-media-sosial)
- Mafindo: 1.593 hoaks (21 Okt 2024–19 Okt 2025), deepfake & scam dominan. [Katadata](https://katadata.co.id/amp/digital/teknologi/68fc642383ae9/mafindo-ungkap-deepfake-dan-scam-warnai-tahun-pertama-prabowo-gibran/), [Times Indonesia](https://timesindonesia.co.id/peristiwa-nasional/561378/deepfake-dan-digital-scam-dominasi-lanskap-hoaks-nasional-2025)
- Puspen TNI bantah 5 hoaks demo (Sep 2025). [Antara Jogja](https://jogja.antaranews.com/berita/766529/tni-bantah-lima-informasi-viral-yang-menyebut-tni-terlibat-aksi-demo), [RMOL](https://rmol.id/pertahanan/read/2025/09/06/679009/tni-bantah-deretan-hoaks-terkait-prajurit-dalam-demo-anarkis)
- Hoaks "Siaga 1 TNI" (Mar 2026). [Bisnis.com](https://kabar24.bisnis.com/read/20260326/621/1962354/komdigi-ungkap-hoaks-siaga-1-tni-hingga-isu-bbm-rp16000)
- Kasus "18.000 pasukan ke Aceh": Laporan Isu Hoaks Komdigi 1 Okt 2025 (sudah ada di `backend/data/corpus.json`).
- Angka performa NARASI: `docs/KESIAPAN-PRODUKSI.md` dan `docs/bukti/`.

> **Cek sebelum tampil:** pastikan video Shorts `DwvC_FjYxoU` masih tayang dan hitung ulang jumlah harinya (per 11 Nov 2026 = **406 hari**). Kalau videonya sudah turun, ganti kalimatnya jadi *"butuh lebih dari 400 hari sampai videonya hilang"*.

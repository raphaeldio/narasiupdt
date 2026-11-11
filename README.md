# NARASI — Cek Hoaks Video Pendek

NARASI membantu kamu mengecek apakah video pendek yang sedang ditonton berisi hoaks atau tidak. Cukup nonton
seperti biasa di **Instagram Reels, TikTok, YouTube Shorts, atau Facebook Reels**, nanti NARASI menaruh label
kecil di atas caption video yang memberi tahu seberapa besar kemungkinan video itu hoaks.

Semua topik dicek, bukan cuma soal TNI: kesehatan, politik, bencana, penipuan, isu luar negeri, dan lainnya.
Video berbahasa asing juga bisa.

NARASI terdiri dari dua bagian:

- **Ekstensi browser**: dipasang di Chrome atau Edge, untuk siapa saja yang menonton video.
- **Dashboard**: halaman pantauan untuk petugas Penerangan TNI AD, berisi video yang perlu segera ditangani.

---

## Cara memakai

### 0. Persiapan (cukup sekali)

Pastikan dua alat ini sudah terpasang di Windows:

- **uv** (pengelola Python): https://docs.astral.sh/uv/getting-started/installation/
- **Node.js 20+**: https://nodejs.org

Saat `start_all.bat` pertama kali dijalankan, dependensi server (`uv sync`) dan dashboard (`npm install`) akan
dipasang otomatis. Ekstensi sudah tersedia dalam bentuk siap pakai di `extension\.output\chrome-mv3`, jadi tidak
perlu di-build.

NARASI tetap jalan tanpa kunci API (memakai daftar bantahan tersimpan). Untuk hasil penuh, salin
`backend\.env.example` menjadi `backend\.env` lalu isi kunci yang ada (Gemini, Groq, dan lainnya).

### 1. Nyalakan NARASI

Klik dua kali file **`start_all.bat`** di folder ini. Dua jendela hitam akan terbuka, yaitu server NARASI dan
dashboard. **Biarkan keduanya tetap terbuka** selama NARASI dipakai.

### 2. Pasang ekstensi (cukup sekali)

1. Buka Chrome atau Edge, lalu ketik `chrome://extensions` (di Edge: `edge://extensions`) di kolom alamat.
2. Nyalakan **Developer mode** di pojok kanan atas.
3. Klik **Load unpacked**, lalu pilih folder `extension\.output\chrome-mv3` di dalam folder NARASI.
4. Ikon NARASI muncul di toolbar browser. Klik ikon puzzle lalu pin NARASI supaya gampang diakses.

### 3. Tonton video seperti biasa

Buka Instagram, TikTok, YouTube Shorts, atau Facebook. Saat video diputar, label NARASI muncul di atas caption.

| Label | Artinya |
|---|---|
| **Indikasi Hoaks** | Ada bantahan resmi atau hasil cek fakta yang menyatakan isinya keliru |
| **Perlu Diwaspadai** | Ada tanda-tanda mencurigakan, misalnya ajakan "sebarkan!", sumber tidak jelas, atau klaim yang dilebih-lebihkan |
| **Didukung Sumber** | Isinya sesuai dengan berita atau sumber resmi yang terpercaya |
| **Belum Terverifikasi** | Belum ditemukan bukti yang membenarkan atau membantah |
| **Opini/Satire** | Konten candaan, parodi, atau pendapat pribadi |
| **Tanpa klaim** | Video tidak berisi pernyataan fakta yang perlu dicek |

**Klik labelnya** untuk melihat rinciannya: klaim apa yang ditemukan di video, sumber terpercaya yang dipakai
sebagai bukti, dan kesimpulannya. Setiap kesimpulan menyertakan tautan sumber, jadi kamu bisa mengeceknya sendiri.

### 4. Beranda Instagram dan Facebook

Di beranda Instagram dan Facebook, setiap postingan (tulisan, foto, maupun video) juga mendapat label kecil.
Klik labelnya untuk pemeriksaan lebih lengkap. Fitur ini bisa dimatikan lewat ikon NARASI di toolbar.

### 5. Laporkan ke TNI AD

Kalau video berkaitan dengan TNI atau terindikasi hoaks, di panel rincian ada tombol **Laporkan ke TNI AD**.
Pilih alasannya, tambahkan catatan bila perlu, lalu kirim. Laporan bersifat **anonim**, identitasmu tidak ikut
terkirim.

### Pengaturan ekstensi

Klik ikon NARASI di toolbar untuk:

- menyalakan atau mematikan NARASI,
- memilih platform mana saja yang dicek,
- menyalakan atau mematikan label di beranda Instagram dan Facebook.

---

## Dashboard untuk petugas

Buka **http://localhost:5174** di browser. Dashboard berisi:

- **Realtime**: aliran video yang sedang dicek, dari video masuk sampai keputusan akhir, terlihat langsung.
- **Rangkuman**: kondisi saat ini, jumlah pemeriksaan per jam, isu terbanyak per topik, dan narasi yang perlu
  ditangani.
- **Peringatan dini**: video yang paling berbahaya atau paling cepat menyebar ada di urutan teratas. Video yang
  ditonton makin banyak orang dalam waktu singkat atau sering dilaporkan akan naik prioritasnya.
- **Rekomendasi & simulasi**: saran tindakan untuk tiap narasi beserta alasannya, dan perkiraan berapa banyak
  orang yang bisa terpapar bila ditindaklanjuti atau dibiarkan. Angka simulasi ini perkiraan, bukan hasil
  pengukuran.
- **Laporan**: daftar laporan dari masyarakat, lengkap dengan statusnya (baru → ditinjau → ditindaklanjuti →
  ditutup).

---

## Bagaimana NARASI menentukan label

NARASI tidak menebak. Untuk setiap video, NARASI:

1. **Mengambil pernyataan penting** dari caption, tulisan di layar, dan suara di video.
2. **Mencari bukti** dari banyak sumber sekaligus: bantahan resmi Komdigi dan PPID TNI AD, situs cek fakta
   (TurnBackHoax/Mafindo, Snopes, PolitiFact, Full Fact, Lead Stories), Google Fact Check, dan berita dari media
   terpercaya.
3. **Memeriksa gaya bahasa** yang sering dipakai hoaks, seperti desakan untuk menyebarkan, sumber anonim, atau
   klaim yang terlalu mutlak.
4. **Menyimpulkan** dan menampilkan sumbernya.

Label **Indikasi Hoaks hanya diberikan bila ada bukti** dari halaman cek fakta atau bantahan resmi. Berita biasa
hanya bisa mendukung, tidak bisa menjadikan sesuatu hoaks. Label dari gaya bahasa atau penilaian AI hanya
peringatan awal, bukan vonis.

Hasil pemeriksaan disimpan bersama, sehingga video yang sama tidak perlu dicek ulang dan hasilnya langsung
muncul untuk pengguna berikutnya.

---

## Hal yang perlu diketahui

- **Internet diperlukan.** Tanpa internet, NARASI hanya bisa memakai daftar bantahan resmi yang sudah tersimpan.
- **Tulisan di layar dan suara video** hanya diperiksa bila layanan AI sudah diaktifkan oleh pengelola. Bila
  kuota layanan AI sedang habis, sebagian pemeriksaan dilewati dan catatannya muncul di panel rincian.
- **Hoaks yang benar-benar baru** mungkin masih berlabel "Belum Terverifikasi" sampai ada bantahan atau cek fakta
  yang terbit.
- **Tampilan Instagram, TikTok, dan Facebook bisa berubah sewaktu-waktu.** Bila label tidak muncul di salah satu
  platform, kemungkinan platform tersebut baru saja mengubah tampilannya.
- NARASI adalah **alat bantu**, bukan penentu kebenaran mutlak. Selalu cek sumber yang ditautkan sebelum
  menyimpulkan.

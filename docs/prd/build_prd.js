const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, HeadingLevel, LevelFormat, BorderStyle, Footer,
  PageNumber, TableLayoutType, VerticalAlign,
} = require("docx");

const NAVY = "17324D";
const LIGHT = "F3F7FA";
const BORDER = "C9D3DD";
const CONTENT_W = 9792; // 12240 - 2*1224
const FONT = "Arial";

// "**tebal**" -> run tebal
function runs(text, base = {}) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
    part.startsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true, ...base })
      : new TextRun({ text: part, ...base }));
}

const P = (text, opts = {}) => new Paragraph({
  children: runs(text, opts.run || {}),
  spacing: { after: 120, line: 276 },
  alignment: opts.align,
});
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullets = (items) => items.map((t) => new Paragraph({
  numbering: { reference: "bullet", level: 0 }, children: runs(t), spacing: { after: 60, line: 264 },
}));
let numCount = 0;
const numbered = (items) => {
  const ref = `num${++numCount}`;
  numberingConfigs.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360, hanging: 360 } } } }],
  });
  return items.map((t) => new Paragraph({
    numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 264 },
  }));
};
const callout = (text) => new Paragraph({
  children: runs(text),
  shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 8 } },
  spacing: { before: 120, after: 160, line: 276 },
  indent: { left: 120, right: 120 },
});

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
};

// widths: bobot relatif per kolom, diskalakan ke lebar konten
function table(headers, rows, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * CONTENT_W));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const mkCell = (text, i, header, zebra) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    borders: cellBorders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: header
      ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY }
      : zebra ? { type: ShadingType.CLEAR, color: "auto", fill: LIGHT } : undefined,
    children: String(text).split("\n").map((line) => new Paragraph({
      children: runs(line, header ? { bold: true, color: "FFFFFF", size: 18 } : { size: 18 }),
      spacing: { after: 20, line: 240 },
    })),
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => mkCell(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => mkCell(c, i, false, ri % 2 === 1)) })),
    ],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });

const numberingConfigs = [{
  reference: "bullet",
  levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
}];

// ---------------------------------------------------------------- konten
const body = [];
const add = (...xs) => xs.flat().forEach((x) => body.push(x));

// Judul
add(
  new Paragraph({ children: [new TextRun({ text: "PRODUCT REQUIREMENTS DOCUMENT", bold: true, color: NAVY, size: 20 })], spacing: { after: 60 } }),
  new Paragraph({ children: [new TextRun({ text: "NARASI Browser Extension", bold: true, color: NAVY, size: 48 })], spacing: { after: 60 } }),
  new Paragraph({ children: [new TextRun({ text: "AI Powered Real Time Multimodal Misinformation Detection  |  Cognitive Domain 04 Siber Sosial", size: 22, color: "44556A" })], spacing: { after: 120 } }),
  new Paragraph({
    children: runs("Versi 2.1  ·  28 Oktober 2026  ·  Target submission 15 November 2026", { size: 20 }),
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: runs("Pemilik konsep: Raphael Diovana Tarigan  |  Status: PRD MVP v2 untuk implementasi hackathon", { size: 20 }),
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 6 } },
    spacing: { after: 240 },
  }),
);

add(callout("**Perubahan utama dari v1:** (1) analisis multimodal bertahap (teks, teks di layar, audio) atas video yang sedang diputar; (2) mendukung Instagram Reels, TikTok, dan YouTube Shorts melalui adapter per platform; (3) Indeks Indikasi Hoaks (persentase) yang dihitung transparan dari bukti; (4) panel bukti + kesimpulan berbasis sumber; (5) fitur Laporan & Peringatan Dini agar Penerangan TNI AD mengetahui hoaks yang mencatut TNI sebelum viral; (6) penegasan relevansi pengamanan informasi TNI AD, tech stack final, dan pemetaan eksplisit ke rubrik penilaian."));

// 1
add(H1("1  Ringkasan Produk"));
add(P("NARASI adalah ekstensi Chrome yang otomatis aktif ketika pengguna membuka platform video pendek versi web (Instagram Reels, TikTok, YouTube Shorts). NARASI hanya menganalisis **satu video yang sedang diputar**: membaca caption, mengenali teks di layar dari beberapa frame, dan mentranskripsi potongan audio. Klaim faktual dari ketiga sumber itu dicocokkan ke Google Fact Check Tools API dan situs pemeriksa fakta terpercaya, lalu hasilnya ditampilkan sebagai **badge persentase indikasi hoaks di atas caption**. Saat badge diklik, muncul panel berisi bukti dari sumber terpercaya dan kesimpulan singkat yang disusun hanya dari bukti tersebut."));
add(P("Hasil muncul bertahap agar pengalaman menonton tidak terganggu: label awal dari caption dalam ±2 detik, diperkaya teks di layar (±4 detik) dan audio (±10 detik). Video yang sudah pernah diperiksa pengguna lain muncul dari cache dalam <0,5 detik. Data pengguna tidak dikirim: yang diproses hanya konten publik video tersebut, dan media mentah dihapus segera setelah diproses."));
add(P("Untuk TNI AD, NARASI juga berfungsi sebagai **sistem peringatan dini**: pengguna dapat melaporkan video ke Penerangan TNI AD langsung dari panel bukti, dan video terkait TNI yang mulai banyak diperiksa otomatis naik ke antrean petugas beserta notifikasi, sehingga klarifikasi resmi dapat disiapkan sebelum konten viral."));

// 2
add(H1("2  Masalah, Peluang, dan Relevansi bagi TNI AD"));
add(P("Video pendek adalah kanal utama penyebaran narasi palsu: dikonsumsi cepat, emosional, dan klaimnya sering hanya ada di audio atau teks di layar, bukan di caption. Pemeriksaan fakta manual mengharuskan pengguna berpindah tab, merumuskan kata kunci, dan menilai sumber, sehingga hampir tidak pernah dilakukan sebelum konten dipercaya atau dibagikan."));
add(H2("Relevansi terhadap pengamanan IT/OT TNI AD"));
add(P("Pengamanan TNI AD tidak berhenti di jaringan dan perangkat; **domain kognitif/informasi** adalah permukaan serangan yang dieksploitasi lewat operasi informasi. Contoh publik: hoaks \"TNI akan menyerang Aceh 1 November 2026\" yang dibantah Komdigi, serta isu viral yang memerlukan klarifikasi resmi satuan. NARASI memposisikan diri sebagai **lapisan pengamanan di endpoint** (browser personel dan masyarakat) terhadap ancaman tersebut:"));
add(bullets([
  "**Ancaman yang ditangani:** hoaks yang mencatut institusi/pejabat TNI, pemalsuan pernyataan, provokasi yang memecah kepercayaan publik, dan konten pancingan rekayasa sosial yang menyasar personel dan keluarga.",
  "**Prioritas entitas TNI:** watchlist satuan, Kodam, dan pejabat publik TNI; klaim yang menyebut TNI diberi tag \"Mencatut TNI\" dan sumber resmi (PPID TNI AD, Puspen TNI) berbobot tertinggi.",
  "**Mode Satuan:** dashboard agregat anonim bagi fungsi Penerangan (Dispenad/Pendam) untuk memantau tren hoaks terkait TNI yang sedang beredar, sebagai bahan klarifikasi cepat.",
  "**Laporan & peringatan dini:** pengguna melaporkan video ke Penerangan TNI AD dari panel bukti; sistem juga menandai video terkait TNI yang penonton uniknya naik cepat, sehingga petugas menerima peringatan (dashboard dan Telegram) sebelum konten viral.",
  "**Kedaulatan data:** backend dapat dijalankan on-premise di server satuan; komponen AI dapat diganti model self-hosted (lihat Bagian 12).",
]));

// 3
add(H1("3  Tujuan dan Non-Tujuan"));
add(table(["Tujuan MVP", "Bukan tujuan MVP"], [
  ["Menampilkan indikasi hoaks berbasis bukti saat video masih diputar", "Memberi vonis pasti benar/hoaks untuk seluruh video"],
  ["Menganalisis teks, teks di layar, dan audio hanya dari video aktif", "Memantau semua video atau riwayat tontonan pengguna"],
  ["Menyajikan bukti yang dapat dibuka dan kesimpulan bersitasi", "Menentukan niat, identitas buzzer, atau akun bot"],
  ["Menyatakan \"Belum terverifikasi\" bila bukti tidak memadai", "Menghapus, menyensor, atau melaporkan unggahan secara otomatis"],
  ["Respons cepat tanpa mengganggu scroll dan kontrol video", "Deteksi deepfake (hanya studi kelayakan, P2)"],
], [1, 1]));

// 4
add(H1("4  Pengguna dan Use Case"));
add(table(["Persona", "Kebutuhan", "Skenario"], [
  ["Masyarakat penonton video pendek", "Tahu cepat apakah video bermasalah tanpa pindah tab", "Melihat badge di atas caption saat scroll Reels/TikTok/Shorts"],
  ["Personel TNI AD dan keluarga", "Terlindung dari hoaks dan provokasi yang mencatut TNI", "Badge \"Mencatut TNI\", bantahan resmi PPID TNI AD, dan tombol \"Laporkan ke TNI AD\""],
  ["Petugas Penerangan satuan", "Mengetahui hoaks terkait TNI sebelum viral", "Menerima peringatan dini dan laporan di dashboard/Telegram, lalu menyiapkan klarifikasi"],
  ["Relawan literasi digital", "Menunjukkan bukti secara transparan", "Membuka panel bukti dan membagikan tautan sumber"],
], [1.1, 1.3, 1.6]));

// 5
add(H1("5  USP, Inovasi Teknis, dan Hipotesis"));
add(P("**USP: Zero-Switch, Evidence-Based, Multimodal Fact Checking** — pemeriksaan fakta dibawa ke video yang sedang ditonton, mencakup klaim yang hanya diucapkan atau ditulis di layar, dengan skor yang dapat diaudit sampai ke sumbernya."));
add(table(["Inovasi", "Penjelasan", "Mengapa berbeda"], [
  ["Verifikasi in-context multimodal", "Caption + OCR frame + transkrip audio digabung menjadi klaim terstruktur", "Kebanyakan alat cek fakta hanya menerima teks yang diketik manual"],
  ["Skor berbasis bukti yang dapat diaudit", "Indeks dihitung dari rating sumber, kecocokan klaim, dan kredibilitas; rumus terbuka", "Bukan probabilitas black-box dari satu model AI"],
  ["Pencocokan konteks", "Entitas, waktu, dan lokasi klaim dibandingkan dengan bukti", "Mencegah bantahan peristiwa lain dipakai untuk video ini"],
  ["Hasil progresif via streaming", "Label awal ±2 dtk, diperbarui saat OCR/audio selesai", "Pengguna tidak menunggu seluruh pipeline"],
  ["Cache kolektif per video", "Video publik yang sama tidak dianalisis ulang", "Video viral, yang paling berbahaya, justru paling cepat"],
  ["Adapter per platform", "Satu pipeline untuk Instagram, TikTok, YouTube Shorts", "Platform baru cukup satu adapter ±100 baris"],
  ["Peringatan dini berbasis kecepatan sebaran", "Penonton unik per jam (hash anonim) + laporan pengguna menjadi prioritas tinggi/sedang/rendah", "Petugas tahu sebelum viral, bukan setelah trending"],
  ["Privacy-by-design", "Hanya konten video aktif; media mentah retensi 0", "Tidak membaca akun, cookie, DM, atau riwayat"],
], [1.1, 1.6, 1.4]));
add(gap());
add(bullets([
  "**H1:** badge + panel bukti mempercepat penemuan klarifikasi relevan dibanding pencarian manual.",
  "**H2:** badge tidak mengganggu interaksi dasar (scroll, like, komentar, volume).",
  "**H3:** pencocokan konteks menurunkan salah atribusi pada klaim yang mirip kata tetapi beda peristiwa.",
  "**H4:** analisis audio/teks di layar meningkatkan cakupan klaim yang terdeteksi dibanding caption saja.",
]));

// 6
add(H1("6  Cakupan Platform dan Fitur"));
add(H2("6.1 Platform yang didukung"));
add(P("Setiap platform ditangani oleh **adapter** yang hanya mengurus tiga hal: menemukan video aktif, membaca ID video + caption, dan menentukan titik tempel badge di atas caption. Pipeline analisis di backend dipakai bersama."));
add(table(["Platform", "Pola URL", "ID video", "Prioritas"], [
  ["Instagram Reels", "instagram.com/reels/*, /reel/*", "shortcode", "P0"],
  ["TikTok web", "tiktok.com/* (For You, /video/{id})", "video id", "P0"],
  ["YouTube Shorts", "youtube.com/shorts/*", "video id; caption otomatis YouTube dipakai bila tersedia", "P0"],
  ["Facebook Reels", "facebook.com/reel/*", "reel id", "P1"],
  ["X/Twitter video", "x.com/*/status/*", "status id", "P2"],
], [1.1, 1.6, 1.6, 0.6]));
add(H2("6.2 Persyaratan fungsional"));
add(table(["ID", "Prio", "Fitur", "Perilaku detail", "Kriteria terima"], [
  ["FR01", "P0", "Aktif otomatis di platform video pendek", "Content script hanya pada domain di 6.1; ikon hijau saat aktif; popup berisi toggle per platform dan mode \"caption saja\"", "Tidak berjalan di domain lain; dapat dimatikan dalam 1 klik"],
  ["FR02", "P0", "Deteksi video aktif", "IntersectionObserver (≥60% terlihat) + event play; ID dari URL/DOM; debounce 600 ms saat scroll cepat", "Hanya 1 video dianalisis; ganti video membatalkan request lama"],
  ["FR03", "P0", "Ekstraksi teks", "Caption, hashtag, judul audio; teks di layar dari 3–5 frame (detik 1, 3, 5, …)", "Caption <100 ms; OCR ≤4 dtk"],
  ["FR04", "P0", "Ekstraksi audio", "captureStream() pada elemen video → MediaRecorder di content script; 15 dtk pertama, tiap potongan 5 dtk direkam sebagai berkas utuh", "Transkrip parsial ≤10 dtk; audio dihapus setelah diproses"],
  ["FR05", "P0", "Ekstraksi klaim", "LLM menggabungkan caption, OCR, transkrip → maks. 3 klaim faktual (siapa, apa, kapan, di mana); opini/satire ditandai", "Output JSON valid; klaim non-faktual tidak dicek"],
  ["FR06", "P0", "Pencarian bukti", "Google Fact Check claims:search (id dan en) + pencarian terbatas pada whitelist situs terpercaya", "Setiap bukti memiliki URL, penerbit, tanggal, rating"],
  ["FR07", "P0", "Pencocokan konteks", "Similarity embedding + aturan entitas/waktu/lokasi; skor kecocokan 0–1; <0,6 dibuang", "Bukti beda peristiwa tidak dipakai"],
  ["FR08", "P0", "Indeks Indikasi Hoaks", "Persentase 0–100% sesuai Bagian 8; tanpa bukti cukup → \"Belum terverifikasi\"", "Rumus terdokumentasi; tidak pernah tampil \"0% = aman\""],
  ["FR09", "P0", "Badge di atas caption", "Pill berwarna + persen + ikon; status loading bertahap (\"Membaca teks…\", \"Mendengar audio…\")", "Tidak menutup tombol like/komentar/share/volume"],
  ["FR10", "P0", "Panel bukti + kesimpulan", "Klik badge → klaim terdeteksi, daftar sumber (penerbit, judul, rating, tanggal, link), kesimpulan 2–3 kalimat bersitasi [1][2], tombol \"Laporkan tidak relevan\"", "Kesimpulan hanya dari bukti yang ditampilkan; link di tab baru"],
  ["FR11", "P0", "Error dan stale handling", "Timeout per tahap; gagal jaringan → badge abu \"Gagal memeriksa\"; ganti video → badge dibersihkan", "0 label video lama muncul di video baru"],
  ["FR12", "P1", "Cache kolektif", "Hasil disimpan per platform+ID video dan per hash klaim di Redis (TTL 7 hari)", "Video yang sudah dicek tampil <500 ms"],
  ["FR13", "P1", "Prioritas TNI", "Watchlist entitas TNI; sumber PPID TNI AD/Puspen berbobot tertinggi; tag \"Mencatut TNI\"", "Klaim terkait TNI ditandai dan sumber resmi diutamakan"],
  ["FR14", "P0", "Mode Satuan (dashboard petugas)", "Dashboard web: ringkasan, peringatan dini, antrean laporan dengan status tindak lanjut, grafik per jam", "Tidak menyimpan identitas penonton"],
  ["FR18", "P0", "Laporan & peringatan dini ke TNI AD", "Tombol \"Laporkan ke TNI AD\" di panel (alasan + catatan, anonim); prioritas otomatis dari penonton unik per jam dan jumlah laporan; status baru → ditinjau → ditindaklanjuti → ditutup; webhook ke kanal petugas (mis. Telegram)", "Video terkait TNI yang naik cepat atau dilaporkan masuk antrean ≤ 1 menit; identitas pelapor tidak disimpan"],
  ["FR15", "P1", "Feedback relevansi", "Laporan \"tidak relevan\" masuk antrean tinjauan", "Tidak otomatis mengubah label publik"],
  ["FR16", "P1", "Adapter Facebook Reels", "Adapter keempat dengan pipeline yang sama", "Lulus uji alur yang sama"],
  ["FR17", "P2", "Deteksi manipulasi visual", "Studi kelayakan deepfake/edit frame", "Hanya laporan kelayakan"],
], [0.55, 0.45, 1.25, 2.4, 1.6]));

// 7
add(H1("7  Alur Pengguna dan Alur Sistem"));
add(H2("7.1 Alur pengguna"));
add(numbered([
  "Pengguna membuka Instagram Reels, TikTok, atau YouTube Shorts di browser. NARASI aktif otomatis (ikon hijau).",
  "Video mulai diputar. Di atas caption muncul badge \"Membaca teks…\".",
  "±2 detik: badge berubah menjadi label awal, misalnya \"82% Indikasi Hoaks\" (merah).",
  "±10 detik: hasil teks di layar dan audio masuk; persentase dan bukti diperbarui bila perlu.",
  "Pengguna mengklik badge: panel menampilkan klaim, daftar sumber terpercaya, dan kesimpulan bersitasi.",
  "Pengguna scroll ke video berikutnya: badge lama hilang seketika dan analisis baru dimulai.",
]));
add(H2("7.2 Alur sistem"));
add(table(["Tahap", "Komponen", "Proses", "Anggaran waktu"], [
  ["1. Deteksi", "Content script (adapter)", "Temukan video aktif, ambil platform + ID + caption", "<100 ms"],
  ["2. Cek cache", "Service worker → backend → Redis", "Jika ID sudah dianalisis, kembalikan hasil", "<500 ms"],
  ["3. Analisis caption", "Backend: Gemini Flash → Fact Check + Tavily", "Ekstraksi klaim dari caption, cari bukti, hitung skor awal", "≤2 dtk"],
  ["4. Teks di layar", "Content script (canvas) → backend: Gemini Flash", "3–5 frame JPEG → OCR → klaim tambahan", "≤4 dtk"],
  ["5. Audio", "Content script (MediaRecorder) → backend: Groq Whisper", "Potongan 5 dtk → transkrip → klaim tambahan", "≤10 dtk"],
  ["6. Skor dan kesimpulan", "Backend: pencocokan + skor + Gemini Flash", "Pencocokan konteks, Indeks Indikasi Hoaks, kesimpulan bersitasi", "≤1 dtk"],
  ["7. Tampilan", "Content script (React, Shadow DOM)", "Badge dan panel diperbarui via SSE", "<50 ms"],
], [0.9, 1.5, 2.2, 0.9]));
add(P("Setiap request membawa **session_id** yang terikat ke ID video aktif. Saat video berganti, service worker memanggil abort() untuk request lama dan hasil apa pun yang datang terlambat diabaikan."));
add(H2("7.3 Alur laporan dan peringatan dini (FR18)"));
add(numbered([
  "Pada video terkait TNI atau berlabel hoaks, pengguna membuka panel bukti, menekan **Laporkan ke TNI AD**, memilih alasan (mencatut TNI, provokasi, hoaks lain), dan menambah catatan opsional.",
  "Backend menyimpan tautan video publik, hasil analisis versi server, alasan, dan catatan. Identitas pelapor tidak disimpan; hash ID instalasi hanya mencegah laporan ganda.",
  "Setiap pemeriksaan video menambah sinyal penonton unik per jam. Prioritas = bobot label × (1 + log2(1 + penonton 1 jam)) + 2 × jumlah laporan; video ditandai **naik cepat** bila penonton 1 jam ≥ 3 dan ≥ 2× jam sebelumnya.",
  "Level tinggi (prioritas ≥ 8 atau ≥ 3 laporan) dan setiap laporan baru dikirim sekali per level ke webhook petugas (Telegram, Slack, atau Discord).",
  "Petugas Penerangan meninjau di dashboard Mode Satuan, membuka bukti, menyiapkan klarifikasi, dan memperbarui status laporan.",
]));

// 8
add(H1("8  Aturan Label dan Indeks Indikasi Hoaks"));
add(P("Google Fact Check Tools API hanya memberikan rating teks (misalnya \"Salah\", \"Hoaks\", \"Benar\"), bukan persentase. NARASI menghitung **Indeks Indikasi Hoaks** sendiri secara transparan:"));
add(bullets([
  "**Nilai rating v(e):** Salah/Hoaks/False = 1,0; Menyesatkan/Sebagian salah/Kurang konteks = 0,6; Benar/True = 0,0; Satire = tidak dihitung (label khusus).",
  "**Bobot bukti w(e) = kecocokan(e) × kredibilitas(e)**, dengan kredibilitas: pemeriksa fakta bersertifikat IFCN atau sumber resmi pemerintah/TNI = 1,0; media arus utama terverifikasi = 0,8; sumber whitelist lain = 0,5. Bukti dengan kecocokan <0,6 dibuang.",
  "**Skor klaim = Σ(w × v) / Σw × 100%.** Indeks video = skor tertinggi di antara klaim yang memiliki Σw ≥ 0,6.",
  "**Keyakinan** ditampilkan terpisah: Tinggi bila Σw ≥ 1,5; Sedang bila 0,6 ≤ Σw < 1,5.",
  "Bila tidak ada klaim dengan Σw ≥ 0,6, indeks **tidak ditampilkan** dan label menjadi \"Belum terverifikasi\".",
]));
add(table(["Rentang / kondisi", "Label badge", "Warna", "Perlakuan UI"], [
  ["≥ 70%", "Kemungkinan besar hoaks", "Merah", "Persen + ikon peringatan; panel menonjolkan bantahan"],
  ["40–69%", "Perlu diwaspadai", "Kuning", "Persen + penjelasan bagian klaim yang bermasalah"],
  ["< 40% dengan bukti cukup", "Didukung sumber", "Hijau", "Persen; ditegaskan bukan jaminan seluruh video benar"],
  ["Bukti tidak cukup", "Belum terverifikasi", "Abu-abu", "Tanpa persen; tidak boleh dibaca sebagai aman"],
  ["Klaim satire/opini", "Opini/satire", "Abu-biru", "Tidak diberi skor negatif"],
  ["Error/timeout", "Gagal memeriksa", "Abu-abu", "Tombol coba lagi; tidak menampilkan hasil lama"],
], [1.2, 1.3, 0.7, 2.2]));

// 9
add(H1("9  Rancangan Teknis dan Tech Stack"));
add(H2("9.1 Arsitektur"));
add(bullets([
  "**Extension (Manifest V3):** content script per adapter platform (deteksi video, ekstraksi caption dan frame, render badge/panel di Shadow DOM); service worker (routing pesan, AbortController per video, SSE ke backend); perekaman audio dengan captureStream + MediaRecorder langsung dari elemen video; popup (toggle platform, mode caption saja, hapus cache lokal).",
  "**Backend (Python, FastAPI):** orkestrasi pipeline async; semua panggilan eksternal berjalan paralel; hasil dikirim bertahap via Server-Sent Events.",
  "**Penyimpanan:** Redis untuk cache hasil; SQLite untuk laporan, sinyal penonton, dan riwayat peringatan (cukup untuk satu satuan; pindah ke PostgreSQL saat skala nasional).",
  "**API key** (Google, Gemini, Groq, Tavily) hanya disimpan di backend, tidak pernah di extension.",
]));
add(H2("9.2 Tech stack"));
add(table(["Lapisan", "Teknologi", "Alasan pemilihan"], [
  ["Framework extension", "WXT (berbasis Vite) + Manifest V3", "Build cepat, hot reload, manifest otomatis, siap Chrome/Firefox"],
  ["UI extension", "React 18 + TypeScript", "Komponen badge/panel dapat diuji; type-safety kontrak API"],
  ["Isolasi tampilan", "Shadow DOM + Tailwind CSS (di-inject ke shadow root)", "CSS platform dan NARASI tidak saling merusak"],
  ["State", "Zustand", "Ringan, cocok untuk state per video"],
  ["Streaming", "Server-Sent Events", "Badge diperbarui bertahap tanpa polling"],
  ["Backend", "Python 3.12, FastAPI, Uvicorn, Pydantic v2, httpx (async)", "Async native; panggilan paralel dengan asyncio.gather"],
  ["Audio ke teks", "Groq Whisper large-v3-turbo", "15 dtk audio diproses <1 dtk; akurat untuk Bahasa Indonesia"],
  ["OCR, ekstraksi klaim, kesimpulan", "Gemini Flash (multimodal, keluaran JSON)", "Satu panggilan untuk frame + teks; lebih cepat dan akurat dibanding Tesseract"],
  ["Bukti", "Google Fact Check Tools API + Tavily Search (include_domains = whitelist)", "ClaimReview resmi + cakupan situs pemeriksa fakta Indonesia"],
  ["Pencocokan", "Gemini text-embedding + aturan entitas/waktu/lokasi", "Similarity semantik dengan penjaga konteks"],
  ["Cache", "Redis (Upstash, region Singapura)", "Baca <5 ms; TTL bawaan"],
  ["Laporan & peringatan dini", "SQLite (MVP) → PostgreSQL saat skala", "Tanpa server tambahan; laporan tetap tersimpan saat server dimulai ulang"],
  ["Notifikasi petugas", "Webhook generik (Telegram Bot API, Slack, Discord)", "Peringatan sampai ke ponsel petugas tanpa membuka dashboard"],
  ["Dashboard Mode Satuan", "React + TypeScript + Vite + Recharts", "Satu bahasa dengan extension"],
  ["Deploy", "Docker; Google Cloud Run region asia-southeast2 (Jakarta)", "Latensi rendah ke pengguna Indonesia; dapat dipindah on-premise"],
  ["Pengujian", "Vitest, Playwright (E2E extension), pytest", "Uji unit, alur nyata, dan pipeline backend"],
], [1.2, 1.7, 1.9]));
add(H2("9.3 Kontrak API"));
add(table(["Endpoint", "Isi request", "Keluaran"], [
  ["POST /v1/analyze", "platform, video_id, url, caption, hashtags, mode", "session_id; hasil langsung bila ada di cache"],
  ["POST /v1/analyze/{session_id}/frames", "≤5 JPEG (≤720p)", "202 Accepted"],
  ["POST /v1/analyze/{session_id}/audio", "Potongan audio webm/opus ≤5 dtk (total ≤15 dtk)", "202 Accepted"],
  ["GET /v1/analyze/{session_id}/events", "-", "SSE: stage, claims, evidence, result (partial/final)"],
  ["POST /v1/feedback", "session_id, claim_id, alasan", "202 Accepted"],
  ["POST /v1/reports", "platform, video_id, url, reason, note, result", "id laporan; memicu webhook petugas"],
  ["GET /v1/reports, PATCH /v1/reports/{id}", "status, note (token dashboard)", "Antrean laporan dan pembaruan status"],
  ["GET /v1/alerts", "hours (token dashboard)", "Peringatan dini berprioritas"],
  ["GET /v1/stats", "hours (token dashboard)", "Ringkasan Mode Satuan"],
], [1.6, 1.8, 1.6]));
add(P("Contoh isi event result: score (0–100 atau null), label, confidence, tni_related, claims[] (teks, sumber modal: caption/ocr/audio), evidence[] (publisher, title, url, rating, date, match), conclusion (teks dengan sitasi [n]), stage (caption/ocr/audio/final)."));
add(H2("9.4 Taktik kecepatan"));
add(bullets([
  "Hasil caption dikirim lebih dulu; OCR dan audio menyusul dan memperbarui badge.",
  "Cache kolektif per platform+ID video dan per hash klaim.",
  "Caption video berikutnya diproses saat mulai terlihat (prefetch), sehingga sering sudah siap saat diputar.",
  "Timeout per tahap: OCR 4 dtk, ASR 6 dtk, fact-check 3 dtk; badge menampilkan hasil terbaik yang sudah ada.",
  "Debounce 600 ms saat scroll cepat agar video yang hanya dilewati tidak dianalisis.",
]));

// 10
add(H1("10  Privasi dan Keamanan"));
add(table(["Data", "Dikirim?", "Retensi"], [
  ["ID video, URL, caption, hashtag (konten publik)", "Ya", "Hasil analisis teks 7 hari (cache)"],
  ["≤5 frame video aktif", "Ya, bila mode multimodal aktif", "Dihapus setelah OCR (retensi 0)"],
  ["≤15 dtk audio video aktif", "Ya, bila mode multimodal aktif", "Dihapus setelah transkripsi (retensi 0)"],
  ["Laporan: alasan, catatan pelapor, tautan video", "Ya, hanya saat pengguna menekan Laporkan", "Disimpan untuk tindak lanjut petugas"],
  ["Hash ID instalasi acak (bukan identitas)", "Ya", "Penghitung penonton unik 7 hari; tidak ditampilkan"],
  ["Username/akun penonton, cookie, kredensial", "Tidak", "-"],
  ["Pesan pribadi (DM), komentar, riwayat tontonan", "Tidak", "-"],
  ["Video lain yang tidak sedang diputar", "Tidak", "-"],
], [2.2, 1.4, 1.6]));
add(gap());
add(bullets([
  "Izin host dibatasi pada domain platform di Bagian 6.1 dan endpoint backend NARASI.",
  "Transmisi HTTPS; rate limit per instalasi (ID instalasi acak, bukan identitas).",
  "Mode \"caption saja\" mematikan pengiriman frame dan audio.",
  "Kepatuhan kebijakan Chrome Web Store (User Data Policy) dan ketentuan platform diperiksa sebelum distribusi publik.",
]));

// 11
add(H1("11  Rencana Demo Purwarupa"));
add(bullets([
  "**Demo langsung:** satu video di Instagram Reels, satu di TikTok, dan satu di YouTube Shorts yang memuat klaim hoaks terkait TNI yang sudah dibantah publik.",
  "**Halaman uji terkendali (lokal):** 10 video berlabel — hoaks mencatut TNI, klaim benar, klaim tanpa bukti, klaim yang mirip tetapi beda peristiwa, satire, dan klaim yang hanya ada di audio.",
  "**Ketahanan demo:** hasil video demo sudah ada di cache; rekaman layar cadangan disiapkan bila jaringan venue bermasalah.",
  "**Yang ditunjukkan ke juri:** badge bertahap, panel bukti, scroll cepat tanpa label salah, mode caption saja, laporan ke TNI AD dari panel, lalu laporan dan peringatan naik cepat yang muncul di dashboard Mode Satuan.",
]));

// 12
add(H1("12  Kelayakan Implementasi di Lingkungan Satuan"));
add(table(["Aspek", "Rencana"], [
  ["Distribusi", "Force-install ke browser perangkat dinas melalui Chrome Enterprise policy (ExtensionInstallForcelist); publik melalui Chrome Web Store"],
  ["Hosting", "Docker Compose (FastAPI + Redis) dapat dijalankan di server satuan; atau Cloud Run Jakarta untuk publik"],
  ["Kedaulatan data", "ASR dapat diganti faster-whisper self-hosted dan LLM diganti model open-weight lokal tanpa mengubah kontrak API"],
  ["Biaya", "Biaya utama per video: ASR + 1–2 panggilan LLM + pencarian; cache kolektif menekan biaya video viral mendekati nol. Estimasi per 1.000 video dihitung saat uji beban"],
  ["Operasional", "Whitelist sumber dan watchlist entitas TNI dikelola fungsi Penerangan melalui berkas konfigurasi"],
  ["Alur kerja Penerangan", "Laporan dan peringatan dini masuk ke dashboard dan grup Telegram petugas; status tindak lanjut tercatat sehingga klarifikasi resmi dapat terbit sebelum hoaks viral"],
  ["Pengembangan lanjut", "Aplikasi mobile \"share-to-check\", Facebook Reels/X, integrasi kanal aduan konten Komdigi dan MAFINDO"],
], [1, 3.2]));

// 13
add(H1("13  Metrik dan Evaluasi"));
add(table(["Metrik", "Cara ukur", "Target awal"], [
  ["Evidence precision@1", "Kecocokan bukti teratas menurut anotasi manual", "≥ 80% pada set uji berlabel"],
  ["False attribution", "Bukti salah konteks pada pasangan klaim mirip", "≤ 10%"],
  ["Kalibrasi indeks", "Proporsi hoaks aktual per rentang skor", "Rentang ≥70% berisi ≥80% hoaks"],
  ["Cakupan klaim multimodal", "Klaim terdeteksi: caption saja vs caption+OCR+audio", "Kenaikan dilaporkan"],
  ["Akurasi ASR/OCR", "WER transkrip dan CER OCR Bahasa Indonesia pada sampel", "Dilaporkan per platform"],
  ["Latensi per tahap", "Median dan p90: label awal, OCR, audio, cache hit", "Label awal ≤2 dtk; final ≤10 dtk; cache <0,5 dtk"],
  ["Stale overlay", "Label video lama muncul di video baru", "0 kejadian"],
  ["Gangguan UI", "Kontrol penting terhalang pada 3 platform", "0 kontrol terhalang"],
  ["Waktu ke peringatan", "Selang dari pemeriksaan/laporan pertama hingga video muncul di antrean dan webhook", "≤ 1 menit"],
  ["Task time", "A/B pencarian manual vs NARASI", "Lebih cepat; selisih dilaporkan"],
], [1.3, 2, 1.5]));
add(P("Target di atas adalah target desain, bukan hasil eksperimen. Set uji minimal 50 klaim berlabel, terpisah dari data pengembangan; ukuran sampel dan kasus gagal dilaporkan."));

// 14
add(H1("14  Risiko dan Mitigasi"));
add(table(["Risiko", "Dampak", "Mitigasi"], [
  ["Struktur DOM platform berubah", "Caption/video tidak terdeteksi", "Adapter terisolasi per platform, selector cadangan, uji Playwright harian"],
  ["Canvas tainted (frame tidak bisa dibaca)", "OCR tidak berjalan", "Spike hari 1; cadangan captureVisibleTab yang dipotong ke area video"],
  ["Audio butuh waktu diputar", "Hasil audio lambat", "Hanya 15 dtk pertama, streaming per 5 dtk, hasil progresif"],
  ["Kuota/latensi API eksternal", "Label terlambat atau gagal", "Cache, timeout per tahap, degradasi ke caption saja"],
  ["Bukti salah konteks", "Peringatan keliru", "Pencocokan entitas/waktu/lokasi, ambang 0,6, label \"Belum terverifikasi\""],
  ["Skor dibaca sebagai kebenaran mutlak", "Kepercayaan salah", "Label keyakinan, teks penjelas, link ke sumber"],
  ["Halusinasi LLM pada kesimpulan", "Kesimpulan tidak sesuai bukti", "Kesimpulan wajib bersitasi; kalimat tanpa sitasi dibuang"],
  ["Penyalahgunaan laporan (spam)", "Antrean petugas tercemar", "Rate limit per instalasi, laporan ganda dihitung sekali, hasil analisis diambil dari server, bukan dari klien"],
  ["Kebijakan Chrome Web Store/ketentuan platform", "Distribusi terhambat", "Data minimum, opt-out multimodal, kebijakan privasi jelas"],
], [1.4, 1.2, 2.2]));

// 15
add(H1("15  Timeline Hackathon"));
add(table(["Periode", "Fokus", "Deliverable"], [
  ["28–30 Okt", "Spike adapter 3 platform, frame canvas, perekaman audio", "Keputusan go/no-go multimodal"],
  ["31 Okt–3 Nov", "Pipeline backend: Gemini, Groq, Fact Check, Tavily, skor", "API + dataset uji 50 klaim"],
  ["4–7 Nov", "Badge, panel, SSE, integrasi end-to-end", "Alur lengkap di 3 platform"],
  ["8–9 Nov", "Cache Redis, prioritas TNI, laporan & peringatan dini, dashboard Mode Satuan", "Fitur pengamanan informasi TNI AD"],
  ["10–11 Nov", "Evaluasi metrik, uji scroll/stale/latensi", "Laporan metrik"],
  ["12–13 Nov", "Bugfix, video demo, proposal, dokumentasi", "Release candidate"],
  ["14 Nov", "Validasi berkas dan submission awal", "Paket final (target 15 Nov)"],
], [0.9, 2.2, 1.5]));
add(callout("**Go/no-go 30 Okt:** bila perekaman audio tidak stabil, audio turun ke P1 dan demo memakai caption + teks di layar. Bila frame canvas tidak dapat dibaca, gunakan captureVisibleTab. Jangan mengklaim kemampuan yang tidak didemokan."));

// 16
add(H1("16  Dokumentasi dan Kriteria Selesai"));
add(H2("16.1 Paket dokumentasi"));
add(bullets([
  "Proposal (masalah, solusi, relevansi TNI AD, inovasi, kelayakan).",
  "README teknis: instalasi extension, menjalankan backend (Docker), variabel lingkungan.",
  "Diagram arsitektur dan alur sistem; dokumentasi kontrak API.",
  "Laporan metrik evaluasi beserta keterbatasan dan risiko bias.",
  "Video demo ±3 menit: masalah (20 dtk) → demo 3 platform (90 dtk) → panel bukti & Mode Satuan (40 dtk) → privasi & kelayakan (30 dtk).",
]));
add(H2("16.2 Kriteria selesai"));
add(bullets([
  "Demo end-to-end berjalan di Instagram Reels, TikTok, dan YouTube Shorts, serta di halaman uji terkendali.",
  "Setiap label merujuk ke sumber yang dapat dibuka; klaim tanpa bukti tidak dinyatakan hoaks.",
  "Scroll antar video tidak menghasilkan label salah; fitur dapat dimatikan dalam satu langkah.",
  "Laporan dari panel muncul di antrean Mode Satuan dan memicu peringatan ke kanal petugas.",
  "Laporan metrik, keterbatasan, dan video demo tersedia.",
]));

// 17
add(H1("17  Pemetaan ke Kriteria Penilaian"));
add(table(["Kriteria", "Bobot", "Bagian PRD", "Bukti saat demo/presentasi"], [
  ["Relevansi dan Manfaat", "25%", "2, 4, 7.3, FR13, FR14, FR18", "Hoaks mencatut TNI terdeteksi dengan bantahan resmi; laporan dan peringatan naik cepat masuk ke dashboard/Telegram petugas"],
  ["Inovasi Teknis", "25%", "5, 8, 9", "Analisis multimodal progresif, indeks dapat diaudit, pencocokan konteks, cache kolektif"],
  ["Fungsionalitas Purwarupa", "25%", "6, 7, 11", "Demo langsung 3 platform + halaman uji 10 video berlabel"],
  ["Kelayakan Implementasi", "15%", "10, 12, 15", "Force-install Chrome Enterprise, opsi on-premise, privasi, biaya"],
  ["Kualitas Dokumentasi", "10%", "13, 16", "Proposal, README, diagram, laporan metrik, video demo 3 menit"],
], [1.3, 0.6, 1.2, 2.6]));

// 18
add(H1("18  Referensi Utama"));
add(bullets([
  "Chrome Extensions Content Scripts — https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts",
  "MDN HTMLMediaElement.captureStream — https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/captureStream",
  "Chrome tabCapture — https://developer.chrome.com/docs/extensions/reference/api/tabCapture",
  "Chrome Web Store User Privacy — https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy",
  "Chrome Enterprise ExtensionInstallForcelist — https://chromeenterprise.google/policies/#ExtensionInstallForcelist",
  "Google Fact Check Tools API — https://developers.google.com/fact-check/tools/api",
  "WXT Framework — https://wxt.dev",
  "FastAPI — https://fastapi.tiangolo.com",
  "MAFINDO Public Services — https://turnbackhoax.id/layanan-publik",
  "Komdigi, hoaks TNI bakal serang Aceh 1 November 2026 — https://www.komdigi.go.id/berita/berita-hoaks/detail/hoaks-tni-bakal-serang-aceh-pada-1-november-2026",
  "Klarifikasi TNI AD (Dandim 0612/Tasikmalaya) — https://ppid.tniad.mil.id/index.php/i/34495/klarifikasi-isu-viral-dandim-0612tasikmalaya-pastikan-tidak-ada-anggota-terlibat",
]));

// ---------------------------------------------------------------- dokumen
const doc = new Document({
  creator: "Raphael Diovana Tarigan",
  title: "NARASI PRD v2.1",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: NAVY },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 23, bold: true, color: NAVY },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1224, bottom: 1080, left: 1224 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: "NARASI PRD v2.1  ·  ", size: 16, color: "6B7A8C" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6B7A8C" }),
        ],
      })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log("written", process.argv[2], buf.length);
});

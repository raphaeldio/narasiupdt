/**
 * Survei Urgensi Penanganan Hoaks Terkait TNI & Evaluasi Prototipe NARASI
 *
 * Cara pakai:
 * 1. Buka https://script.google.com → New project.
 * 2. Hapus isi Code.gs, tempel seluruh isi file ini.
 * 3. Isi CONFIG di bawah (nama tim, kontak, link video YouTube).
 * 4. Pilih fungsi `buatSurvei` → Run → izinkan akses Google Forms.
 * 5. Link form (isi & edit) muncul di Execution log. Form juga tersimpan di Google Drive.
 */

const CONFIG = {
  TIM: '[Nama Tim] — Kartika Hackathon 2026',
  KONTAK: '[email / nomor WhatsApp tim]',
  // Unggah video demo ke YouTube (boleh "Unlisted"), lalu tempel link-nya di sini.
  // Jika dikosongkan / bukan YouTube, form menampilkan link sebagai teks.
  VIDEO_URL: '',
};

const YA_TIDAK = ['Ya', 'Tidak'];
const SKALA_GUNA = ['Tidak berguna', 'Kurang berguna', 'Cukup berguna', 'Berguna', 'Sangat berguna'];

function buatSurvei() {
  const form = FormApp.create('Survei Urgensi Penanganan Hoaks Terkait TNI & Evaluasi Prototipe NARASI');
  form
    .setDescription(
      'Yth. Bapak/Ibu Prajurit dan ASN di lingkungan TNI (TNI AD, TNI AL, dan TNI AU),\n\n' +
      'Kami dari ' + CONFIG.TIM + ' sedang mengembangkan NARASI, ekstensi peramban yang memberi indikasi hoaks ' +
      'berbasis bukti secara langsung saat pengguna menonton video pendek (Instagram Reels, TikTok, YouTube Shorts) ' +
      'dan menelusuri feed media sosial, dengan prioritas pada hoaks yang mencatut institusi, satuan, maupun pejabat TNI.\n\n' +
      'TUJUAN SURVEI\n' +
      '1. Mengukur tingkat urgensi permasalahan hoaks dan disinformasi terkait TNI di media sosial.\n' +
      '2. Memperoleh penilaian, pendapat, dan saran terhadap prototipe NARASI setelah menonton video demonstrasi.\n' +
      '3. Menjadi dasar penyempurnaan solusi agar sesuai kebutuhan seluruh matra dan fungsi Penerangan TNI.\n\n' +
      'KERAHASIAAN\n' +
      'Seluruh jawaban hanya digunakan untuk kepentingan penelitian dan pengembangan dalam rangka Kartika Hackathon, ' +
      'disajikan secara agregat, dan tidak akan dipublikasikan atas nama perorangan. Survei ini tidak meminta informasi ' +
      'yang bersifat rahasia dinas; mohon untuk tidak mencantumkan informasi tersebut pada isian terbuka.\n\n' +
      'Estimasi waktu pengisian: ±10 menit (termasuk menonton video demonstrasi).\n' +
      'Narahubung: ' + CONFIG.KONTAK + '\n\n' +
      'Atas kesediaan dan partisipasi Bapak/Ibu, kami mengucapkan terima kasih.'
    )
    .setProgressBar(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setConfirmationMessage(
      'Terima kasih atas partisipasi Bapak/Ibu. Jawaban telah tercatat dan akan menjadi masukan berharga ' +
      'bagi pengembangan NARASI dalam mendukung pengamanan domain informasi TNI.'
    );

  // ── Persetujuan ────────────────────────────────────────────────
  const setuju = form.addMultipleChoiceItem()
    .setTitle('Pernyataan Kesediaan')
    .setHelpText('Saya telah membaca tujuan dan ketentuan kerahasiaan survei ini, dan bersedia berpartisipasi secara sukarela.')
    .setRequired(true);
  setuju.setChoices([
    setuju.createChoice('Ya, saya bersedia', FormApp.PageNavigationType.CONTINUE),
    setuju.createChoice('Tidak bersedia', FormApp.PageNavigationType.SUBMIT),
  ]);

  // ── Bagian 1: Identitas Responden ──────────────────────────────
  halaman(form, 'Bagian 1 — Identitas Responden', 'Data identitas hanya digunakan untuk pengelompokan analisis dan dijaga kerahasiaannya.');

  form.addTextItem()
    .setTitle('Nama Lengkap dan Pangkat')
    .setHelpText('Contoh: Serda Budi Santoso / Lettu Laut (P) Andi Pratama / Kapten Pnb Rina Wijaya')
    .setRequired(true);
  pilihan(form, 'Matra', ['TNI Angkatan Darat (AD)', 'TNI Angkatan Laut (AL)', 'TNI Angkatan Udara (AU)', 'Mabes TNI / Badan Pelaksana Pusat TNI'], false);
  pilihan(form, 'Golongan Kepangkatan', ['Tamtama', 'Bintara', 'Perwira Pertama', 'Perwira Menengah', 'Perwira Tinggi', 'ASN/PNS di lingkungan TNI'], false);
  pilihan(form, 'Rentang Umur', ['18 – 24 tahun', '25 – 34 tahun', '35 – 44 tahun', '45 – 54 tahun', '55 tahun ke atas'], false);
  pilihan(form, 'Masa Dinas', ['Kurang dari 5 tahun', '5 – 10 tahun', '11 – 20 tahun', 'Lebih dari 20 tahun'], false);
  pilihan(form, 'Bidang Tugas Saat Ini', ['Penerangan / Kehumasan', 'Intelijen', 'Siber / Komunikasi & Elektronika', 'Teritorial', 'Operasi / Satuan Tempur', 'Staf / Administrasi / Logistik', 'Pendidikan / Latihan'], true);
  form.addCheckboxItem()
    .setTitle('Media sosial yang paling sering Bapak/Ibu gunakan (boleh lebih dari satu)')
    .setChoiceValues(['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X (Twitter)', 'WhatsApp / Telegram (grup)'])
    .showOtherOption(true)
    .setRequired(true);

  // ── Bagian 2: Evaluasi Urgensi Masalah ─────────────────────────
  halaman(form, 'Bagian 2 — Evaluasi Urgensi Permasalahan', 'Jawablah sesuai pengalaman dan penilaian pribadi Bapak/Ibu. Tidak ada jawaban benar atau salah.');

  form.addSectionHeaderItem().setTitle('A. Paparan terhadap hoaks terkait TNI');
  yaTidak(form, 'Dalam 6 bulan terakhir, apakah Bapak/Ibu pernah menemukan konten media sosial yang mencatut nama TNI, satuan, atau pejabat TNI dengan informasi yang tidak benar?');
  yaTidak(form, 'Apakah Bapak/Ibu pernah menerima kiriman video atau pesan berisi hoaks terkait TNI melalui grup WhatsApp/Telegram (termasuk grup keluarga atau satuan)?');
  yaTidak(form, 'Apakah menurut Bapak/Ibu video pendek (Reels, TikTok, Shorts) merupakan media yang paling cepat menyebarkan hoaks terkait TNI?');
  yaTidak(form, 'Apakah Bapak/Ibu pernah ragu menentukan benar atau tidaknya sebuah video terkait TNI yang Bapak/Ibu tonton?');

  form.addSectionHeaderItem().setTitle('B. Dampak');
  yaTidak(form, 'Apakah hoaks yang mencatut TNI pernah menimbulkan keresahan di lingkungan satuan, keluarga, atau masyarakat sekitar Bapak/Ibu?');
  yaTidak(form, 'Apakah menurut Bapak/Ibu hoaks terkait TNI dapat menurunkan kepercayaan masyarakat terhadap institusi TNI?');
  yaTidak(form, 'Apakah Bapak/Ibu memandang hoaks dan provokasi di media sosial sebagai ancaman di domain informasi/kognitif terhadap TNI?');
  yaTidak(form, 'Apakah Bapak/Ibu atau rekan pernah menjadi sasaran konten pancingan/rekayasa sosial (akun palsu, tautan mencurigakan) yang mengatasnamakan TNI?');

  form.addSectionHeaderItem().setTitle('C. Kesiapan saat ini');
  yaTidak(form, 'Apakah Bapak/Ibu mengetahui kanal resmi untuk melaporkan hoaks terkait TNI kepada fungsi Penerangan (Puspen TNI, Dispenad, Dispenal, Dispenau)?');
  yaTidak(form, 'Apakah menurut Bapak/Ibu klarifikasi resmi atas hoaks terkait TNI saat ini sudah cukup cepat menjangkau masyarakat?');
  yaTidak(form, 'Apakah Bapak/Ibu selalu memeriksa kebenaran video terkait TNI ke sumber resmi sebelum membagikannya?');
  yaTidak(form, 'Apakah saat ini sudah ada alat bantu yang Bapak/Ibu gunakan untuk mendeteksi hoaks secara langsung ketika menonton video?');

  form.addSectionHeaderItem().setTitle('D. Kebutuhan');
  yaTidak(form, 'Apakah personel TNI dan keluarga membutuhkan alat bantu yang memberi peringatan hoaks secara langsung saat menonton video?');
  yaTidak(form, 'Apakah fungsi Penerangan perlu memperoleh peringatan dini atas hoaks terkait TNI sebelum konten tersebut viral?');
  yaTidak(form, 'Apakah permasalahan hoaks terkait TNI perlu segera ditangani dalam 1 tahun ke depan?');

  form.addScaleItem()
    .setTitle('Secara keseluruhan, seberapa mendesak permasalahan hoaks terkait TNI di media sosial menurut Bapak/Ibu?')
    .setBounds(1, 5)
    .setLabels('Tidak mendesak', 'Sangat mendesak')
    .setRequired(true);

  // ── Bagian 3: Video Demonstrasi ────────────────────────────────
  halaman(form, 'Bagian 3 — Video Demonstrasi NARASI', 'Mohon tonton video demonstrasi berikut hingga selesai sebelum melanjutkan ke bagian berikutnya.');

  if (/youtu\.?be/.test(CONFIG.VIDEO_URL)) {
    form.addVideoItem().setTitle('Demonstrasi Prototipe NARASI').setVideoUrl(CONFIG.VIDEO_URL);
  } else {
    form.addSectionHeaderItem()
      .setTitle('Demonstrasi Prototipe NARASI')
      .setHelpText('Tautan video: ' + (CONFIG.VIDEO_URL || '[tempel link video di sini]'));
  }
  yaTidak(form, 'Apakah Bapak/Ibu telah menonton video demonstrasi hingga selesai?');

  // ── Bagian 4: Penilaian Setelah Menonton Video ─────────────────
  halaman(form, 'Bagian 4 — Penilaian terhadap NARASI', 'Berikan penilaian berdasarkan video demonstrasi yang telah Bapak/Ibu tonton.');

  form.addScaleItem()
    .setTitle('Seberapa jelas Bapak/Ibu memahami cara kerja NARASI setelah menonton video?')
    .setBounds(1, 5).setLabels('Tidak jelas', 'Sangat jelas').setRequired(true);

  form.addGridItem()
    .setTitle('Seberapa berguna fitur-fitur berikut menurut Bapak/Ibu?')
    .setRows([
      'Label indikasi hoaks yang muncul saat video sedang diputar',
      'Panel bukti dengan sumber pemeriksa fakta/resmi yang dapat dibuka',
      'Penanda "Mencatut TNI" beserta bantahan resmi',
      'Pemindaian otomatis postingan di feed Instagram & Facebook',
      'Tombol "Laporkan ke TNI AD" langsung dari panel',
      'Dashboard Mode Satuan untuk petugas Penerangan',
      'Peringatan dini ke petugas (dashboard/Telegram) saat konten mulai viral',
    ])
    .setColumns(SKALA_GUNA)
    .setRequired(true);

  yaTidak(form, 'Apakah NARASI menjawab permasalahan hoaks terkait TNI yang diangkat?');
  yaTidak(form, 'Apakah label dan warna indikasi hoaks mudah dipahami tanpa penjelasan tambahan?');
  yaTidak(form, 'Apakah Bapak/Ibu bersedia memasang NARASI di peramban (browser) pribadi?');
  yaTidak(form, 'Apakah Bapak/Ibu akan merekomendasikan NARASI kepada rekan atau keluarga?');
  yaTidak(form, 'Apakah fitur pelaporan sebaiknya diperluas ke Penerangan seluruh matra (Dispenal, Dispenau) dan Puspen TNI?');
  yaTidak(form, 'Apakah NARASI layak diusulkan untuk diuji coba di lingkungan satuan Bapak/Ibu?');

  form.addScaleItem()
    .setTitle('Seberapa Bapak/Ibu percaya pada label NARASI apabila disertai sumber bukti yang dapat dibuka?')
    .setBounds(1, 5).setLabels('Tidak percaya', 'Sangat percaya').setRequired(true);

  form.addCheckboxItem()
    .setTitle('Hal yang menjadi kekhawatiran Bapak/Ibu terhadap penggunaan NARASI (boleh lebih dari satu)')
    .setChoiceValues([
      'Akurasi label (salah menandai konten benar sebagai hoaks)',
      'Privasi dan keamanan data pengguna',
      'Kesesuaian dengan aturan penggunaan perangkat dinas',
      'Membebani kinerja perangkat / kuota internet',
      'Kecepatan analisis',
      'Tidak ada kekhawatiran',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Pengembangan apa yang paling Bapak/Ibu harapkan? (pilih maksimal 3)')
    .setChoiceValues([
      'Aplikasi Android / iOS',
      'Pemeriksaan pesan dan video yang diteruskan di WhatsApp/Telegram',
      'Deteksi video rekayasa AI (deepfake) dan suara palsu',
      'Dukungan bahasa daerah',
      'Integrasi dengan Puspen TNI dan Penerangan tiap matra',
      'Dukungan video panjang YouTube dan platform lain',
      'Materi edukasi literasi digital bagi prajurit dan keluarga',
    ])
    .showOtherOption(true)
    .setValidation(FormApp.createCheckboxValidation().requireSelectAtMost(3).build())
    .setRequired(true);

  // ── Bagian 5: Pendapat dan Saran ───────────────────────────────
  halaman(form, 'Bagian 5 — Pendapat dan Saran', 'Mohon tidak mencantumkan informasi yang bersifat rahasia dinas.');

  form.addParagraphTextItem().setTitle('Apa kesan pertama Bapak/Ibu setelah melihat demonstrasi NARASI?').setRequired(true);
  form.addParagraphTextItem().setTitle('Fitur apa yang paling bermanfaat menurut Bapak/Ibu, dan mengapa?');
  form.addParagraphTextItem().setTitle('Kekurangan atau hal apa yang perlu diperbaiki dari NARASI?');
  form.addParagraphTextItem().setTitle('Jenis hoaks atau modus disinformasi terkait TNI apa yang paling sering Bapak/Ibu temui di matra/satuan Bapak/Ibu?');
  form.addParagraphTextItem().setTitle('Saran Bapak/Ibu agar NARASI dapat diterapkan secara efektif di lingkungan TNI.').setRequired(true);
  pilihan(form, 'Apakah Bapak/Ibu bersedia dihubungi untuk wawancara lanjutan atau uji coba?', YA_TIDAK, false);
  form.addTextItem()
    .setTitle('Jika bersedia, cantumkan kontak yang dapat dihubungi (email / WhatsApp)')
    .setHelpText('Opsional.');

  Logger.log('Link isi form  : ' + form.getPublishedUrl());
  Logger.log('Link edit form : ' + form.getEditUrl());
}

function halaman(form, judul, keterangan) {
  form.addPageBreakItem().setTitle(judul).setHelpText(keterangan);
}

function pilihan(form, judul, opsi, lainnya) {
  form.addMultipleChoiceItem()
    .setTitle(judul)
    .setChoiceValues(opsi)
    .showOtherOption(lainnya)
    .setRequired(true);
}

function yaTidak(form, judul) {
  pilihan(form, judul, YA_TIDAK, false);
}

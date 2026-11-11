import type { Basis, Label, Level, Report, Urgency } from './api';

export const LABEL_TEXT: Record<Label, string> = {
  hoax: 'Indikasi hoaks',
  caution: 'Perlu diwaspadai',
  supported: 'Didukung sumber',
  unverified: 'Belum terverifikasi',
  satire: 'Satire',
  neutral: 'Tanpa klaim',
  error: 'Gagal diperiksa',
};

/** Warna status label (token CSS di index.css). Dipakai untuk tanda, bukan untuk teks. */
export const LABEL_COLOR: Record<Label, string> = {
  hoax: 'var(--st-hoax)',
  caution: 'var(--st-caution)',
  supported: 'var(--st-supported)',
  unverified: 'var(--st-unverified)',
  satire: 'var(--st-satire)',
  neutral: 'var(--st-neutral)',
  error: 'var(--st-unverified)',
};

export const LABEL_ORDER: Label[] = ['hoax', 'caution', 'supported', 'unverified', 'satire', 'neutral'];

export const BASIS_TEXT: Record<Basis, string> = {
  evidence: 'Bukti cek fakta / berita',
  signals: 'Pola bahasa',
  ai: 'Penilaian AI',
  none: 'Belum ada dasar',
};

export const TOPIC_TEXT: Record<string, string> = {
  pertahanan: 'Pertahanan & TNI',
  kesehatan: 'Kesehatan',
  politik: 'Politik & pemerintahan',
  bencana: 'Bencana & cuaca',
  penipuan: 'Penipuan & finansial',
  sara: 'SARA & sosial',
  internasional: 'Isu internasional',
  teknologi: 'Teknologi & AI',
  kriminal: 'Kriminal & keamanan',
  ekonomi: 'Ekonomi',
  umum: 'Umum',
};

export const LANGUAGE_TEXT: Record<string, string> = {
  id: 'Indonesia', en: 'Inggris', es: 'Spanyol', pt: 'Portugis', fr: 'Prancis', de: 'Jerman', tr: 'Turki',
  vi: 'Vietnam', tl: 'Tagalog', nl: 'Belanda', it: 'Italia', ja: 'Jepang', ko: 'Korea', zh: 'Mandarin',
  ar: 'Arab', ru: 'Rusia', th: 'Thai', hi: 'Hindi', he: 'Ibrani',
};

export const PLATFORM_TEXT: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  facebook: 'Facebook',
  testbed: 'Contoh',
};

export const REASON_TEXT: Record<Report['reason'], string> = {
  mencatut_tni: 'Mencatut TNI',
  provokasi: 'Provokasi',
  hoaks: 'Hoaks lain',
  lainnya: 'Lainnya',
};

export const LEVEL_TEXT: Record<Level, string> = { tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' };
export const LEVEL_COLOR: Record<Level, string> = {
  tinggi: 'var(--st-hoax)',
  sedang: 'var(--st-caution)',
  rendah: 'var(--st-unverified)',
};

export const URGENCY_TEXT: Record<Urgency, string> = { segera: 'Segera', hari_ini: 'Hari ini', pantau: 'Pantau' };
export const URGENCY_COLOR: Record<Urgency, string> = {
  segera: 'var(--st-hoax)',
  hari_ini: 'var(--st-caution)',
  pantau: 'var(--st-unverified)',
};

const relative = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

export function ago(epochSeconds: number): string {
  const diff = epochSeconds - Date.now() / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return relative.format(Math.round(diff), 'second');
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(diff / 3600), 'hour');
  return relative.format(Math.round(diff / 86400), 'day');
}

export const number = new Intl.NumberFormat('id');
export const clock = (epochSeconds: number) =>
  new Date(epochSeconds * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

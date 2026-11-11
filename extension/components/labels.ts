import type { Label, Modality, StageName } from '@/lib/types';

export const LABELS: Record<Label, { text: string; color: string; showScore: boolean }> = {
  hoax: { text: 'Indikasi Hoaks', color: '#FF5A5F', showScore: true },
  caution: { text: 'Perlu Diwaspadai', color: '#F5A524', showScore: true },
  supported: { text: 'Didukung Sumber', color: '#3DD68C', showScore: true },
  unverified: { text: 'Belum Terverifikasi', color: '#A0A4AE', showScore: false },
  satire: { text: 'Opini/Satire', color: '#8DA2FB', showScore: false },
  neutral: { text: 'Tanpa Klaim', color: '#6B7688', showScore: false },
  error: { text: 'Gagal Memeriksa', color: '#A0A4AE', showScore: false },
};

export const TOPIC_TEXT: Record<string, string> = {
  pertahanan: 'Pertahanan & TNI', kesehatan: 'Kesehatan', politik: 'Politik', bencana: 'Bencana & cuaca',
  penipuan: 'Penipuan', sara: 'SARA & sosial', internasional: 'Internasional', teknologi: 'Teknologi & AI',
  kriminal: 'Kriminal', ekonomi: 'Ekonomi',
};

export const LANGUAGE_TEXT: Record<string, string> = {
  en: 'Inggris', es: 'Spanyol', pt: 'Portugis', fr: 'Prancis', de: 'Jerman', tr: 'Turki', vi: 'Vietnam',
  tl: 'Tagalog', nl: 'Belanda', it: 'Italia', ja: 'Jepang', ko: 'Korea', zh: 'Mandarin', ar: 'Arab',
  ru: 'Rusia', th: 'Thai', hi: 'Hindi', he: 'Ibrani',
};

export const BASIS_TEXT = {
  evidence: 'Berdasarkan sumber',
  signals: 'Dari pola bahasa, belum ada bukti',
  ai: 'Penilaian AI, belum ada bukti',
  none: '',
} as const;

export const STAGE_TEXT: Record<StageName, string> = {
  caption: 'Membaca teks…',
  ocr: 'Membaca teks di layar…',
  audio: 'Mendengar audio…',
};

export const MODALITY_TEXT: Record<Modality, string> = {
  caption: 'Caption',
  ocr: 'Teks layar',
  audio: 'Audio',
};

export function verdictColor(verdict: number | null): string {
  if (verdict === null) return LABELS.satire.color;
  if (verdict >= 0.9) return LABELS.hoax.color;
  if (verdict >= 0.5) return LABELS.caution.color;
  return LABELS.supported.color;
}

import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// Warna diambil dari extension/components/labels.ts dan overlay.css supaya video sama persis dengan produknya.
export const C = {
  bg: '#07080b',
  panel: '#121419',
  border: '#262a33',
  text: '#eceef2',
  muted: '#9aa0ab',
  hoax: '#FF5A5F',
  caution: '#F5A524',
  supported: '#3DD68C',
  unverified: '#A0A4AE',
  accent: '#8DA2FB',
  gold: '#f5c46b',
  goldText: '#1a1408',
};

export const FONT = loadInter('normal', { weights: ['400', '600', '800', '900'], subsets: ['latin'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] }).fontFamily;

export const FPS = 30;
// 120 BPM: 1 beat = 0,5 detik = 15 frame. Semua cut jatuh di kelipatan BEAT.
export const BEAT = 15;
export const b = (beats: number) => Math.round(beats * BEAT);

// Batas scene dalam frame (lihat SCRIPT.md).
export const SCENES = {
  hook: { from: 0, dur: 180 },
  masalah: { from: 180, dur: 180 },
  reveal: { from: 360, dur: 90 },
  demo: { from: 450, dur: 450 },
  inovasi: { from: 900, dur: 240 },
  lapor: { from: 1140, dur: 300 },
  siap: { from: 1440, dur: 210 },
  penutup: { from: 1650, dur: 150 },
} as const;

export const TOTAL = 1800;

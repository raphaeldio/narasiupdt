// Musik latar 60 detik, 120 BPM, disintesis dari nol (tanpa sampel/lisensi pihak ketiga).
// Struktur mengikuti scene di src/theme.ts: 1 beat = 0,5 detik = 15 frame.
//   node scripts/music.mjs  ->  public/music.wav
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const DUR = 60;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);

// Bilangan acak deterministik supaya hasil render selalu sama.
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const at = (beat) => Math.round(beat * BEAT * SR);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function add(start, len, fn, gainL = 1, gainR = gainL) {
  for (let i = 0; i < len; i++) {
    const n = start + i;
    if (n < 0 || n >= N) continue;
    const v = fn(i / SR, i);
    L[n] += v * gainL;
    R[n] += v * gainR;
  }
}

// --- Instrumen ---
function kick(beat, g = 1) {
  let ph = 0;
  add(at(beat), Math.round(SR * 0.45), (t) => {
    const f = 45 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    return Math.tanh(Math.sin(ph) * 2.2) * Math.exp(-t * 7) * 0.9 * g;
  });
}

function hat(beat, g = 1, open = false) {
  let prev = 0;
  add(at(beat), Math.round(SR * (open ? 0.22 : 0.05)), (t) => {
    const w = rnd();
    const hp = w - prev; // high-pass kasar
    prev = w;
    return hp * Math.exp(-t * (open ? 14 : 70)) * 0.16 * g;
  }, 0.8 * g, 1.0 * g);
}

function clap(beat, g = 1) {
  let lp = 0;
  add(at(beat), Math.round(SR * 0.25), (t) => {
    const w = rnd();
    lp += 0.45 * (w - lp);
    const env = (t < 0.03 ? Math.exp(-((t * 1000) % 10) * 0.35) : 1) * Math.exp(-t * 16);
    return (w - lp) * env * 0.45 * g;
  }, 1, 0.9);
}

function bass(beat, beats, midi, g = 1) {
  const f = mtof(midi);
  let lp = 0;
  add(at(beat), at(beats), (t) => {
    const saw = 2 * ((t * f) % 1) - 1;
    const sub = Math.sin(2 * Math.PI * f * 0.5 * t);
    const cutoff = 0.05 + 0.25 * Math.exp(-t * 9);
    lp += cutoff * (saw - lp);
    const env = Math.min(1, t * 400) * Math.exp(-t * 3.5);
    return (lp * 0.55 + sub * 0.5) * env * 0.5 * g;
  });
}

function pad(beat, beats, notes, g = 1, bright = 0.03) {
  const len = at(beats);
  const lps = notes.map(() => [0, 0]);
  add(at(beat), len, (t, i) => {
    let l = 0;
    let r = 0;
    notes.forEach((m, k) => {
      const f = mtof(m);
      const a = 2 * (((t * f * 1.004) % 1)) - 1;
      const b2 = 2 * (((t * f * 0.996) % 1)) - 1;
      lps[k][0] += bright * (a - lps[k][0]);
      lps[k][1] += bright * (b2 - lps[k][1]);
      l += lps[k][0];
      r += lps[k][1];
    });
    const env = Math.min(1, t / 0.25) * Math.min(1, (len - i) / SR / 0.3);
    return (l + r) * 0.5 * env * 0.12 * g;
  });
}

function pluck(beat, midi, g = 1, pan = 0) {
  const f = mtof(midi);
  add(at(beat), Math.round(SR * 0.3), (t) => {
    const sq = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.6 + Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
    return sq * Math.exp(-t * 14) * 0.11 * g;
  }, 1 - pan, 1 + pan);
}

function riser(beat, beats, g = 1) {
  const len = at(beats);
  let lp = 0;
  add(at(beat), len, (t, i) => {
    const p = i / len;
    lp += (0.02 + p * 0.5) * (rnd() - lp);
    const tone = Math.sin(2 * Math.PI * (200 + 1400 * p * p) * t) * 0.25;
    return (lp + tone) * p * p * 0.5 * g;
  });
}

function impact(beat, g = 1) {
  let ph = 0;
  let lp = 0;
  add(at(beat), Math.round(SR * 2.2), (t) => {
    ph += (2 * Math.PI * (32 + 70 * Math.exp(-t * 6))) / SR;
    lp += 0.12 * (rnd() - lp);
    return (Math.sin(ph) * Math.exp(-t * 1.6) * 0.9 + lp * Math.exp(-t * 3) * 0.6) * g;
  });
}

function glitch(beat, beats, g = 1) {
  // Potongan bitcrush pendek untuk stempel "HOAKS" dan "DOMAIN KOGNITIF".
  const len = at(beats);
  add(at(beat), len, (t, i) => {
    const step = Math.floor(i / 220) % 2 ? 1 : -1;
    return step * Math.sin(2 * Math.PI * (880 + (i % 3000) * 0.3) * t) * 0.18 * Math.exp(-t * 6) * g;
  });
}

// --- Aransemen (A minor: Am - F - C - G, satu akor per bar = 4 beat) ---
const ROOTS = [45, 41, 48, 43]; // A2 F2 C3 G2
const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 60, 64], // C
  [55, 59, 62], // G
];
const ARP = [[69, 72, 76, 72], [65, 69, 72, 69], [67, 72, 76, 72], [67, 71, 74, 71]];
const bar = (beat) => Math.floor(beat / 4) % 4;

function groove(from, to, { kicks = true, hats = true, claps = true, bassOn = true, arp = false, pads = false, g = 1 } = {}) {
  for (let b = from; b < to; b++) {
    if (kicks) kick(b, g);
    if (hats) {
      hat(b + 0.5, g, b % 4 === 3);
      hat(b + 0.25, g * 0.45);
      hat(b + 0.75, g * 0.45);
    }
    if (claps && b % 2 === 1) clap(b, g);
    if (bassOn) {
      bass(b, 0.5, ROOTS[bar(b)], g);
      bass(b + 0.5, 0.5, ROOTS[bar(b)] + 12, g * 0.7);
    }
    if (arp) for (let k = 0; k < 4; k++) pluck(b + k * 0.25, ARP[bar(b)][k], g, k % 2 ? 0.35 : -0.35);
    if (pads && b % 4 === 0) pad(b, 4, CHORDS[bar(b)], g);
  }
}

// 1 HOOK (beat 0–12): pulsa tegang, stempel di beat 5.
groove(0, 12, { claps: false, pads: false, g: 0.85 });
glitch(5, 1.2, 1.2);
impact(5, 0.6);
// 2 MASALAH (12–24): setengah tempo, makin tegang, riser ke reveal.
for (let b = 12; b < 24; b += 2) kick(b, 0.8);
for (let b = 12; b < 24; b++) hat(b + 0.5, 0.6);
pad(12, 12, [45, 52, 57, 60], 1.1, 0.015);
glitch(20, 1, 1);
impact(20, 0.5);
riser(20, 4, 1.1);
// 3 REVEAL (24–30): hantaman + akor terbuka.
impact(24, 1.1);
pad(24, 6, [57, 64, 69, 72, 76], 1.4, 0.05);
kick(24, 1.1);
// 4 DEMO (30–60): groove ringan supaya rekaman terbaca.
groove(30, 60, { claps: false, arp: false, pads: true, g: 0.75 });
// 5 INOVASI (60–76): arp masuk.
groove(60, 76, { arp: true, pads: true, g: 0.85 });
// 6 LAPOR + MODE SATUAN (76–96): penuh; whip di beat 84.
riser(82, 2, 0.8);
impact(84, 0.6);
groove(76, 96, { arp: true, pads: true, g: 1 });
// 7 SIAP DIPAKAI (96–110): penuh, tiap kartu diberi aksen.
groove(96, 110, { arp: true, pads: true, g: 1 });
[97, 101, 105].forEach((b) => impact(b, 0.35));
// 8 PENUTUP (110–120): tiga stab nge-beat, lalu hantaman logo.
[110, 111, 112].forEach((b, k) => {
  kick(b, 1.1);
  pad(b, 0.6, CHORDS[k % 4].map((m) => m + 12), 1.6, 0.08);
});
riser(112, 2, 0.7);
impact(114, 1.2);
pad(114, 6, [57, 64, 69, 72, 76], 1.3, 0.04);

// --- Master: soft clip, normalisasi -1 dBFS, fade out 1 detik ---
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.1);
  R[i] = Math.tanh(R[i] * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / SR);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * fade)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * fade)) * 32767), 46 + i * 4);
}
const out = path.resolve(import.meta.dirname, '../public/music.wav');
fs.writeFileSync(out, buf);
console.log(`music.wav ${(buf.length / 1e6).toFixed(1)} MB, peak ${peak.toFixed(2)} -> normalized`);

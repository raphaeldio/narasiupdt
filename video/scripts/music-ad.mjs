// Musik iklan 30 detik (NarasiAd), 120 BPM, disintesis dari nol. Instrumen sama dengan scripts/music.mjs.
//   node scripts/music-ad.mjs  ->  public/music-ad.wav
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const DUR = 30;
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

function groove(from, to, { kicks = true, hats = true, claps = true, bassOn = true, arp = false, pads = false, g = 1, sixteen = false } = {}) {
  for (let b = from; b < to; b++) {
    if (kicks) kick(b, g);
    if (hats) {
      hat(b + 0.5, g, b % 4 === 3);
      hat(b + 0.25, g * 0.45);
      hat(b + 0.75, g * 0.45);
      if (sixteen) [0.125, 0.375, 0.625, 0.875].forEach((o) => hat(b + o, g * 0.3));
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

// Peta beat (1 beat = 15 frame), harus sama dengan AD di src/ad/timeline.ts.
// 0–8 COLD OPEN: "SCROLL. SCROLL. SCROLL." tiap beat, riser ke feed.
[0, 1, 2, 3].forEach((b) => { kick(b, 1.1); glitch(b, 0.4, 0.9); });
for (let b = 4; b < 8; b++) { kick(b, 0.9); hat(b + 0.5, 0.8); }
glitch(5, 1, 1.1);
riser(4, 4, 1);
// 8–24 FEED: groove penuh, aksen tiap badge muncul.
impact(8, 0.9);
groove(8, 24, { arp: true, pads: true, g: 0.9 });
// 24–34 HOAKS: tegang, stempel di beat 28.
groove(24, 34, { arp: false, pads: true, claps: false, g: 0.85 });
glitch(28, 1.4, 1.3);
impact(28, 1);
// 34–38 ALIR DATA: riser + hats 16-an.
groove(34, 38, { bassOn: false, claps: false, g: 0.7, sixteen: true });
riser(34, 4, 1.1);
// 38–50 DASHBOARD LIVE: drop.
impact(38, 1.1);
groove(38, 50, { arp: true, pads: true, g: 1, sixteen: true });
// 50–55 SHOWREEL: aksen tiap beat.
groove(50, 55, { arp: true, pads: false, g: 1, sixteen: true });
for (let b = 50; b < 55; b++) impact(b, 0.25);
riser(53, 2, 0.8);
// 55–60 LOGO REVEAL.
impact(55, 1.3);
kick(55, 1.2);
pad(55, 5, [57, 64, 69, 72, 76], 1.4, 0.05);
[56, 57].forEach((b) => pluck(b, 81, 0.8));

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
const out = path.resolve(import.meta.dirname, '../public/music-ad.wav');
fs.writeFileSync(out, buf);
console.log(`music-ad.wav ${(buf.length / 1e6).toFixed(1)} MB, peak ${peak.toFixed(2)} -> normalized`);

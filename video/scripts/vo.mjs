// Generate voice-over per scene dengan Gemini TTS (key diambil dari backend/.env, tidak pernah dicetak).
//   node scripts/vo.mjs          -> semua scene
//   node scripts/vo.mjs 2 4      -> hanya scene 2 dan 4
//   node scripts/vo.mjs --fit    -> tanpa memanggil API, hanya pas-kan ulang hasil mentah
// Hasil mentah di .vo-raw/ (di luar public supaya tidak ikut di-bundle), hasil akhir public/vo/s1.wav … s8.wav:
// hening di awal/akhir dipotong, lalu dipercepat (atempo, pitch tetap) bila masih melebihi durasi scene.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/vo');
const RAW = path.join(ROOT, '.vo-raw');
const MODEL = process.env.TTS_MODEL ?? 'gemini-3.8-flash-tts';
const VOICE = process.env.TTS_VOICE ?? 'Puck';
const STYLE =
  'Narator promo teknologi Indonesia: santai, percaya diri, energik, tempo cepat seperti creator konten ngobrol ke temen. ' +
  'Hormat saat menyebut TNI. Jangan bertele-tele, jeda antar kalimat singkat.';

// Teks VO sama dengan SCRIPT.md; angka ditulis sebagai kata supaya dibaca benar. Batas = durasi scene (detik).
export const LINES = [
  { id: 1, max: 6, text: 'Delapan belas ribu pasukan TNI dikirim ke Aceh? Hoaks. Udah dibantah Komdigi, tapi videonya masih tayang.' },
  { id: 2, max: 6, text: 'Ini serangan ke ruang kognitif. Hoaksnya nyumput di suara dan teks layar. Siapa yang sempat ngecek?' },
  { id: 3, max: 3, text: 'Makanya, kita bikin NARASI.' },
  { id: 4, max: 15, text: 'Ini demo asli ya. Dari caption doang, belum cukup bukti. Tapi begitu teks di layarnya kebaca, detik kelima: indikasi hoaks, mencatut nama TNI. Terus makin akurat, suaranya juga ikut dicek.' },
  { id: 5, max: 8, text: 'NARASI baca caption, baca layar, dengerin suara. Bukan nebak, buktinya langsung dari sumber resmi.' },
  { id: 6, max: 10, text: 'Mau lapor? Sekali klik. Laporannya langsung masuk ke tim Penerangan, dan narasi yang naik cepat ketahuan sebelum viral.' },
  { id: 7, max: 7, text: 'Bisa dipasang serentak di perangkat satuan, jalan di server sendiri, dan nggak nyimpen video siapa pun.' },
  { id: 8, max: 5, text: 'NARASI. Scroll tetap jalan, hoaks nggak lolos.' },
];

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = fs.readFileSync(path.resolve(ROOT, '../backend/.env'), 'utf8');
  const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!m || !m[1].trim()) throw new Error('GEMINI_API_KEY tidak ditemukan di backend/.env');
  return m[1].trim();
}

function wavDuration(buf) {
  const rate = buf.readUInt32LE(28); // byte rate
  const dataIdx = buf.indexOf('data');
  return buf.readUInt32LE(dataIdx + 4) / rate;
}

async function tts(text, key) {
  const body = {
    contents: [{ role: 'user', parts: [{ text, speech_metadata: { style: STYLE } }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      responseFormat: { audio: { mimeType: 'AUDIO_WAV', sampleRate: 24000 } },
      speechConfig: { voiceConfig: { voice: VOICE } },
    },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = 15 * (attempt + 1);
      console.log(`  ${res.status}, coba lagi ${wait} detik…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
    const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!data) throw new Error('respons tanpa audio: ' + JSON.stringify(json).slice(0, 300));
    return Buffer.from(data, 'base64');
  }
  throw new Error('gagal setelah 4 percobaan');
}

const ffmpeg = (args) =>
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', ...args], { cwd: ROOT, shell: true, stdio: 'inherit' });

// Batas suara (detik) di WAV PCM 16-bit: sampel pertama/terakhir di atas -45 dBFS, plus sedikit bantalan.
function speechBounds(buf) {
  const ch = buf.readUInt16LE(22);
  const sr = buf.readUInt32LE(24);
  const di = buf.indexOf('data');
  const start = di + 8;
  const n = buf.readUInt32LE(di + 4) / 2 / ch;
  const thr = 32768 * Math.pow(10, -45 / 20);
  let first = 0;
  let last = n - 1;
  while (first < n && Math.abs(buf.readInt16LE(start + first * 2 * ch)) < thr) first++;
  while (last > first && Math.abs(buf.readInt16LE(start + last * 2 * ch)) < thr) last--;
  return { from: Math.max(0, first / sr - 0.04), to: Math.min(n / sr, last / sr + 0.1) };
}

// Sisakan 0,25 detik ruang napas di ujung scene.
function fit(line) {
  const raw = path.join(RAW, `s${line.id}.wav`);
  const { from, to } = speechBounds(fs.readFileSync(raw));
  const d = to - from;
  const target = line.max - 0.25;
  const tempo = d > target ? d / target : 1;
  const out = path.join(OUT, `s${line.id}.wav`);
  const af = `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,atempo=${tempo.toFixed(4)},loudnorm=I=-16:TP=-1.5:LRA=7`;
  ffmpeg(['-i', `"${raw}"`, '-af', `"${af}"`, '-ar', '48000', `"${out}"`]);
  console.log(`s${line.id}.wav ${d.toFixed(2)}s -> ${(d / tempo).toFixed(2)}s (tempo x${tempo.toFixed(2)}, maks ${line.max}s)`);
  return d / tempo;
}

// Durasi akhir tiap VO dipakai komposisi untuk ducking musik (src/vo.ts).
function writeDurations(durations) {
  const file = path.join(ROOT, 'src/vo.ts');
  const body = Object.entries(durations).map(([id, d]) => `  ${id}: ${d.toFixed(2)},`).join('\n');
  fs.writeFileSync(file, `// Dibuat oleh scripts/vo.mjs: durasi VO per scene (detik).\nexport const VO_SECONDS: Record<number, number> = {\n${body}\n};\n`);
}

const args = process.argv.slice(2);
const fitOnly = args.includes('--fit');
const only = args.filter((a) => a !== '--fit').map(Number);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });
const key = fitOnly ? '' : apiKey();
const durations = {};
for (const line of LINES) {
  const raw = path.join(RAW, `s${line.id}.wav`);
  if (!only.length || only.includes(line.id)) {
    if (!fitOnly) fs.writeFileSync(raw, await tts(line.text, key));
    durations[line.id] = fit(line);
  } else if (fs.existsSync(path.join(OUT, `s${line.id}.wav`))) {
    const { from, to } = speechBounds(fs.readFileSync(raw));
    durations[line.id] = Math.min(to - from, line.max - 0.25);
  }
}
writeDurations(durations);

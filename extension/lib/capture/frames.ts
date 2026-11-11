// Ambil ≤3 frame dari video aktif untuk OCR (FR03). Frame hanya dikirim, tidak disimpan.
// Frame yang hampir sama dengan frame sebelumnya tidak dikirim: teks layar video pendek umumnya statis,
// dan setiap gambar memakan ratusan token kuota LLM vision.

const CAPTURE_AT_MS = [300, 2300, 4300]; // waktu putar efektif sejak analisis dimulai
const MAX_SIDE = 480; // cukup untuk membaca teks layar; ±800 token per frame di LLM vision
const TICK_MS = 250;
const GIVE_UP_MS = 9000;
const SIGNATURE_SIZE = 8;
const SAME_FRAME_DIFF = 6; // rata-rata selisih kecerahan 0..255 pada thumbnail 8×8

type CaptureTab = () => Promise<string | null>;

interface Frame {
  dataUrl: string;
  signature: number[];
}

function drawScaled(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Frame {
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // SecurityError bila canvas "tainted"
  return { dataUrl, signature: signatureOf(canvas) };
}

/** Thumbnail abu-abu 8×8 untuk mendeteksi frame yang hampir identik. */
function signatureOf(source: HTMLCanvasElement): number[] {
  const thumb = document.createElement('canvas');
  thumb.width = thumb.height = SIGNATURE_SIZE;
  const ctx = thumb.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
  const { data } = ctx.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) out.push(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
  return out;
}

function sameFrame(a: number[], b: number[]): boolean {
  const diff = a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0) / a.length;
  return diff < SAME_FRAME_DIFF;
}

/** Cadangan saat canvas tainted: screenshot tab lalu potong ke area elemen. */
async function cropFromTab(el: Element, captureTab: CaptureTab): Promise<Frame | null> {
  const rect = el.getBoundingClientRect();
  const dataUrl = await captureTab();
  if (!dataUrl) return null;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const ratio = img.naturalWidth / innerWidth;
  const sx = Math.max(0, rect.left * ratio);
  const sy = Math.max(0, rect.top * ratio);
  const sw = Math.min(img.naturalWidth - sx, rect.width * ratio);
  const sh = Math.min(img.naturalHeight - sy, rect.height * ratio);
  if (sw <= 0 || sh <= 0) return null;
  return drawScaled(img, sx, sy, sw, sh);
}

/** Satu gambar dari elemen apa pun (foto postingan feed) lewat screenshot tab; null bila gagal. */
export async function captureElement(el: Element, captureTab: CaptureTab): Promise<string | null> {
  try {
    return (await cropFromTab(el, captureTab))?.dataUrl ?? null;
  } catch {
    return null;
  }
}

export class FrameCapturer {
  private frames: Frame[] = [];
  private shot = 0; // titik pengambilan berikutnya di CAPTURE_AT_MS
  private playedMs = 0;
  private elapsedMs = 0;
  private timer: number | undefined;
  private busy = false;
  private tainted = false;
  private stopped = false;

  constructor(
    private video: HTMLVideoElement,
    private captureTab: CaptureTab,
    private onDone: (frames: string[]) => void,
  ) {}

  start() {
    this.timer = window.setInterval(() => void this.tick(), TICK_MS);
  }

  stop() {
    this.stopped = true;
    window.clearInterval(this.timer);
  }

  private finish() {
    if (this.stopped) return;
    this.stop();
    this.onDone(this.frames.map((f) => f.dataUrl));
  }

  private async tick() {
    if (this.stopped || this.busy) return;
    this.elapsedMs += TICK_MS;
    const v = this.video;
    if (!v.paused && !v.ended && v.readyState >= 2) this.playedMs += TICK_MS;

    const next = CAPTURE_AT_MS[this.shot];
    if (next === undefined || v.ended || this.elapsedMs > GIVE_UP_MS) return this.finish();
    if (this.playedMs < next || v.readyState < 2) return;

    this.busy = true;
    try {
      const frame = await this.grab();
      if (!frame) return this.finish();
      this.shot += 1;
      if (!this.frames.some((f) => sameFrame(f.signature, frame.signature))) this.frames.push(frame);
    } finally {
      this.busy = false;
    }
    if (this.shot === CAPTURE_AT_MS.length) this.finish();
  }

  private async grab(): Promise<Frame | null> {
    const v = this.video;
    if (!this.tainted) {
      try {
        return drawScaled(v, 0, 0, v.videoWidth, v.videoHeight);
      } catch {
        this.tainted = true;
      }
    }
    try {
      return await cropFromTab(v, this.captureTab);
    } catch {
      return null;
    }
  }
}

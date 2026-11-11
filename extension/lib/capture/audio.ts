// Rekam 15 detik pertama audio video aktif dalam 3 potongan 5 detik (FR04).
// Setiap potongan direkam dengan MediaRecorder baru agar menjadi berkas webm utuh yang bisa
// ditranskripsi sendiri-sendiri. Audio hanya dikirim, tidak disimpan.

const SEGMENT_MS = 5000;
const SEGMENTS = 3;
const MIME = 'audio/webm;codecs=opus';
const TICK_MS = 250;

type MediaWithCapture = HTMLMediaElement & { captureStream?: () => MediaStream };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class AudioCapturer {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private segment = 0;
  private stopped = false;
  private segmentTimer: number | undefined;
  private onPause = () => this.recorder?.state === 'recording' && this.recorder.pause();
  private onPlay = () => this.recorder?.state === 'paused' && this.recorder.resume();

  constructor(
    private video: HTMLVideoElement,
    private onChunk: (dataUrl: string, index: number) => void,
    private onDone: (reason: 'complete' | 'unsupported' | 'ended') => void,
  ) {}

  start() {
    const media = this.video as MediaWithCapture;
    let tracks: MediaStreamTrack[] = [];
    try {
      tracks = media.captureStream?.().getAudioTracks() ?? [];
    } catch {
      // Media lintas-origin tanpa CORS tidak bisa direkam.
    }
    if (!tracks.length || !MediaRecorder.isTypeSupported(MIME)) {
      this.stopped = true;
      this.onDone('unsupported');
      return;
    }
    this.stream = new MediaStream(tracks);
    this.video.addEventListener('pause', this.onPause);
    this.video.addEventListener('play', this.onPlay);
    this.video.addEventListener('ended', this.onEnded);
    this.record();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.segmentTimer);
    this.video.removeEventListener('pause', this.onPause);
    this.video.removeEventListener('play', this.onPlay);
    this.video.removeEventListener('ended', this.onEnded);
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
  }

  private onEnded = () => {
    window.clearTimeout(this.segmentTimer);
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
  };

  private record() {
    if (this.stopped || !this.stream) return;
    const index = this.segment;
    const parts: Blob[] = [];
    const recorder = new MediaRecorder(this.stream, { mimeType: MIME, audioBitsPerSecond: 32000 });
    this.recorder = recorder;
    recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
    recorder.onstop = async () => {
      if (this.stopped) return;
      const blob = new Blob(parts, { type: 'audio/webm' });
      if (blob.size > 1000) this.onChunk(await blobToDataUrl(blob), index);
      this.segment += 1;
      if (this.video.ended) {
        this.finish('ended');
      } else if (this.segment < SEGMENTS) {
        this.record();
      } else {
        this.finish('complete');
      }
    };
    recorder.start();
    if (this.video.paused) recorder.pause();
    this.stopAfterPlaying(recorder);
  }

  /** Hentikan potongan setelah 5 detik waktu PUTAR (saat video dijeda, waktu tidak dihitung). */
  private stopAfterPlaying(recorder: MediaRecorder) {
    let playedMs = 0;
    const tick = () => {
      if (this.stopped || recorder.state === 'inactive') return;
      if (recorder.state === 'recording') playedMs += TICK_MS;
      if (playedMs >= SEGMENT_MS) recorder.stop();
      else this.segmentTimer = window.setTimeout(tick, TICK_MS);
    };
    this.segmentTimer = window.setTimeout(tick, TICK_MS);
  }

  private finish(reason: 'complete' | 'ended') {
    const wasStopped = this.stopped;
    this.stop();
    if (!wasStopped) this.onDone(reason);
  }
}

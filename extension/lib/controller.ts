import type { Adapter } from './adapters';
import { fallbackId } from './adapters/dom';
import { captureVideo, type CaptureHandle } from './capture/session';
import { send, type StartResponse } from './messages';
import { applySessionEvent } from './session-events';
import { enabledItem, modeItem, platformsItem } from './settings';
import { useOverlay, type Geometry } from './store';
import type { Mode } from './types';

const TICK_MS = 400;
const DEBOUNCE_MS = 600; // scroll cepat: video yang hanya dilewati tidak dianalisis
const CAPTION_WAIT_MS = 1200;
const OVERLAY_TAG = 'NARASI-OVERLAY'; // nama shadow host dari createShadowRootUi

interface Active {
  key: string;
  videoId: string;
  video: HTMLVideoElement;
  capture?: CaptureHandle;
}

/** Mendeteksi video aktif, memulai/membatalkan analisis, dan menangkap frame/audio (FR02–FR04, FR11). */
export class Controller {
  private active: Active | null = null;
  private pending: { key: string; since: number } | null = null;
  private timer: number | undefined;
  private enabled = false;
  private mode: Mode = 'multimodal';
  private prefetched = new Set<string>();
  private unwatch: (() => void)[] = [];

  constructor(private adapter: Adapter) {}

  async start() {
    await this.refreshSettings();
    this.unwatch.push(
      enabledItem.watch(() => this.refreshSettings()),
      platformsItem.watch(() => this.refreshSettings()),
      modeItem.watch((m) => (this.mode = m)),
    );
    browser.runtime.onMessage.addListener(this.onMessage);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  destroy() {
    this.reset();
    window.clearInterval(this.timer);
    removeEventListener('scroll', this.onScroll, { capture: true });
    browser.runtime.onMessage.removeListener(this.onMessage);
    this.unwatch.forEach((fn) => fn());
  }

  private async refreshSettings() {
    const [enabled, platforms, mode] = await Promise.all([
      enabledItem.getValue(), platformsItem.getValue(), modeItem.getValue(),
    ]);
    this.enabled = enabled && platforms[this.adapter.platform] !== false;
    this.mode = mode;
    send({ type: 'status', active: this.enabled }).catch(() => {});
    if (!this.enabled) this.reset();
  }

  private onScroll = (e: Event) => {
    // Scroll di dalam panel NARASI sendiri (shadow root diretarget ke host) bukan perpindahan video.
    if (e.target instanceof Element && e.target.tagName === OVERLAY_TAG) return;
    // Badge lama harus hilang seketika saat video berganti, tanpa menunggu tick berikutnya.
    if (this.active && this.adapter.findActiveVideo() !== this.active.video) this.tick();
  };

  private tick() {
    if (!this.enabled) return;
    const video = this.adapter.findActiveVideo();
    const videoId = video
      ? this.adapter.getVideoId(video) ?? fallbackId(video, this.adapter.getCaption(video).caption)
      : null;
    if (!video || !videoId) {
      // Saat panel terbuka pengguna sedang membaca bukti: pertahankan sampai video lain benar-benar aktif.
      if (this.active && !useOverlay.getState().panelOpen) this.reset();
      this.pending = null;
      return;
    }
    const key = `${this.adapter.platform}:${videoId}`;
    if (this.active?.key === key) {
      if (this.active.video !== video) {
        // Platform merender ulang elemen video untuk konten yang sama: cukup pindahkan jangkar.
        this.active.video = video;
        useOverlay.setState({ geometry: this.geometry(video) });
      }
      return;
    }

    if (this.active && this.active.key !== key) this.reset();
    if (this.pending?.key !== key) {
      this.pending = { key, since: performance.now() };
      return;
    }
    if (performance.now() - this.pending.since < DEBOUNCE_MS) return;
    this.pending = null;
    void this.analyze(key, videoId, video);
  }

  private reset() {
    if (this.active) {
      this.active.capture?.stop();
      send({ type: 'analyze:cancel', key: this.active.key }).catch(() => {});
    }
    this.active = null;
    useOverlay.getState().clear();
  }

  private geometry(video: HTMLVideoElement): () => Geometry | null {
    return () => {
      if (!video.isConnected) return null;
      const anchor = this.adapter.getAnchor(video);
      return { anchor: anchor?.getBoundingClientRect() ?? null, video: video.getBoundingClientRect() };
    };
  }

  private async waitForCaption(video: HTMLVideoElement) {
    const deadline = performance.now() + CAPTION_WAIT_MS;
    let info = this.adapter.getCaption(video);
    while (!info.caption && performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
      info = this.adapter.getCaption(video);
    }
    return info;
  }

  private async analyze(key: string, videoId: string, video: HTMLVideoElement) {
    const active: Active = { key, videoId, video };
    this.active = active;
    const overlay = useOverlay.getState();
    overlay.begin({
      key, platform: this.adapter.platform, videoId, geometry: this.geometry(video),
      retry: () => {
        if (this.active === active) {
          this.active = null;
          void this.analyze(key, videoId, video);
        }
      },
    });

    const { caption, hashtags } = await this.waitForCaption(video);
    if (this.active !== active) return;
    const mode = this.mode;

    let res: StartResponse;
    try {
      res = await send<StartResponse>({
        type: 'analyze:start', key,
        payload: { platform: this.adapter.platform, video_id: videoId, url: location.href, caption, hashtags, mode },
      });
    } catch (err) {
      res = { ok: false, error: String(err) };
    }
    if (this.active !== active) return;
    this.prefetchNext(video);
    if (!res.ok) return useOverlay.getState().fail(res.error);
    if (res.cached) return useOverlay.getState().setResult(res.result);
    if (mode === 'multimodal' && (res.accepts.frames || res.accepts.audio)) {
      active.capture = captureVideo({ key, video, accepts: res.accepts, isActive: () => this.active === active, send });
    } else {
      send({ type: 'analyze:complete', key }).catch(() => {});
    }
  }

  private prefetchNext(video: HTMLVideoElement) {
    const next = this.adapter.findNextVideo(video);
    const id = next && this.adapter.getVideoId(next);
    if (!next || !id || this.prefetched.has(id)) return;
    const { caption } = this.adapter.getCaption(next);
    if (!caption) return;
    this.prefetched.add(id);
    send({ type: 'prefetch', platform: this.adapter.platform, videoId: id, caption }).catch(() => {});
  }

  private onMessage = (raw: unknown) => {
    applySessionEvent(raw, this.active?.key);
  };
}

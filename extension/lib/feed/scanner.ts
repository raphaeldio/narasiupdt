import { captureElement } from '../capture/frames';
import { captureVideo, type CaptureHandle } from '../capture/session';
import { send, type ScanResponse, type StartResponse } from '../messages';
import { applySessionEvent } from '../session-events';
import { enabledItem, feedEnabledItem, modeItem, platformsItem } from '../settings';
import { useOverlay } from '../store';
import type { Mode, ScanItem } from '../types';
import { visibleImage } from './dom';
import { ScanQueue } from './queue';
import { MAX_ITEMS, useFeed } from './store';
import type { FeedAdapter, FeedItem } from './types';

const TICK_MS = 400;
const FLUSH_MS = 500;
const DWELL_MS = 400; // postingan yang hanya dilewati saat scroll cepat tidak discan
const VISIBLE = 0.4;

const toScanItem = ({ id, kind, text, hashtags, url }: FeedItem): ScanItem => ({ id, kind, text, hashtags, url });
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

interface Active {
  key: string;
  id: string;
  capture?: CaptureHandle;
}

/** Scan teks semua postingan feed yang terlihat; analisis penuh hanya untuk postingan yang chip-nya diklik. */
export class FeedScanner {
  private items = new Map<string, FeedItem>(); // elemen terkini per ID
  private visibleSince = new Map<Element, number>(); // ≥40% terlihat sejak
  private onScreen = new Set<Element>(); // terlihat sedikit pun (untuk posisi chip)
  private observer: IntersectionObserver;
  private queue: ScanQueue;
  private active: Active | null = null;
  private enabled = false;
  private mode: Mode = 'multimodal';
  private timers: number[] = [];
  private unwatch: (() => void)[] = [];
  private lastFound = -1;

  constructor(private adapter: FeedAdapter) {
    this.observer = new IntersectionObserver((entries) => {
      const now = performance.now();
      for (const e of entries) {
        if (e.isIntersecting) this.onScreen.add(e.target);
        else this.onScreen.delete(e.target);
        if (e.intersectionRatio >= VISIBLE) this.visibleSince.set(e.target, this.visibleSince.get(e.target) ?? now);
        else this.visibleSince.delete(e.target);
      }
    }, { threshold: [0, VISIBLE, 1] });
    this.queue = new ScanQueue(async (items) => {
      const res = await send<ScanResponse>({ type: 'feed:scan', platform: adapter.platform, items }).catch(() => null);
      return res?.ok ? res.results : null;
    });
  }

  async start() {
    await this.refreshSettings();
    this.unwatch.push(
      enabledItem.watch(() => this.refreshSettings()),
      platformsItem.watch(() => this.refreshSettings()),
      feedEnabledItem.watch(() => this.refreshSettings()),
      modeItem.watch((m) => (this.mode = m)),
    );
    browser.runtime.onMessage.addListener(this.onMessage);
    this.timers.push(
      window.setInterval(() => this.tick(), TICK_MS),
      window.setInterval(() => void this.queue.flush(), FLUSH_MS),
    );
    useFeed.getState().setSource({
      platform: this.adapter.platform,
      visible: () => [...this.items.values()].filter((i) => this.onScreen.has(i.root)).map((i) => ({ id: i.id, anchor: i.anchor })),
      open: (id) => void this.open(id),
    });
  }

  destroy() {
    this.close();
    this.timers.forEach((t) => window.clearInterval(t));
    this.unwatch.forEach((fn) => fn());
    browser.runtime.onMessage.removeListener(this.onMessage);
    this.observer.disconnect();
    this.queue.clear();
    useFeed.getState().setSource(null);
    useFeed.getState().clear();
  }

  private async refreshSettings() {
    const [enabled, platforms, feed, mode] = await Promise.all([
      enabledItem.getValue(), platformsItem.getValue(), feedEnabledItem.getValue(), modeItem.getValue(),
    ]);
    this.enabled = enabled && feed && platforms[this.adapter.platform] !== false;
    this.mode = mode;
    send({ type: 'status', active: this.enabled }).catch(() => {});
    if (!this.enabled) {
      this.close();
      this.queue.clear();
      useFeed.getState().clear();
    }
  }

  private tick() {
    if (!this.enabled) return;
    const now = performance.now();
    const found = this.adapter.findItems();
    if (found.length !== this.lastFound) {
      // Diagnostik di DevTools: 0 berarti selector feed tidak cocok dengan DOM platform saat ini.
      this.lastFound = found.length;
      console.info(`[NARASI] feed ${this.adapter.platform}: ${found.length} postingan terdeteksi`);
    }
    for (const item of found) {
      const prev = this.items.get(item.id);
      if (prev?.root !== item.root) {
        // Feed merender ulang postingan yang sama: pindahkan observasi ke elemen baru.
        if (prev) this.forget(prev.root);
        this.observer.observe(item.root);
      }
      this.items.delete(item.id);
      this.items.set(item.id, item);
      const since = this.visibleSince.get(item.root);
      if (since !== undefined && now - since >= DWELL_MS) this.queue.enqueue(toScanItem(item));
    }
    for (const [id, item] of this.items) {
      if (this.items.size <= MAX_ITEMS) break;
      this.forget(item.root);
      this.items.delete(id);
    }
  }

  private forget(root: Element) {
    this.observer.unobserve(root);
    this.visibleSince.delete(root);
    this.onScreen.delete(root);
  }

  private close() {
    if (!this.active) return;
    this.active.capture?.stop();
    send({ type: 'analyze:cancel', key: this.active.key }).catch(() => {});
    this.active = null;
    useOverlay.getState().clear();
  }

  async open(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    this.close();
    const key = `${this.adapter.platform}:${id}`;
    const active: Active = { key, id };
    this.active = active;
    const isActive = () => this.active === active;
    const mode: Mode = item.kind === 'text' ? 'caption' : this.mode;

    // Foto diambil sebelum panel terbuka agar screenshot tab tidak tertutup panel.
    let frame: string | null = null;
    if (item.kind === 'image' && mode === 'multimodal') {
      await nextFrame();
      const img = visibleImage(item.root);
      frame = img && (await captureElement(img, () => send<string | null>({ type: 'capture:tab' })));
      if (!isActive()) return;
    }

    const overlay = useOverlay.getState();
    overlay.begin({
      key, platform: this.adapter.platform, videoId: id,
      geometry: () => {
        const cur = this.items.get(id);
        if (!cur?.root.isConnected) return null;
        return { anchor: cur.anchor.getBoundingClientRect(), video: cur.root.getBoundingClientRect() };
      },
      retry: () => void this.open(id),
    });
    overlay.togglePanel(true);

    let res: StartResponse;
    try {
      res = await send<StartResponse>({
        type: 'analyze:start', key,
        payload: { platform: this.adapter.platform, video_id: id, url: item.url, caption: item.text, hashtags: item.hashtags, mode },
      });
    } catch (err) {
      res = { ok: false, error: String(err) };
    }
    if (!isActive()) return;
    if (!res.ok) return useOverlay.getState().fail(res.error);
    if (res.cached) {
      useOverlay.getState().setResult(res.result);
      useFeed.getState().final(id, res.result, Date.now());
      return;
    }
    if (mode === 'multimodal' && item.kind === 'video' && item.media instanceof HTMLVideoElement
        && (res.accepts.frames || res.accepts.audio)) {
      active.capture = captureVideo({ key, video: item.media, accepts: res.accepts, isActive, send });
      return;
    }
    if (item.kind === 'image' && mode === 'multimodal' && res.accepts.frames) {
      if (frame) send({ type: 'analyze:frames', key, frames: [frame] }).catch(() => {});
      else useOverlay.getState().note('Gambar tidak dapat dibaca.');
    }
    send({ type: 'analyze:complete', key }).catch(() => {});
  }

  private onMessage = (raw: unknown) => {
    const active = this.active;
    const msg = applySessionEvent(raw, active?.key);
    if (active && msg?.type === 'analyze:event' && msg.event === 'result' && msg.data.final) {
      useFeed.getState().final(active.id, msg.data, Date.now());
    }
  };
}

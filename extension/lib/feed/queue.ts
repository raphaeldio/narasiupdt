import type { ScanItem, ScanResult } from '../types';
import { useFeed } from './store';

export const BATCH_SIZE = 10;
export const RETRY_AFTER_MS = 30_000;
export const PAUSE_AFTER_FAILURES = 3;
export const PAUSE_MS = 60_000;

type Send = (items: ScanItem[]) => Promise<ScanResult[] | null>;

/** Antrean scan feed: dedupe per ID, batch ≤10, satu percobaan ulang, jeda saat backend bermasalah. */
export class ScanQueue {
  private pending = new Map<string, ScanItem>();
  private failures = 0;
  private pausedUntil = 0;
  private inflight = false;

  constructor(private send: Send, private now: () => number = Date.now) {}

  enqueue(item: ScanItem) {
    const entry = useFeed.getState().entries.get(item.id);
    const retry = entry?.status === 'error' && !entry.retried && this.now() - entry.at >= RETRY_AFTER_MS;
    if (entry && !retry) return;
    this.pending.set(item.id, item);
  }

  async flush() {
    if (this.inflight || !this.pending.size || this.now() < this.pausedUntil) return;
    const batch = [...this.pending.values()].slice(0, BATCH_SIZE);
    for (const i of batch) this.pending.delete(i.id);
    const ids = batch.map((i) => i.id);
    useFeed.getState().queued(ids, this.now());
    this.inflight = true;
    try {
      const results = await this.send(batch);
      if (!results) throw new Error('scan gagal');
      this.failures = 0;
      useFeed.getState().resolved(results, this.now());
      const missing = ids.filter((id) => !results.some((r) => r.id === id));
      if (missing.length) useFeed.getState().failed(missing, this.now());
    } catch {
      useFeed.getState().failed(ids, this.now());
      if (++this.failures >= PAUSE_AFTER_FAILURES) {
        this.failures = 0;
        this.pausedUntil = this.now() + PAUSE_MS;
      }
    } finally {
      this.inflight = false;
    }
  }

  clear() {
    this.pending.clear();
  }
}

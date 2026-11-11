import { create } from 'zustand';
import type { AnalysisResult, Label, Platform, ScanResult } from '../types';

export const MAX_ITEMS = 500; // feed tanpa ujung: hasil lama dibuang (LRU)

export type FeedStatus = 'queued' | 'done' | 'error';

export interface FeedEntry {
  status: FeedStatus;
  label: Label | null;
  score: number | null;
  tniRelated: boolean;
  at: number;
  retried: boolean;
}

/** Jembatan dari FeedScanner ke komponen chip. */
export interface FeedSource {
  platform: Platform;
  visible(): { id: string; anchor: Element }[];
  open(id: string): void;
}

interface FeedState {
  entries: Map<string, FeedEntry>;
  source: FeedSource | null;
  queued(ids: string[], now: number): void;
  resolved(results: ScanResult[], now: number): void;
  failed(ids: string[], now: number): void;
  final(id: string, result: AnalysisResult, now: number): void;
  setSource(source: FeedSource | null): void;
  clear(): void;
}

const EMPTY: Omit<FeedEntry, 'status' | 'at'> = { label: null, score: null, tniRelated: false, retried: false };

function upsert(entries: Map<string, FeedEntry>, updates: [string, FeedEntry][]): Map<string, FeedEntry> {
  const next = new Map(entries);
  for (const [id, entry] of updates) {
    next.delete(id); // sisipkan ulang agar menjadi yang terbaru
    next.set(id, entry);
  }
  for (const id of next.keys()) {
    if (next.size <= MAX_ITEMS) break;
    next.delete(id);
  }
  return next;
}

export const useFeed = create<FeedState>()((set) => ({
  entries: new Map(),
  source: null,
  queued: (ids, now) => set((s) => ({
    entries: upsert(s.entries, ids.map((id) => {
      const prev = s.entries.get(id);
      return [id, { ...(prev ?? EMPTY), status: 'queued', at: now, retried: prev?.status === 'error' }];
    })),
  })),
  resolved: (results, now) => set((s) => ({
    entries: upsert(s.entries, results.map((r) => [r.id, {
      status: r.label === 'error' ? 'error' : 'done', label: r.label === 'error' ? null : r.label,
      score: r.score, tniRelated: r.tni_related, at: now, retried: s.entries.get(r.id)?.retried ?? false,
    }])),
  })),
  failed: (ids, now) => set((s) => ({
    entries: upsert(s.entries, ids.map((id) => {
      const prev = s.entries.get(id);
      return [id, { ...(prev ?? EMPTY), status: 'error', at: now, retried: prev?.retried ?? false }];
    })),
  })),
  final: (id, result, now) => set((s) => ({
    entries: upsert(s.entries, [[id, {
      status: 'done', label: result.label, score: result.score, tniRelated: result.tni_related, at: now, retried: false,
    }]]),
  })),
  setSource: (source) => set({ source }),
  clear: () => set({ entries: new Map() }),
}));

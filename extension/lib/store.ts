import { create } from 'zustand';
import type { AnalysisResult, Platform, StageEvent, StageName, StageStatus } from './types';

export type Status = 'idle' | 'loading' | 'partial' | 'final' | 'error';

export interface Geometry {
  anchor: DOMRect | null;
  video: DOMRect;
}

interface OverlayState {
  key: string | null;
  platform: Platform | null;
  videoId: string | null;
  status: Status;
  stages: Partial<Record<StageName, StageStatus>>;
  result: AnalysisResult | null;
  error: string | null;
  panelOpen: boolean;
  geometry: (() => Geometry | null) | null;
  retry: (() => void) | null;
  /** Catatan dari sisi extension (mis. gambar gagal diambil), ditampilkan bersama catatan server. */
  notes: string[];

  begin(args: { key: string; platform: Platform; videoId: string; geometry: () => Geometry | null; retry: () => void }): void;
  stage(e: StageEvent): void;
  setResult(result: AnalysisResult): void;
  fail(message: string): void;
  done(): void;
  togglePanel(open?: boolean): void;
  note(text: string): void;
  clear(): void;
}

const initial = {
  key: null, platform: null, videoId: null, status: 'idle' as Status, stages: {}, result: null,
  error: null, panelOpen: false, geometry: null, retry: null, notes: [] as string[],
};

export const useOverlay = create<OverlayState>()((set, get) => ({
  ...initial,
  begin: ({ key, platform, videoId, geometry, retry }) =>
    set({ ...initial, key, platform, videoId, geometry, retry, status: 'loading', stages: { caption: 'started' } }),
  stage: (e) => set((s) => ({ stages: { ...s.stages, [e.stage]: e.status } })),
  setResult: (result) => set({ result, status: result.final ? 'final' : 'partial', error: null }),
  fail: (message) => {
    // Hasil sebagian yang sudah ada tetap ditampilkan; galat hanya mengganti status kosong.
    if (get().result) set({ status: 'final' });
    else set({ status: 'error', error: message });
  },
  done: () => {
    const s = get();
    if (s.result) set({ status: 'final' });
    else if (s.status !== 'error') set({ status: 'error', error: 'Tidak ada hasil dari server' });
  },
  togglePanel: (open) => set((s) => ({ panelOpen: open ?? !s.panelOpen })),
  note: (text) => set((s) => (s.notes.includes(text) ? s : { notes: [...s.notes, text] })),
  clear: () => set({ ...initial }),
}));

/** Tahap yang sedang berjalan, untuk teks loading bertahap di badge. */
export function activeStage(stages: Partial<Record<StageName, StageStatus>>): StageName | null {
  for (const name of ['audio', 'ocr', 'caption'] as StageName[]) {
    if (stages[name] === 'started') return name;
  }
  return null;
}

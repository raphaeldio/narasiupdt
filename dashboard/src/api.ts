// Klien API backend NARASI untuk petugas (endpoint dilindungi X-Dashboard-Token bila diset).

export type Label = 'hoax' | 'caution' | 'supported' | 'unverified' | 'satire' | 'neutral' | 'error';
export type Basis = 'evidence' | 'signals' | 'ai' | 'none';
export type ReportStatus = 'baru' | 'ditinjau' | 'ditindaklanjuti' | 'ditutup';
export type Level = 'tinggi' | 'sedang' | 'rendah';
export type Urgency = 'segera' | 'hari_ini' | 'pantau';

export interface Alert {
  video_key: string;
  platform: string;
  video_id: string;
  url: string | null;
  label: Label;
  score: number | null;
  tni_related: boolean;
  claim: string | null;
  topic: string;
  language: string;
  basis: Basis;
  viewers_1h: number;
  viewers_prev_1h: number;
  viewers_window: number;
  reports: number;
  open_reports: number;
  rising: boolean;
  priority: number;
  level: Level;
  first_seen: number;
  last_seen: number;
}

export interface Report {
  id: string;
  created: number;
  updated: number;
  video_key: string;
  platform: string;
  video_id: string;
  url: string;
  reason: 'mencatut_tni' | 'provokasi' | 'hoaks' | 'lainnya';
  note: string;
  label: Label | null;
  score: number | null;
  tni_related: boolean;
  claims: { id: string; text: string; source: string; kind: string }[];
  evidence: { publisher: string; title: string; url: string; rating: string; reason?: string | null }[];
  status: ReportStatus;
  status_note: string;
}

export type TimelineRow = { hours_ago: number } & Record<
  'hoax' | 'caution' | 'supported' | 'unverified' | 'satire' | 'neutral', number>;

export interface Stats {
  window_hours: number;
  total_checks: number;
  cache_hit_rate: number;
  identified_rate: number;
  labels: Partial<Record<Label, number>>;
  basis: Partial<Record<Basis, number>>;
  languages: Record<string, number>;
  foreign_checks: number;
  topics: { topic: string; total: number; flagged: number; labels: Partial<Record<Label, number>> }[];
  top_claims: { claim: string; count: number }[];
  platforms: Record<string, number>;
  tni_checks: number;
  tni_hoax_or_caution: number;
  timeline: TimelineRow[];
  feedback_pending: number;
}

export interface ActionSpec {
  title: string;
  owner: string;
  how: string;
  delay_hours: number;
  growth_cut: number;
  reach_cut: number;
  effort: string;
}

export interface Recommendation {
  id: string;
  title: string;
  owner: string;
  how: string;
  urgency: Urgency;
  why: string;
  done: boolean;
}

/** Satu narasi = gabungan video dengan klaim serupa (unggahan ulang di beberapa platform). */
export interface Narrative {
  key: string;
  claim: string | null;
  topic: string;
  basis: Basis;
  language: string;
  level: Level;
  rising: boolean;
  tni_related: boolean;
  label: Label;
  score: number | null;
  videos: number;
  platforms: Record<string, number>;
  viewers_1h: number;
  viewers_prev_1h: number;
  viewers_window: number;
  reports: number;
  open_reports: number;
  first_seen: number;
  last_seen: number;
  top_videos: { platform: string; video_id: string; url: string | null; viewers_1h: number; reports: number }[];
  actions: Recommendation[];
  sim: { rate: number; growth: number; reach: number };
}

export interface Summary {
  status: 'siaga' | 'waspada' | 'normal';
  headline: string;
  levels: Record<Level, number>;
  rising: number;
  videos_flagged: number;
  narratives: Narrative[];
  narratives_total: number;
  tni_narratives: number;
  topics: { topic: string; label: string; narratives: number; videos: number; viewers_1h: number; tinggi: number }[];
  action_catalog: Record<string, ActionSpec>;
  actions_taken: { id: string; ts: number; narrative: string; action: string; note: string }[];
  reports: {
    by_status: Partial<Record<ReportStatus, number>>;
    open_by_reason: Partial<Record<Report['reason'], number>>;
    open: number;
    latest_open: { id: string; created: number; platform: string; reason: Report['reason']; note: string;
      label: Label | null; score: number | null; claim: string | null }[];
  };
  stats: Stats;
  generated_at: number;
}

/** Peristiwa pipeline dari /v1/stream. Tidak memuat identitas penonton. */
export interface LiveEvent {
  id: number;
  ts: number;
  type: 'masuk' | 'tahap' | 'klaim' | 'bukti' | 'vonis' | 'pindai' | 'laporan' | 'peringatan' | 'aksi';
  platform?: string;
  key?: string;
  cached?: boolean;
  stage?: 'caption' | 'ocr' | 'audio';
  count?: number;
  topics?: string[] | Record<string, number>;
  topic?: string;
  language?: string;
  tni?: boolean;
  origins?: Record<string, number>;
  label?: Label;
  labels?: Partial<Record<Label, number>>;
  score?: number | null;
  basis?: Basis;
  claim?: string | null;
  risk?: number;
  reason?: string;
  level?: Level;
  rising?: boolean;
  action?: string;
  title?: string;
  narrative?: string;
}

export interface LiveSnapshot {
  events: LiveEvent[];
  since: number;
  totals: Record<string, number>;
  per_minute: Record<string, number>;
  providers: Record<string, boolean | string | string[]>;
  feeds: { entries: number; refreshed_at: number | null; sources: Record<string, number | string> } | null;
  active_sessions: number;
  usage: { calls: Record<string, number>; llm_calls: number; llm_saved: number; llm_saving_rate: number };
}

export class Unauthorized extends Error {}

export interface Connection {
  baseUrl: string;
  token: string;
}

const base = (c: Connection) => c.baseUrl.replace(/\/+$/, '');
const auth = (c: Connection): Record<string, string> => (c.token ? { 'X-Dashboard-Token': c.token } : {});

async function request<T>(conn: Connection, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base(conn)}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...auth(conn), ...init.headers },
  });
  if (res.status === 401) throw new Unauthorized('Token dashboard tidak valid');
  if (!res.ok) throw new Error(`Server membalas ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Berlangganan SSE lewat fetch (bukan EventSource) supaya token bisa dikirim di header.
 * Mengembalikan fungsi untuk berhenti. `onState` memberi tahu tersambung/terputus.
 */
export function openStream(conn: Connection, onEvent: (e: LiveEvent) => void, onState: (live: boolean) => void): () => void {
  const controller = new AbortController();
  let stopped = false;

  async function run() {
    while (!stopped) {
      try {
        const res = await fetch(`${base(conn)}/v1/stream`, { headers: auth(conn), signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        onState(true);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value.replace(/\r\n/g, '\n');
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
            if (!data) continue;
            try {
              onEvent(JSON.parse(data) as LiveEvent);
            } catch {
              // baris bukan JSON (komentar keep-alive): lewati
            }
          }
        }
      } catch {
        // jaringan putus atau server mati: coba lagi
      }
      onState(false);
      if (!stopped) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  void run();
  return () => {
    stopped = true;
    controller.abort();
  };
}

export const api = {
  summary: (c: Connection, hours: number) => request<Summary>(c, `/v1/summary?hours=${hours}`),
  alerts: (c: Connection, hours: number) => request<Alert[]>(c, `/v1/alerts?hours=${hours}`),
  reports: (c: Connection) => request<Report[]>(c, '/v1/reports'),
  live: (c: Connection) => request<LiveSnapshot>(c, '/v1/live'),
  updateReport: (c: Connection, id: string, status: ReportStatus, note: string) =>
    request<Report>(c, `/v1/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  recordAction: (c: Connection, narrative: string, action: string) =>
    request<{ id: string }>(c, '/v1/actions', { method: 'POST', body: JSON.stringify({ narrative, action }) }),
  /** Kirim satu contoh ke pipeline sungguhan (platform "testbed") untuk menguji arus data. */
  sample: (c: Connection, videoId: string, caption: string) =>
    request<unknown>(c, '/v1/analyze', {
      method: 'POST',
      body: JSON.stringify({ platform: 'testbed', video_id: videoId, url: '', caption, hashtags: [], mode: 'caption' }),
    }),
};

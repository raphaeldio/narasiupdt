import { useCallback, useEffect, useRef, useState } from 'react';
import { api, openStream, type Connection, type LiveEvent, type LiveSnapshot } from '@/api';

const KEEP = 150;
const FLUSH_MS = 250;

/** Kunci unik peristiwa: nomor urut backend kembali ke 1 saat server dimulai ulang, jadi waktu ikut dipakai. */
export const eventKey = (e: LiveEvent) => `${e.ts}:${e.id}`;

/** Riwayat (/v1/live) dan aliran (/v1/stream) bisa memuat peristiwa yang sama; simpan satu, terbaru di depan. */
function unique(events: LiveEvent[]): LiveEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => !seen.has(eventKey(e)) && seen.add(eventKey(e))).sort((x, y) => y.ts - x.ts);
}

export interface Live {
  connected: boolean;
  events: LiveEvent[];            // terbaru di depan
  snapshot: LiveSnapshot | null;
  perSecond: number[];            // 60 ember, indeks terakhir = detik ini
  /** Dipanggil untuk SETIAP peristiwa baru (bukan riwayat), mis. untuk memunculkan partikel. */
  subscribe: (fn: (e: LiveEvent) => void) => () => void;
}

/** Riwayat awal dari /v1/live, lalu aliran SSE. Pembaruan state dikelompokkan agar banjir peristiwa tidak membekukan UI. */
export function useLive(conn: Connection): Live {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [perSecond, setPerSecond] = useState<number[]>(() => Array(60).fill(0));
  const listeners = useRef(new Set<(e: LiveEvent) => void>());
  const pending = useRef<LiveEvent[]>([]);
  const stamps = useRef<number[]>([]);

  const subscribe = useCallback((fn: (e: LiveEvent) => void) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  useEffect(() => {
    let alive = true;
    setEvents([]);
    setSnapshot(null);
    stamps.current = [];

    const refreshSnapshot = () =>
      api.live(conn).then((s) => {
        if (!alive) return;
        setSnapshot(s);
        return s;
      }).catch(() => undefined);

    void refreshSnapshot().then((s) => {
      if (s && alive) setEvents((cur) => unique([...cur, ...[...s.events].reverse()]).slice(0, KEEP));
    });

    const stop = openStream(conn, (e) => {
      pending.current.push(e);
      stamps.current.push(Date.now());
      listeners.current.forEach((fn) => fn(e));
    }, (live) => alive && setConnected(live));

    const flush = setInterval(() => {
      if (pending.current.length) {
        const batch = pending.current.reverse();
        pending.current = [];
        setEvents((cur) => unique([...batch, ...cur]).slice(0, KEEP));
      }
      const now = Date.now();
      stamps.current = stamps.current.filter((t) => t > now - 60_000);
      const buckets = Array(60).fill(0) as number[];
      for (const t of stamps.current) {
        const i = 59 - Math.floor((now - t) / 1000);
        if (i >= 0 && i < 60) buckets[i] = (buckets[i] ?? 0) + 1;
      }
      setPerSecond(buckets);
    }, FLUSH_MS);
    const poll = setInterval(() => document.visibilityState === 'visible' && void refreshSnapshot(), 10_000);

    return () => {
      alive = false;
      stop();
      clearInterval(flush);
      clearInterval(poll);
    };
  }, [conn]);

  return { connected, events, snapshot, perSecond, subscribe };
}

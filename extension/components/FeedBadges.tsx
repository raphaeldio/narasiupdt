import { useEffect, useState } from 'react';
import { useFeed, type FeedEntry } from '@/lib/feed/store';
import { useOverlay } from '@/lib/store';
import type { Label } from '@/lib/types';
import { LABELS } from './labels';

const EDGE = 8;
const GAP = 6;
const CHIP_HEIGHT = 24;
const CHIP_WIDTH = 220; // perkiraan lebar chip terlebar, untuk menjaga chip di dalam layar
const DIM: Label[] = ['supported', 'unverified', 'satire', 'neutral']; // aman: tampil samar agar feed tidak ramai

type Positions = [string, { left: number; top: number }][];

/** Satu chip per postingan feed yang terlihat; postingan yang sedang dianalisis penuh memakai Badge biasa. */
export function FeedBadges() {
  const source = useFeed((s) => s.source);
  const entries = useFeed((s) => s.entries);
  const activeKey = useOverlay((s) => s.key);
  const [positions, setPositions] = useState<Positions>([]);

  useEffect(() => {
    if (!source) return setPositions([]);
    let frame = 0;
    let last = '';
    const loop = () => {
      const next: Positions = [];
      for (const { id, anchor } of source.visible()) {
        const r = anchor.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
        next.push([id, {
          left: Math.min(Math.max(r.left, EDGE), innerWidth - CHIP_WIDTH - EDGE),
          top: Math.max(EDGE, r.top - CHIP_HEIGHT - GAP),
        }]);
      }
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setPositions(next);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [source]);

  if (!source) return null;
  return (
    <div className="nr-layer">
      {positions.map(([id, p]) => {
        const entry = entries.get(id);
        if (!entry || activeKey === `${source.platform}:${id}`) return null;
        return (
          <div key={id} className="nr-anchor" style={{ left: p.left, top: p.top }}>
            <FeedChip id={id} entry={entry} onOpen={() => source.open(id)} />
          </div>
        );
      })}
    </div>
  );
}

function FeedChip({ id, entry, onOpen }: { id: string; entry: FeedEntry; onOpen: () => void }) {
  if (entry.status === 'queued') {
    return (
      <button className="nr-chip nr-chip--queued nr-chip--dim" data-item-id={id} aria-label="NARASI: sedang memeriksa" onClick={onOpen}>
        <span className="nr-dot" aria-hidden />
      </button>
    );
  }
  if (entry.status === 'error' || !entry.label) {
    return (
      <button className="nr-chip nr-chip--dim" data-item-id={id} aria-label="NARASI: belum bisa diperiksa. Klik untuk analisis lengkap." onClick={onOpen}>
        –
      </button>
    );
  }
  const label = LABELS[entry.label] ?? LABELS.unverified;
  const dim = DIM.includes(entry.label);
  const mencatut = entry.tniRelated && (entry.label === 'hoax' || entry.label === 'caution');
  const score = !dim && label.showScore && entry.score !== null ? `${entry.score}%` : null;
  return (
    <button
      className={`nr-chip${dim ? ' nr-chip--dim' : ''}`}
      data-item-id={id}
      style={{ '--nr-color': label.color } as React.CSSProperties}
      aria-label={`NARASI: ${label.text}${score ? ` ${score}` : ''}. Klik untuk analisis lengkap.`}
      onClick={onOpen}
    >
      <span className="nr-dot" aria-hidden />
      <span>{label.text}</span>
      {score && <strong>{score}</strong>}
      {mencatut && <span className="nr-tag">Mencatut TNI</span>}
    </button>
  );
}

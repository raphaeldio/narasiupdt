import { useEffect, useRef, useState } from 'react';
import { useOverlay } from '@/lib/store';
import { Badge } from './Badge';
import { Panel } from './Panel';

const GAP = 8;
const EDGE = 8;
const PANEL_WIDTH = 340;
const PANEL_MAX_HEIGHT = 460;

interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}

const same = (a: Position | null, b: Position | null) =>
  a === b || (!!a && !!b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 &&
    a.width === b.width && a.height === b.height);

/** Badge mengikuti posisi caption setiap frame; tidak mengubah layout halaman (FR09). */
export function Overlay() {
  const { key, geometry, panelOpen, togglePanel } = useOverlay();
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  useEffect(() => {
    if (!key || !geometry) return setPos(null);
    let frame = 0;
    let last: Position | null = null;
    const loop = () => {
      const g = geometry();
      const badge = badgeRef.current?.getBoundingClientRect();
      const w = badge?.width ?? 160;
      const h = badge?.height ?? 30;
      let next: Position | null = null;
      if (g && g.video.bottom > 0 && g.video.top < innerHeight) {
        const a = g.anchor;
        const useAnchor = a && a.width > 0 && a.bottom > 0 && a.top < innerHeight;
        // Di atas caption bila caption terlihat; bila tidak, di sudut kiri bawah video.
        let left = useAnchor ? a.left : g.video.left + 12;
        let top = useAnchor ? a.top - h - GAP : g.video.bottom - h - 140;
        left = Math.min(Math.max(left, EDGE), innerWidth - w - EDGE);
        top = Math.min(Math.max(top, Math.max(EDGE, g.video.top + EDGE)), innerHeight - h - EDGE);
        next = { left, top, width: w, height: h };
      }
      if (!same(last, next)) {
        last = next;
        setPos(next);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [key, geometry]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && togglePanel(false);
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [panelOpen, togglePanel]);

  if (!key) return null;

  const panelStyle = pos ? panelPlacement(pos) : undefined;
  return (
    <div className="nr-layer">
      <div className="nr-anchor" style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
        <Badge ref={badgeRef} />
      </div>
      {panelOpen && panelStyle && <Panel style={panelStyle} />}
    </div>
  );
}

function panelPlacement(badge: Position): React.CSSProperties {
  const width = Math.min(PANEL_WIDTH, innerWidth - 2 * EDGE);
  const left = Math.min(Math.max(badge.left, EDGE), innerWidth - width - EDGE);
  const spaceAbove = badge.top - GAP - EDGE;
  const spaceBelow = innerHeight - (badge.top + badge.height) - GAP - EDGE;
  if (spaceAbove >= Math.min(PANEL_MAX_HEIGHT, 320) || spaceAbove > spaceBelow) {
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, spaceAbove);
    return { left, width, maxHeight, bottom: innerHeight - badge.top + GAP };
  }
  return { left, width, maxHeight: Math.min(PANEL_MAX_HEIGHT, spaceBelow), top: badge.top + badge.height + GAP };
}

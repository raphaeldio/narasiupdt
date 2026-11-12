import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT } from '../theme';

export type Card = { src: string; label?: string; color?: string };

// Cincin 3D berisi kartu Shorts yang berputar tanpa henti. Sudut murni fungsi frame, satu putaran = `period`
// frame, jadi loop-nya mulus di titik mana pun video dipotong atau diulang.
export const Ring: React.FC<{ cards: Card[]; period?: number; radius?: number; cardW?: number; tilt?: number; showLabels?: boolean; offset?: number }> = ({
  cards, period = 240, radius = 760, cardW = 300, tilt = -10, showLabels = false, offset = 0,
}) => {
  const frame = useCurrentFrame();
  const n = cards.length;
  const base = ((frame + offset) / period) * 360;
  const cardH = cardW * (16 / 9);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1800, perspectiveOrigin: '50% 40%' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d', transform: `rotateX(${tilt}deg) rotateY(${-base}deg)` }}>
        {cards.map((c, i) => {
          const a = (i / n) * 360;
          // Kartu di belakang lebih redup supaya kedalaman terasa.
          const facing = Math.cos(((a - base) * Math.PI) / 180);
          return (
            <div key={i} style={{
              position: 'absolute', width: cardW, height: cardH, left: -cardW / 2, top: -cardH / 2,
              transform: `rotateY(${a}deg) translateZ(${radius}px)`, borderRadius: 26, overflow: 'hidden',
              border: `2px solid ${c.color ?? C.border}`, boxShadow: `0 0 40px ${(c.color ?? '#000')}55`,
              filter: `brightness(${0.35 + 0.65 * Math.max(0, facing)})`, backfaceVisibility: 'hidden',
            }}>
              <Img src={staticFile(c.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {showLabels && c.label && (
                <div style={{
                  position: 'absolute', left: 16, bottom: 22, padding: '8px 16px', borderRadius: 999, background: '#0e1015ee',
                  border: `2px solid ${c.color}`, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 22, display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, background: c.color }} />{c.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

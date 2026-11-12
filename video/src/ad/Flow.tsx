import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { C, MONO } from '../theme';
import { CYAN, ORANGE } from './parts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Kurva-kurva SVG dari ponsel (kiri) ke dashboard (kanan): garis tergambar, lalu paket data berjalan di atasnya.
// Paket bergerak periodik (fungsi frame % period) sehingga alirannya tidak pernah berhenti.
export const DataFlow: React.FC<{ from: [number, number]; to: [number, number]; at?: number; lanes?: number; labels?: string[]; hot?: number }> = ({
  from, to, at = 0, lanes = 5, labels = [], hot = -1,
}) => {
  const frame = useCurrentFrame() - at;
  const draw = interpolate(frame, [0, 12], [1, 0], clamp);
  const paths = Array.from({ length: lanes }, (_, i) => {
    const spread = (i - (lanes - 1) / 2) * 70;
    const [x0, y0] = [from[0], from[1] + spread * 0.4];
    const [x1, y1] = [to[0], to[1] + spread];
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0 - spread * 1.4} ${mx},${y1 + spread * 0.6} ${x1},${y1}`;
  });
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="flowg" x1="0" x2="1">
          <stop offset="0" stopColor={CYAN} stopOpacity={0.15} />
          <stop offset="1" stopColor={CYAN} stopOpacity={0.7} />
        </linearGradient>
        <filter id="flowglow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="url(#flowg)" strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
          {[0, 1, 2].map((k) => {
            const period = 26 + i * 3;
            const p = (((frame - 6 + k * (period / 3) + i * 5) % period) + period) % period / period;
            if (frame < 6) return null;
            const color = i === hot && k === 0 ? ORANGE : CYAN;
            return (
              <g key={k}>
                <path d={d} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" pathLength={1}
                  strokeDasharray="0.04 0.96" strokeDashoffset={-p} filter="url(#flowglow)" />
                <path d={d} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" pathLength={1}
                  strokeDasharray="0.02 0.98" strokeDashoffset={-p - 0.01} />
              </g>
            );
          })}
        </g>
      ))}
      {labels.map((t, i) => {
        const o = interpolate(frame, [8 + i * 4, 12 + i * 4], [0, 1], clamp);
        return (
          <text key={t} x={(from[0] + to[0]) / 2} y={from[1] - 150 + i * 46} textAnchor="middle" fill={i === hot ? ORANGE : C.muted}
            fontFamily={MONO} fontSize={26} fontWeight={700} opacity={o}>{t}</text>
        );
      })}
    </svg>
  );
};

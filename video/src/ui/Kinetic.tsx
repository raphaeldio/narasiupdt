import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';

type Props = {
  text: string;
  at?: number; // frame mulai (relatif ke Sequence)
  stagger?: number; // jeda antar kata
  size?: number;
  weight?: number;
  color?: string;
  highlight?: Record<string, string>; // kata -> warna
  align?: 'center' | 'left';
  out?: number; // frame mulai keluar
  style?: React.CSSProperties;
};

// Kata muncul satu-satu dengan pop spring; keluarnya cepat ke atas.
export const Kinetic: React.FC<Props> = ({
  text,
  at = 0,
  stagger = 3,
  size = 96,
  weight = 900,
  color = C.text,
  highlight = {},
  align = 'center',
  out,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const exit = out === undefined ? 0 : interpolate(frame, [out, out + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (frame < at) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: `0 ${size * 0.26}px`,
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        color,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 40}px)`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - at - i * stagger, fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
        const clean = w.replace(/[.,!?…]/g, '');
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - s) * size * 0.6}px) scale(${0.6 + s * 0.4})`,
              opacity: Math.min(1, s * 1.4),
              color: highlight[clean] ?? undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Label kecil bergaya chip (mis. "DEMO LANGSUNG · VIDEO ASLI").
export const Chip: React.FC<{ children: React.ReactNode; color?: string; at?: number; style?: React.CSSProperties }> = ({
  children,
  color = C.hoax,
  at = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 16 } });
  if (frame < at) return null;
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.35;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 999,
        border: `2px solid ${color}`,
        background: 'rgba(10,11,15,0.85)',
        color: C.text,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: '0.12em',
        transform: `scale(${s})`,
        ...style,
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 7, background: color, opacity: blink }} />
      {children}
    </div>
  );
};

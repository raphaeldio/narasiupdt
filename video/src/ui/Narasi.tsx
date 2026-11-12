import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';

// Tiruan badge ekstensi (extension/components/Badge.tsx + overlay.css), diperbesar untuk layar video.
export const LabelBadge: React.FC<{
  state: 'loading' | 'hoax' | 'caution' | 'supported';
  score?: number;
  mencatut?: boolean;
  loadingText?: string;
  scale?: number;
}> = ({ state, score, mencatut, loadingText = 'Membaca teks…', scale = 1 }) => {
  const frame = useCurrentFrame();
  const color = state === 'loading' ? C.unverified : C[state];
  const text = { loading: loadingText, hoax: 'Indikasi Hoaks', caution: 'Perlu Diwaspadai', supported: 'Didukung Sumber' }[state];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14 * scale,
        height: 60 * scale,
        padding: `0 ${24 * scale}px 0 ${20 * scale}px`,
        borderRadius: 30 * scale,
        border: `${2 * scale}px solid ${color}aa`,
        background: 'rgba(14,16,21,0.9)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 ${30 * scale}px ${state === 'loading' ? 'transparent' : color + '55'}`,
        color: '#f2f3f5',
        fontFamily: FONT,
        fontWeight: state === 'loading' ? 500 : 700,
        fontSize: 26 * scale,
        whiteSpace: 'nowrap',
      }}
    >
      {state === 'loading' ? (
        <span
          style={{
            width: 20 * scale,
            height: 20 * scale,
            borderRadius: '50%',
            border: `${3 * scale}px solid #ffffff33`,
            borderTopColor: '#fff',
            transform: `rotate(${frame * 24}deg)`,
          }}
        />
      ) : (
        <span style={{ width: 16 * scale, height: 16 * scale, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}` }} />
      )}
      {score !== undefined && state !== 'loading' && <strong style={{ fontWeight: 900 }}>{score}%</strong>}
      <span>{text}</span>
      {mencatut && (
        <span
          style={{
            fontSize: 20 * scale,
            fontWeight: 800,
            padding: `${4 * scale}px ${12 * scale}px`,
            borderRadius: 8 * scale,
            background: C.gold,
            color: C.goldText,
          }}
        >
          Mencatut TNI
        </span>
      )}
    </div>
  );
};

export const Logo: React.FC<{ at?: number; size?: number; glow?: boolean }> = ({ at = 0, size = 180, glow = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 260, mass: 0.8 } });
  const pulse = glow ? 0.5 + 0.5 * Math.sin((frame - at) / 6) : 0;
  if (frame < at) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.22, transform: `scale(${2 - s})`, opacity: Math.min(1, s * 2) }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.24,
          background: C.panel,
          border: '3px solid #38C6F4',
          boxShadow: `0 0 ${40 + pulse * 40}px #38C6F488`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img src={staticFile('icon.png')} style={{ width: size, height: size }} />
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size * 0.9, letterSpacing: '0.04em', color: C.text }}>NARASI</div>
    </div>
  );
};

// Garis penunjuk + label yang menempel ke satu titik di layar.
export const Callout: React.FC<{
  x: number;
  y: number;
  label: string;
  at: number;
  side?: 'left' | 'right';
  color?: string;
  len?: number;
}> = ({ x, y, label, at, side = 'right', color = C.accent, len = 160 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = spring({ frame: frame - at, fps, config: { damping: 18 } });
  const dir = side === 'right' ? 1 : -1;
  const lx = len * p * dir;
  return (
    <>
      <div style={{ position: 'absolute', left: x - 10, top: y - 10, width: 20, height: 20, borderRadius: 10, background: color, boxShadow: `0 0 20px ${color}` }} />
      <div
        style={{
          position: 'absolute',
          left: side === 'right' ? x : x + lx,
          top: y - 1.5,
          width: Math.abs(lx),
          height: 3,
          background: color,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: y - 30,
          left: side === 'right' ? x + lx + 16 : undefined,
          right: side === 'left' ? 1920 - (x + lx - 16) : undefined,
          padding: '10px 20px',
          borderRadius: 12,
          background: color,
          color: '#0b0d12',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 30,
          whiteSpace: 'nowrap',
          opacity: interpolate(p, [0.6, 1], [0, 1], { extrapolateLeft: 'clamp' }),
        }}
      >
        {label}
      </div>
    </>
  );
};

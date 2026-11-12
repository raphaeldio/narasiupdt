import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';

// Latar gelap dengan grid tipis dan vignette, dipakai di semua scene.
export const Bg: React.FC<{ tint?: string }> = ({ tint = C.accent }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.border}55 1px, transparent 1px), linear-gradient(90deg, ${C.border}55 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          backgroundPosition: `0 ${(frame * 0.8) % 80}px`,
          opacity: 0.5,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${tint}22 0%, transparent 55%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, #000 100%)' }} />
    </AbsoluteFill>
  );
};

// Glitch RGB-split singkat mulai `at` selama `dur` frame.
export const Glitch: React.FC<{ at: number; dur?: number; children: React.ReactNode }> = ({ at, dur = 8, children }) => {
  const frame = useCurrentFrame();
  const on = frame >= at && frame < at + dur;
  if (!on) return <>{children}</>;
  const k = frame - at;
  const dx = (random(`gx${k}`) - 0.5) * 40;
  const dy = (random(`gy${k}`) - 0.5) * 14;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)`, mixBlendMode: 'screen', filter: 'url(#nr-red)', opacity: 0.8 }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${-dx}px, ${-dy}px)`, mixBlendMode: 'screen', opacity: 0.6 }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(0deg, transparent 0 ${6 + (k % 3) * 4}px, ${C.hoax}33 ${6 + (k % 3) * 4}px ${8 + (k % 3) * 4}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Kilatan putih singkat untuk menandai beat besar.
export const Flash: React.FC<{ at: number; color?: string }> = ({ at, color = '#fff' }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + 7], [0, 0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} />;
};

// Stempel miring (mis. "HOAKS") yang menghantam layar.
export const Stamp: React.FC<{ text: string; at: number; color?: string; size?: number; rotate?: number }> = ({
  text,
  at,
  color = C.hoax,
  size = 220,
  rotate = -8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 300, mass: 0.7 } });
  const shake = frame - at < 6 ? (random(`st${frame}`) - 0.5) * 18 : 0;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '0.04em',
        color,
        padding: '0 40px',
        border: `14px solid ${color}`,
        borderRadius: 24,
        transform: `rotate(${rotate}deg) scale(${2.4 - s * 1.4}) translateX(${shake}px)`,
        opacity: Math.min(1, s * 2),
        textShadow: `0 0 40px ${color}88`,
        boxShadow: `0 0 60px ${color}55, inset 0 0 40px ${color}33`,
        background: 'rgba(7,8,11,0.6)',
      }}
    >
      {text}
    </div>
  );
};

// Penghitung angka yang naik cepat (views, KPI).
export const Counter: React.FC<{ from: number; to: number; at: number; dur: number; suffix?: string; style?: React.CSSProperties }> = ({
  from,
  to,
  at,
  dur,
  suffix = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - p, 3);
  const v = Math.round(from + (to - from) * eased);
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{v.toLocaleString('id-ID')}{suffix}</span>;
};

// Whip pan: blur + geser horizontal di sekitar batas scene.
export const useWhip = (start: number, end: number) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [start, start + 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outP = interpolate(frame, [end - 6, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = inP * 600 - outP * 600;
  const blur = (inP + outP) * 30;
  return { transform: `translateX(${x}px)`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined } as React.CSSProperties;
};

// Filter SVG global (kanal merah untuk glitch). Dipasang sekali di komposisi utama.
export const SvgDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: 'absolute' }}>
    <filter id="nr-red">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
    </filter>
  </svg>
);

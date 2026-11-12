import React from 'react';
import { Lottie, type LottieAnimationData } from '@remotion/lottie';
import {
  AbsoluteFill, Img, interpolate, OffthreadVideo, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig,
  cancelRender, continueRender, delayRender,
} from 'remotion';
import { C, FONT, MONO } from '../theme';

export const CYAN = '#38c6f4';
export const ORANGE = '#ff9a3c';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export type Box = { x: number; y: number; w: number; h: number };

// Potongan rekaman asli: area `crop` dari video berukuran `vp`, diskalakan ke lebar `width`.
// `from` = detik di rekaman saat Sequence ini mulai; `rate` untuk speed ramp.
export const Footage: React.FC<{
  file: string; vp: { w: number; h: number }; crop: Box; width: number; from: number; rate?: number; style?: React.CSSProperties;
}> = ({ file, vp, crop, width, from, rate = 1, style }) => {
  const { fps } = useVideoConfig();
  const k = width / crop.w;
  return (
    <div style={{ width, height: crop.h * k, overflow: 'hidden', position: 'relative', ...style }}>
      <OffthreadVideo
        src={staticFile(file)}
        startFrom={Math.max(0, Math.round(from * fps))}
        playbackRate={rate}
        muted
        style={{ position: 'absolute', left: -crop.x * k, top: -crop.y * k, width: vp.w * k, height: vp.h * k, maxWidth: 'none' }}
      />
    </div>
  );
};

// Bingkai ponsel SVG di atas konten (layar berlubang lewat mask).
export const phoneGeom = (width: number, aspect = 452 / 804) => {
  const pad = width * 0.045;
  const innerW = width - pad * 2;
  const innerH = innerW / aspect;
  return { pad, innerW, innerH, h: innerH + pad * 2 };
};

export const Phone: React.FC<{ width: number; children: React.ReactNode; glow?: string; aspect?: number }> = ({ width, children, glow = CYAN, aspect }) => {
  const { pad, h } = phoneGeom(width, aspect);
  const r = width * 0.13;
  return (
    <div style={{ position: 'relative', width, height: h, filter: `drop-shadow(0 30px 60px #000c) drop-shadow(0 0 40px ${glow}33)` }}>
      <div style={{ position: 'absolute', left: pad, top: pad, right: pad, bottom: pad, borderRadius: r - pad, overflow: 'hidden', background: '#000' }}>
        {children}
      </div>
      <svg width={width} height={h} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="ph-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5d6575" />
            <stop offset="0.5" stopColor="#1b1f27" />
            <stop offset="1" stopColor="#4a5160" />
          </linearGradient>
          <mask id="ph-hole">
            <rect width={width} height={h} fill="#fff" />
            <rect x={pad} y={pad} width={width - pad * 2} height={h - pad * 2} rx={r - pad} fill="#000" />
          </mask>
        </defs>
        <rect width={width} height={h} rx={r} fill="url(#ph-edge)" mask="url(#ph-hole)" />
        <rect x={1.5} y={1.5} width={width - 3} height={h - 3} rx={r} fill="none" stroke="#8a93a5" strokeWidth={3} />
        <rect x={width / 2 - width * 0.13} y={pad + 14} width={width * 0.26} height={width * 0.07} rx={width * 0.035} fill="#05060a" />
      </svg>
    </div>
  );
};

// Jendela browser (chrome sederhana) untuk rekaman dashboard.
export const BrowserWin: React.FC<{ width: number; url: string; children: React.ReactNode }> = ({ width, url, children }) => (
  <div style={{ width, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#0c0e13', boxShadow: `0 40px 90px #000d, 0 0 60px ${CYAN}22` }}>
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: '#151821', borderBottom: `1px solid ${C.border}` }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      <div style={{ marginLeft: 16, flex: 1, height: 28, borderRadius: 8, background: '#0c0e13', color: C.muted, fontFamily: MONO, fontSize: 15, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
        {url}
      </div>
    </div>
    {children}
  </div>
);

// Lottie dari public/lottie. Dimuat sekali per komponen; frame mengikuti Sequence pembungkus.
export const LottieFx: React.FC<{ name: string; size: number; loop?: boolean; rate?: number; style?: React.CSSProperties }> = ({ name, size, loop, rate = 1, style }) => {
  const [data, setData] = React.useState<LottieAnimationData | null>(null);
  const [handle] = React.useState(() => delayRender(`lottie ${name}`));
  React.useEffect(() => {
    fetch(staticFile(`lottie/${name}.json`))
      .then((r) => r.json())
      .then((j) => { setData(j); continueRender(handle); })
      .catch((e) => cancelRender(e));
  }, [handle, name]);
  if (!data) return null;
  return <Lottie animationData={data} loop={loop} playbackRate={rate} style={{ width: size, height: size, ...style }} />;
};

// Lottie yang diletakkan di titik (x, y) mulai frame `at`.
export const LottieAt: React.FC<{ name: string; at: number; x: number; y: number; size: number; dur?: number; loop?: boolean }> = ({ name, at, x, y, size, dur = 30, loop }) => (
  <Sequence from={at} durationInFrames={dur} layout="none">
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, pointerEvents: 'none' }}>
      <LottieFx name={name} size={size} loop={loop} />
    </div>
  </Sequence>
);

// Kata tunggal yang menghantam layar (kinetic typography): skala besar -> pas, motion blur, sedikit guncang.
export const Slam: React.FC<{ text: string; at: number; until?: number; size?: number; color?: string; stroke?: boolean; y?: number; rotate?: number; style?: React.CSSProperties }> = ({
  text, at, until, size = 220, color = C.text, stroke, y = 0, rotate = 0, style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 380, mass: 0.6 } });
  const blur = interpolate(frame - at, [0, 4], [14, 0], clamp);
  const shake = frame - at < 5 ? (random(`sl${text}${frame}`) - 0.5) * 16 : 0;
  const out = until === undefined ? 0 : interpolate(frame, [until - 3, until], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: FONT, fontWeight: 900, fontSize: size, letterSpacing: '-0.05em', lineHeight: 0.9, textAlign: 'center',
          color: stroke ? 'transparent' : color, WebkitTextStroke: stroke ? `4px ${color}` : undefined,
          transform: `translate(${shake}px, ${y}px) rotate(${rotate}deg) scale(${(2.2 - s * 1.2) * (1 + out * 0.4)})`,
          opacity: Math.min(1, s * 2) * (1 - out), filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
          textShadow: stroke ? undefined : `0 0 50px ${color}55`, whiteSpace: 'pre', ...style,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Teks yang diketik per huruf dengan blok kursor (gaya terminal).
export const Typer: React.FC<{ text: string; at: number; cps?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({ text, at, cps = 40, size = 40, color = C.text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const n = Math.min(text.length, Math.floor(((frame - at) / fps) * cps));
  return (
    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, color, whiteSpace: 'pre', ...style }}>
      {text.slice(0, n)}
      <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1, color: CYAN }}>▍</span>
    </div>
  );
};

// Baris kata yang muncul per kata dengan geser dari bawah lewat mask (kinetic klasik).
export const Words: React.FC<{ text: string; at: number; size?: number; color?: string; stagger?: number; accent?: Record<string, string>; style?: React.CSSProperties; until?: number }> = ({
  text, at, size = 90, color = C.text, stagger = 3, accent = {}, style, until,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const out = until === undefined ? 0 : interpolate(frame, [until - 4, until], [0, 1], clamp);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.25}px`, fontFamily: FONT, fontWeight: 900, fontSize: size, letterSpacing: '-0.04em', lineHeight: 1, ...style }}>
      {text.split(' ').map((w, i) => {
        const s = spring({ frame: frame - at - i * stagger, fps, config: { damping: 15, stiffness: 300 } });
        const key = w.replace(/[.,!?…]/g, '');
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.08 }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 110 - out * 110}%)`, color: accent[key] ?? color }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

// Latar: grid perspektif bergerak (loop mulus tiap 40 frame) + vignette.
export const Grid3D: React.FC<{ tint?: string; speed?: number }> = ({ tint = CYAN, speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 700 }}>
        <div
          style={{
            position: 'absolute', left: '-50%', width: '200%', top: '55%', height: '120%',
            transform: 'rotateX(72deg)', transformOrigin: '50% 0',
            backgroundImage: `linear-gradient(${tint}55 2px, transparent 2px), linear-gradient(90deg, ${tint}40 2px, transparent 2px)`,
            backgroundSize: '100px 100px', backgroundPosition: `0 ${((frame * 2.5 * speed) % 100)}px`,
            maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 60%, transparent)',
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, ${tint}26 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 45%, #000 100%)' }} />
    </AbsoluteFill>
  );
};

// Butiran film + scanline tipis supaya rekaman dan grafis menyatu.
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.12 }}>
      <svg width="100%" height="100%">
        <filter id={`gr${frame % 4}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 4} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#gr${frame % 4})`} />
      </svg>
    </AbsoluteFill>
  );
};

// Flash putih/berwarna untuk cut.
export const Flash: React.FC<{ at: number; color?: string; peak?: number }> = ({ at, color = '#fff', peak = 0.8 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + 6], [0, peak, 0], clamp);
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} /> : null;
};

// Chip kecil berwarna.
export const Tag: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = CYAN, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 999, border: `2px solid ${color}`, background: '#0a0b0fdd', color: C.text, fontFamily: FONT, fontWeight: 800, fontSize: 24, letterSpacing: '0.12em', ...style }}>
    {children}
  </div>
);

export const Icon: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile('narasi-ikon.png')} style={{ width: size, height: size, ...style }} />
);

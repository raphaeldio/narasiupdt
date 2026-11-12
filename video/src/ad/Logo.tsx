import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';
import { CYAN, Flash, Icon, LottieAt, ORANGE, Words } from './parts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Titik-titik heksagon (pointy-top) dengan jari-jari r di sekitar (0, 0).
const hexPts = (r: number) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});
const hexPath = (r: number, cx = 0, cy = 0) => `M${hexPts(r).map(([x, y]) => `${(x + cx).toFixed(1)},${(y + cy).toFixed(1)}`).join('L')}Z`;
const HEX_LEN = 6 * 1; // keliling heksagon = 6r

// Logo reveal: heksagon tergambar (SVG), ikon N masuk dalam perisai, huruf NARASI terkunci satu per satu,
// lalu tagline. Heksagon berputar 3D pelan tanpa henti.
export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const R = 190;
  const draw = interpolate(frame, [0, 14], [1, 0], clamp);
  const icon = spring({ frame: frame - 8, fps, config: { damping: 11, stiffness: 200 } });
  const spin = Math.sin(frame / 22) * 14;
  const word = 'NARASI';
  const shift = spring({ frame: frame - 26, fps, config: { damping: 16, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Garis sinyal di belakang logo (SVG) */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const p = interpolate(frame, [4 + i * 0.6, 22 + i * 0.6], [0, 1], clamp);
          const r0 = 230 + p * 120;
          const r1 = 230 + p * 520;
          return (
            <line key={i} x1={960 + Math.cos(a) * r0} y1={460 + Math.sin(a) * r0} x2={960 + Math.cos(a) * r1} y2={460 + Math.sin(a) * r1}
              stroke={i % 5 === 0 ? ORANGE : CYAN} strokeWidth={3} strokeLinecap="round" opacity={(1 - p) * 0.9} />
          );
        })}
      </svg>

      <div style={{ position: 'absolute', top: 460 - R, left: 960 - R - shift * 330, width: R * 2, height: R * 2, perspective: 900 }}>
        <div style={{ width: '100%', height: '100%', transform: `rotateY(${spin}deg) rotateX(${spin * 0.3}deg)`, transformStyle: 'preserve-3d' }}>
          <div style={{
            position: 'absolute', inset: 0, clipPath: `path('${hexPath(R - 12, R, R)}')`,
            transform: `scale(${icon})`, opacity: Math.min(1, icon * 1.5),
          }}>
            <Icon size={R * 2} />
          </div>
          <svg width={R * 2} height={R * 2} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', transform: 'translateZ(30px)' }}>
            <defs>
              <linearGradient id="hexg" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor={CYAN} />
                <stop offset="0.75" stopColor={CYAN} />
                <stop offset="1" stopColor={ORANGE} />
              </linearGradient>
            </defs>
            <path d={hexPath(R - 6)} fill="none" stroke="url(#hexg)" strokeWidth={10} strokeLinejoin="round"
              pathLength={HEX_LEN} strokeDasharray={HEX_LEN} strokeDashoffset={draw * HEX_LEN}
              style={{ filter: `drop-shadow(0 0 18px ${CYAN})` }} />
            <path d={hexPath(R + 22)} fill="none" stroke={CYAN} strokeOpacity={0.35} strokeWidth={2}
              pathLength={HEX_LEN} strokeDasharray={`${HEX_LEN * 0.12} ${HEX_LEN * 0.05}`} strokeDashoffset={-frame * 0.08} />
          </svg>
        </div>
      </div>
      <LottieAt name="burst" at={10} x={960} y={460} size={900} dur={26} />

      {/* Huruf NARASI terkunci satu-satu */}
      <div style={{ position: 'absolute', top: 460 - 110, left: 960 - 330 + shift * 230, display: 'flex', opacity: shift > 0.02 ? 1 : 0 }}>
        {word.split('').map((ch, i) => {
          const s = spring({ frame: frame - 28 - i * 2, fps, config: { damping: 13, stiffness: 260 } });
          return (
            <span key={i} style={{
              fontFamily: FONT, fontWeight: 900, fontSize: 210, letterSpacing: '-0.02em', lineHeight: 1,
              color: i === word.length - 1 ? ORANGE : C.text, display: 'inline-block',
              transform: `translateY(${(1 - s) * 80}px) rotateX(${(1 - s) * 90}deg)`, opacity: Math.min(1, s * 2),
              textShadow: `0 0 40px ${CYAN}55`,
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ position: 'absolute', top: 470 + 100, left: 960 - 330 + shift * 230 + 8 }}>
        <Words text="Jaga ruang kognitif." at={40} size={48} color={C.muted} stagger={2} />
      </div>

      <div style={{ position: 'absolute', bottom: 150, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Words text="Scroll tetap jalan. Hoaks nggak lolos." at={46} size={64} stagger={2} accent={{ Hoaks: '#FF5A5F', lolos: '#FF5A5F' }} />
      </div>
      <Flash at={8} color={CYAN} peak={0.5} />
    </AbsoluteFill>
  );
};

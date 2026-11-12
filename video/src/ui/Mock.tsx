import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { DEMO } from '../rec';
import { C, FONT } from '../theme';
import { RecClip } from './Rec';
import { LabelBadge } from './Narasi';

// Di YouTube desktop badge & panel NARASI menempel di kiri player, jadi area tampil = gabungan player + badge + panel.
function demoCrop() {
  const boxes = [DEMO!.player, DEMO!.badge, DEMO!.panel].filter((x) => x !== null);
  const pad = 24;
  const x0 = Math.min(...boxes.map((x) => x.x)) - pad;
  const y0 = Math.min(...boxes.map((x) => x.y)) - pad;
  const x1 = Math.max(...boxes.map((x) => x.x + x.w)) + pad;
  const y1 = Math.max(...boxes.map((x) => x.y + x.h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Isi layar: rekaman asli bila sudah ada, kalau belum tampilan pengganti supaya Studio tetap bisa dipakai.
export const PhoneScreen: React.FC<{
  width: number;
  height: number;
  from: number;
  to: number;
  zoomTo?: 'badge' | 'panel';
  zoomAt?: number;
  zoom?: number;
  fallback: React.ReactNode;
}> = ({ width, height, from, to, zoomTo, zoomAt = 0, zoom = 1.8, fallback }) => {
  if (!DEMO) return <>{fallback}</>;
  // Badge dicatat saat masih "Belum Terverifikasi"; label hoaks + tag "Mencatut TNI" lebih lebar, jadi area fokus dilebarkan.
  const target =
    zoomTo === 'badge' && DEMO.badge ? { ...DEMO.badge, w: Math.max(DEMO.badge.w, 330) } : zoomTo === 'panel' ? DEMO.panel : null;
  return (
    <RecClip
      src={DEMO.file}
      from={from}
      to={to}
      viewport={DEMO.viewport}
      crop={demoCrop()}
      width={width}
      height={height}
      focus={target ? [{ at: zoomAt, box: target, zoom }] : []}
    />
  );
};

// Pengganti video Shorts: latar gradasi + teks layar + caption.
export const FakeShort: React.FC<{ hue?: number; caption?: string; onscreen?: string; children?: React.ReactNode }> = ({
  hue = 210,
  caption = '18000 pasukan TNI dikerahkan ke Aceh',
  onscreen = '18.000 PERSONEL TNI DIKERAHKAN KE ACEH',
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, hsl(${hue} 30% 22%), hsl(${hue + 40} 25% 8%))`, fontFamily: FONT }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(frame / 20) * 20}% 35%, #ffffff18, transparent 50%)` }} />
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: 30,
          right: 30,
          textAlign: 'center',
          color: '#fff',
          fontWeight: 900,
          fontSize: 44,
          lineHeight: 1.1,
          textShadow: '0 4px 0 #000, 0 0 20px #000',
          background: '#e11d2acc',
          padding: '12px 10px',
          transform: 'rotate(-2deg)',
        }}
      >
        {onscreen}
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 28, right: 90, color: '#fff', fontSize: 26, fontWeight: 600 }}>{caption}</div>
      {children}
    </AbsoluteFill>
  );
};

// Pengganti demo: badge berubah dari loading ke label hoaks.
export const FakeDemo: React.FC<{ labelAt: number }> = ({ labelAt }) => {
  const frame = useCurrentFrame();
  const state = frame < labelAt ? 'loading' : 'hoax';
  return (
    <FakeShort>
      <div style={{ position: 'absolute', bottom: 130, left: 24, transform: `scale(${interpolate(frame, [labelAt, labelAt + 6], [1.15, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`, transformOrigin: 'left center' }}>
        <LabelBadge state={state} score={91} mencatut={state === 'hoax'} scale={0.85} />
      </div>
    </FakeShort>
  );
};

// Pengganti panel bukti.
export const FakePanel: React.FC = () => (
  <FakeShort>
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        top: 200,
        borderRadius: 24,
        background: C.panel,
        border: `2px solid ${C.border}`,
        padding: 28,
        color: C.text,
        fontSize: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <LabelBadge state="hoax" score={91} mencatut scale={0.75} />
      <div style={{ color: C.muted, fontWeight: 800, letterSpacing: '0.1em', fontSize: 18 }}>KLAIM TERDETEKSI</div>
      <div>"Sebanyak 18.000 pasukan TNI dikerahkan ke Aceh" <span style={{ color: C.accent }}>· Teks layar</span></div>
      <div style={{ color: C.muted, fontWeight: 800, letterSpacing: '0.1em', fontSize: 18 }}>SUMBER</div>
      <div>[1] Komdigi — Hoaks · <b style={{ color: C.supported }}>91% cocok</b></div>
      <div style={{ color: C.muted, fontWeight: 800, letterSpacing: '0.1em', fontSize: 18 }}>KESIMPULAN</div>
      <div>Klaim ini sudah dibantah resmi [1].</div>
      <div style={{ marginTop: 'auto', background: C.gold, color: C.goldText, fontWeight: 800, borderRadius: 14, padding: '14px 0', textAlign: 'center' }}>
        Laporkan ke TNI AD
      </div>
    </div>
  </FakeShort>
);

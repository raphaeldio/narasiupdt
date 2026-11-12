import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { b, C, FONT } from '../theme';
import { Bg } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';

const Card: React.FC<{ at: number; icon: React.ReactNode; title: string; sub: string; color: string }> = ({ at, icon, title, sub, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return <div style={{ width: 500 }} />;
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 240 } });
  return (
    <div
      style={{
        width: 500,
        height: 520,
        borderRadius: 32,
        background: C.panel,
        border: `3px solid ${color}`,
        boxShadow: `0 0 70px ${color}44`,
        padding: 44,
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
        transform: `translateY(${(1 - s) * 120}px) rotate(${(1 - s) * -6}deg)`,
        opacity: Math.min(1, s * 1.5),
        fontFamily: FONT,
      }}
    >
      <div style={{ width: 120, height: 120, borderRadius: 30, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 46, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 500, color: C.muted, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
};

const stroke = (color: string) => ({ fill: 'none', stroke: color, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

const IconDeploy = ({ c }: { c: string }) => (
  <svg width={72} height={72} viewBox="0 0 64 64">
    <rect x={6} y={10} width={52} height={36} rx={5} {...stroke(c)} />
    <path d="M22 56h20M32 46v10M24 28l6 6 12-12" {...stroke(c)} />
  </svg>
);
const IconServer = ({ c }: { c: string }) => (
  <svg width={72} height={72} viewBox="0 0 64 64">
    <rect x={10} y={8} width={44} height={18} rx={4} {...stroke(c)} />
    <rect x={10} y={34} width={44} height={18} rx={4} {...stroke(c)} />
    <path d="M18 17h2M18 43h2M40 17h6M40 43h6" {...stroke(c)} />
  </svg>
);
const IconLock = ({ c }: { c: string }) => (
  <svg width={72} height={72} viewBox="0 0 64 64">
    <rect x={12} y={28} width={40} height={28} rx={5} {...stroke(c)} />
    <path d="M20 28v-8a12 12 0 0 1 24 0v8M32 40v6" {...stroke(c)} />
  </svg>
);

export const S7Siap: React.FC = () => (
  <AbsoluteFill>
    <Bg tint={C.supported} />
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 120, gap: 80 }}>
      <Kinetic text="Siap dipakai di satuan." at={0} size={84} highlight={{ satuan: C.supported }} />
      <div style={{ display: 'flex', gap: 50 }}>
        <Card at={b(1)} color={C.accent} icon={<IconDeploy c={C.accent} />} title="Pasang serentak" sub="Force-install lewat Chrome Enterprise ke semua perangkat satuan." />
        <Card at={b(5)} color={C.caution} icon={<IconServer c={C.caution} />} title="Bisa on-premise" sub="Backend jalan di server sendiri, data nggak keluar." />
        <Card at={b(9)} color={C.supported} icon={<IconLock c={C.supported} />} title="Privasi aman" sub="Nggak nyimpen video. Nggak baca akun, cookie, atau DM." />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

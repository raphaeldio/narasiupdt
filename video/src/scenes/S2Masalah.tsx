import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { b, C, FONT } from '../theme';
import { Bg, Flash, Stamp } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';

const Column: React.FC<{ title: string; at: number; danger: boolean; dangerAt: number; children: React.ReactNode }> = ({
  title,
  at,
  danger,
  dangerAt,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 15 } });
  const lit = danger && frame >= dangerAt;
  const color = danger ? (lit ? C.hoax : C.border) : C.supported;
  return (
    <div
      style={{
        width: 440,
        height: 360,
        borderRadius: 28,
        background: C.panel,
        border: `3px solid ${color}`,
        boxShadow: lit ? `0 0 60px ${C.hoax}66` : 'none',
        transform: `translateY(${(1 - s) * 80}px)`,
        opacity: s,
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 36 }}>{title}</span>
        <span style={{ fontSize: 26, fontWeight: 800, color: danger ? (lit ? C.hoax : C.muted) : C.supported }}>
          {danger ? (lit ? '⚠ HOAKS' : '…') : '✓ aman'}
        </span>
      </div>
      {children}
    </div>
  );
};

const Wave: React.FC<{ lit: boolean }> = ({ lit }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 160 }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 9,
            borderRadius: 5,
            background: lit ? C.hoax : C.muted,
            height: 20 + Math.abs(Math.sin(frame / 4 + i * 0.7)) * 120 * (0.4 + ((i * 37) % 10) / 16),
          }}
        />
      ))}
    </div>
  );
};

export const S2Masalah: React.FC = () => {
  const frame = useCurrentFrame();
  const lit = b(3);
  const slam = b(8);
  const dim = interpolate(frame, [slam - 3, slam], [1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Bg tint={frame >= lit ? C.hoax : C.supported} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110 }}>
        <Kinetic text="Caption-nya aman…" at={0} size={80} out={b(3) - 4} />
        <div style={{ position: 'absolute', top: 110 }}>
          <Kinetic text="…hoaksnya nyumput di suara & layar." at={b(3)} size={80} highlight={{ suara: C.hoax, layar: C.hoax }} out={slam - 4} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50, paddingTop: 120, opacity: dim }}>
        <Column title="Caption" at={0} danger={false} dangerAt={0}>
          <div style={{ color: C.muted, fontSize: 30, lineHeight: 1.4 }}>“Latihan rutin pagi ini 💪 #tni #fyp”</div>
        </Column>
        <Column title="Teks layar" at={b(1)} danger dangerAt={lit}>
          <div style={{ background: frame >= lit ? C.hoax : '#333', color: '#fff', fontWeight: 900, fontSize: 34, padding: 14, transform: 'rotate(-2deg)' }}>
            18.000 PERSONEL TNI KE ACEH!!
          </div>
        </Column>
        <Column title="Suara" at={b(2)} danger dangerAt={lit + 4}>
          <Wave lit={frame >= lit + 4} />
        </Column>
      </AbsoluteFill>
      {/* Ikon pindah tab dicoret */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70, opacity: dim }}>
        {frame >= b(6) && (
          <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: C.muted, display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ position: 'relative', padding: '6px 18px', border: `3px solid ${C.muted}`, borderRadius: 10 }}>
              + Tab baru buat ngecek?
              <span style={{ position: 'absolute', left: -10, right: -10, top: '50%', height: 6, background: C.hoax, transform: 'rotate(-4deg)' }} />
            </span>
            <span>nggak ada yang sempat.</span>
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30 }}>
        {frame >= slam && (
          <>
            <Kinetic text="Ini serangan ke" at={slam} size={70} weight={800} />
            <Stamp text="DOMAIN KOGNITIF" at={slam + 4} size={130} rotate={0} />
          </>
        )}
      </AbsoluteFill>
      <Flash at={slam + 4} color={C.hoax} />
    </AbsoluteFill>
  );
};

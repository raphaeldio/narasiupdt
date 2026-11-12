import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { b, C, FONT } from '../theme';
import { Bg, Flash } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';
import { Logo } from '../ui/Narasi';

export const TEAM = 'Raphael Diovana Tarigan · Kartika Hackathon 2026';

const PILLARS: { text: string; color: string }[] = [
  { text: 'Tanpa pindah tab.', color: C.accent },
  { text: 'Berbasis bukti.', color: C.supported },
  { text: 'Multimodal.', color: C.caution },
];

export const S8Penutup: React.FC = () => {
  const logoAt = b(4);
  return (
    <AbsoluteFill>
      <Bg tint={C.supported} />
      {PILLARS.map((p, i) => (
        <Sequence key={p.text} from={b(i)} durationInFrames={b(1)}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Kinetic text={p.text} at={0} size={160} color={p.color} stagger={1} />
          </AbsoluteFill>
        </Sequence>
      ))}
      <Sequence from={logoAt}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 50 }}>
          <Logo at={0} size={170} />
          <Kinetic text="Jaga ruang kognitif TNI AD." at={b(1)} size={64} weight={800} highlight={{ kognitif: C.supported }} />
          <Sequence from={b(2)} layout="none">
            <div style={{ fontFamily: FONT, fontSize: 30, color: C.muted, letterSpacing: '0.06em' }}>{TEAM}</div>
          </Sequence>
        </AbsoluteFill>
        <Flash at={0} />
      </Sequence>
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { b, C } from '../theme';
import { Bg, Flash } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';
import { Logo } from '../ui/Narasi';

export const S3Reveal: React.FC = () => (
  <AbsoluteFill>
    <Bg tint={C.supported} />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 60 }}>
      <Logo at={0} size={200} />
      <Kinetic text="Tameng kognitif, langsung di layar." at={b(2)} size={64} weight={800} color={C.muted} highlight={{ kognitif: C.supported }} />
    </AbsoluteFill>
    <Flash at={0} />
  </AbsoluteFill>
);

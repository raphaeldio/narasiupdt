import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { DEMO } from '../rec';
import { b, C, FONT } from '../theme';
import { Bg, Counter, Flash, Glitch, Stamp } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';
import { FakeShort, PhoneScreen } from '../ui/Mock';
import { PhoneFrame } from '../ui/Rec';

// Laporan isu hoaks Komdigi 1 Okt 2025 sampai hari perekaman (29 Okt 2026).
const DAYS_SINCE_DEBUNK = 393;
const W = 660;
const H = 896;

// Feed pengganti: tiap beat ganti video (dipakai bila belum ada rekaman feed asli).
const FakeFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(4, Math.floor(frame / b(1)));
  const items = [
    { hue: 20, onscreen: 'RESEP VIRAL 5 MENIT', caption: '@dapur.kilat · wajib coba!' },
    { hue: 280, onscreen: 'PRANK OJOL 😂', caption: '@ngakak.id · tag temenmu' },
    { hue: 140, onscreen: 'HARGA EMAS HARI INI', caption: '@info.cuan · cek sebelum beli' },
    { hue: 330, onscreen: 'DANCE CHALLENGE', caption: '@trend.now · #fyp' },
    { hue: 120, onscreen: '18.000 PERSONEL TNI DIKERAHKAN KE ACEH', caption: '18000 pasukan TNI dikerahkan ke Aceh' },
  ];
  return <FakeShort {...items[i]} />;
};

export const S1Hook: React.FC = () => {
  const feedEnd = b(5);
  return (
    <AbsoluteFill>
      <Bg tint={C.hoax} />
      <Glitch at={b(5)} dur={8}>
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 150 }}>
          <PhoneFrame width={W} height={H}>
            <PhoneScreen
              width={W}
              height={H}
              from={DEMO ? DEMO.t.videoStart : 0}
              to={DEMO ? Math.max(DEMO.t.videoStart + 0.5, DEMO.t.badge - 0.1) : 0}
              fallback={<FakeFeed />}
            />
          </PhoneFrame>
        </AbsoluteFill>
      </Glitch>

      <AbsoluteFill style={{ left: 900, width: 930, justifyContent: 'center', gap: 50 }}>
        <Kinetic text="“18.000 pasukan TNI dikirim ke Aceh.”" at={b(1)} size={80} align="left" stagger={2} />
        <Sequence from={feedEnd} layout="none">
          <div style={{ marginLeft: 20, alignSelf: "flex-start" }}>
            <Stamp text="HOAKS" at={0} size={150} rotate={-6} />
          </div>
        </Sequence>
        <Kinetic text="Udah dibantah Komdigi. Tapi videonya masih tayang." at={b(8)} size={56} weight={800} align="left" color={C.muted} highlight={{ Komdigi: C.text, tayang: C.text }} />
        <Sequence from={b(8)} layout="none">
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 120, color: C.hoax, display: 'flex', alignItems: 'baseline', gap: 20 }}>
            <Counter from={0} to={DAYS_SINCE_DEBUNK} at={0} dur={b(3)} />
            <span style={{ fontSize: 40, color: C.muted }}>hari sejak dibantah</span>
          </div>
        </Sequence>
      </AbsoluteFill>
      <Flash at={feedEnd} color={C.hoax} />
    </AbsoluteFill>
  );
};

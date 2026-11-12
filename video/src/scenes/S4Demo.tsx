import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { DEMO } from '../rec';
import { b, C, FONT, SCENES } from '../theme';
import { Bg } from '../ui/Fx';
import { Chip, Kinetic } from '../ui/Kinetic';
import { FakeDemo, PhoneScreen } from '../ui/Mock';
import { PhoneFrame, RealTimer } from '../ui/Rec';

const W = 660;
const H = 896;

// Bagian A: dari video mulai sampai label pertama (kecepatan asli bila muat).
// Bagian B: sisa scene, zoom ke badge selama update teks layar & audio masuk.
function timing() {
  const total = SCENES.demo.dur;
  if (!DEMO) return { aFrom: 0, aTo: 4, aDur: 300, bFrom: 4, bTo: 12, labelFrame: 200, detect: 2.1, total };
  const t = DEMO.t;
  // Momen "ketahuan" = saat label jadi Indikasi Hoaks (bisa label pertama, bisa setelah teks layar/audio masuk).
  const detectAt = /hoaks/i.test(DEMO.finalText) && !/hoaks/i.test(DEMO.firstText) ? t.labelChange : t.firstLabel;
  const aFrom = t.videoStart - 0.3;
  const aTo = detectAt + 1.5;
  const aDur = Math.round(Math.min(300, Math.max(b(10), (aTo - aFrom) * 30)));
  const labelFrame = Math.round(((detectAt - aFrom) / (aTo - aFrom)) * aDur);
  return { aFrom, aTo, aDur, bFrom: aTo, bTo: Math.max(aTo + 1, t.final + 0.5), labelFrame, detect: detectAt - t.videoStart, total };
}

export const S4Demo: React.FC = () => {
  const x = timing();
  const t0 = DEMO ? DEMO.t.videoStart : 0;
  return (
    <AbsoluteFill>
      <Bg tint={C.accent} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 150 }}>
        <PhoneFrame width={W} height={H}>
          <Sequence durationInFrames={x.aDur}>
            <PhoneScreen width={W} height={H} from={x.aFrom} to={x.aTo} fallback={<FakeDemo labelAt={x.labelFrame} />} />
          </Sequence>
          <Sequence from={x.aDur} durationInFrames={x.total - x.aDur}>
            <PhoneScreen width={W} height={H} from={x.bFrom} to={x.bTo} zoomTo="badge" zoomAt={0} zoom={1.7} fallback={<FakeDemo labelAt={0} />} />
          </Sequence>
        </PhoneFrame>
      </AbsoluteFill>

      <AbsoluteFill style={{ left: 900, width: 930, justifyContent: 'center', gap: 44 }}>
        <Chip color={C.hoax}>DEMO LANGSUNG · VIDEO ASLI</Chip>
        <Kinetic text="Ini demo asli, bukan mockup." at={b(1)} size={58} align="left" stagger={2} highlight={{ asli: C.supported }} />
        <Sequence from={x.labelFrame} layout="none">
          <Kinetic text={`Detik ke-${x.detect.toFixed(1).replace('.', ',')}: ketahuan.`} at={0} size={58} align="left" highlight={{ ketahuan: C.hoax }} />
        </Sequence>
        <Sequence from={x.aDur} layout="none">
          <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 600, color: C.muted }}>
            …terus makin akurat: <span style={{ color: C.text }}>teks layar</span> + <span style={{ color: C.text }}>suara</span> ikut dicek.
          </div>
        </Sequence>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'flex-end', padding: 60 }}>
        <Sequence durationInFrames={x.aDur} layout="none">
          <RealTimer from={x.aFrom} to={x.aTo} t0={t0} />
        </Sequence>
        <Sequence from={x.aDur} durationInFrames={x.total - x.aDur} layout="none">
          <RealTimer from={x.bFrom} to={x.bTo} t0={t0} color={C.accent} />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

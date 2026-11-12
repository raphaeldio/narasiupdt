import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DEMO } from '../rec';
import { b, C, FONT, MONO, SCENES } from '../theme';
import { Bg } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';
import { FakePanel, PhoneScreen } from '../ui/Mock';
import { PhoneFrame } from '../ui/Rec';

const W = 660;
const H = 896;

const Node: React.FC<{ at: number; icon: string; title: string; tech: string; color: string }> = ({ at, icon, title, tech, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 200 } });
  const on = frame >= at;
  return (
    <div
      style={{
        width: 300,
        padding: '30px 26px',
        borderRadius: 26,
        background: C.panel,
        border: `3px solid ${on ? color : C.border}`,
        boxShadow: on ? `0 0 50px ${color}55` : 'none',
        transform: `scale(${0.85 + s * 0.15})`,
        opacity: 0.35 + s * 0.65,
        fontFamily: FONT,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 64 }}>{icon}</div>
      <div style={{ fontSize: 38, fontWeight: 800, color: C.text, marginTop: 8 }}>{title}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, color, marginTop: 8 }}>{tech}</div>
    </div>
  );
};

const Arrow: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ width: 60 * p, height: 5, background: C.accent, borderRadius: 3 }} />;
};

const Point: React.FC<{ at: number; n: number; text: string }> = ({ at, n, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 16 } });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, transform: `translateX(${(1 - s) * -60}px)`, opacity: s, fontFamily: FONT }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: C.accent, color: '#0b0d12', fontWeight: 900, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
      <div style={{ fontSize: 48, fontWeight: 800, color: C.text }}>{text}</div>
    </div>
  );
};

export const S5Inovasi: React.FC = () => {
  const split = b(7); // strip multimodal dulu, lalu panel bukti
  return (
    <AbsoluteFill>
      <Bg tint={C.accent} />
      <Sequence durationInFrames={split}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 70 }}>
          <Kinetic text="Baca caption. Baca layar. Dengerin suara." at={0} size={70} stagger={2} highlight={{ caption: C.supported, layar: C.caution, suara: C.hoax }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Node at={b(1)} icon="💬" title="Caption" tech="teks posting" color={C.supported} />
            <Arrow at={b(2)} />
            <Node at={b(3)} icon="🖼️" title="Teks layar" tech="OCR frame" color={C.caution} />
            <Arrow at={b(4)} />
            <Node at={b(5)} icon="🎧" title="Suara" tech="Whisper ASR" color={C.hoax} />
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={split} durationInFrames={SCENES.inovasi.dur - split}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 150 }}>
          <PhoneFrame width={W} height={H}>
            <PhoneScreen
              width={W}
              height={H}
              from={DEMO ? DEMO.t.panelOpen - 0.3 : 0}
              to={DEMO ? DEMO.t.panelEnd : 0}
              zoomTo="panel"
              zoomAt={b(1)}
              zoom={1.15}
              fallback={<FakePanel />}
            />
          </PhoneFrame>
        </AbsoluteFill>
        <AbsoluteFill style={{ left: 120, width: 900, justifyContent: 'center', gap: 40 }}>
          <Kinetic text="Bukan nebak. Ada buktinya." at={0} size={80} align="left" highlight={{ buktinya: C.supported }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 20 }}>
            <Point at={b(2)} n={1} text="Klaim yang kedeteksi" />
            <Point at={b(4)} n={2} text="Sumber resmi + % cocok" />
            <Point at={b(6)} n={3} text="Kesimpulan bersitasi" />
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DASH, DEMO } from '../rec';
import { b, C, FONT, SCENES } from '../theme';
import { Bg, Counter, Flash, useWhip } from '../ui/Fx';
import { Kinetic } from '../ui/Kinetic';
import { FakePanel, PhoneScreen } from '../ui/Mock';
import { PhoneFrame, RecClip } from '../ui/Rec';

const W = 660;
const H = 896;
const SPLIT = b(8);

const Kpi: React.FC<{ label: string; to: number; at: number; color: string; chip?: string }> = ({ label, to, at, color, chip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 15 } });
  return (
    <div style={{ flex: 1, padding: 28, borderRadius: 20, background: '#ffffff', border: '1px solid #e2e2dc', transform: `translateY(${(1 - s) * 40}px)`, opacity: s }}>
      <div style={{ fontSize: 22, color: '#5b5f68', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <span style={{ fontSize: 64, fontWeight: 900, color }}><Counter from={0} to={to} at={at} dur={b(2)} /></span>
        {chip && <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', background: C.hoax, borderRadius: 999, padding: '4px 12px' }}>{chip}</span>}
      </div>
    </div>
  );
};

// Pengganti dashboard Mode Satuan (bila rekaman dashboard belum ada).
const FakeDash: React.FC = () => (
  <AbsoluteFill style={{ background: '#f4f4f1', fontFamily: FONT, padding: 40, gap: 26, display: 'flex', flexDirection: 'column' }}>
    <div style={{ fontSize: 34, fontWeight: 900, color: '#16181d' }}>NARASI · Mode Satuan</div>
    <div style={{ display: 'flex', gap: 20 }}>
      <Kpi label="Narasi prioritas tinggi" to={3} at={b(1)} color="#d03b3b" chip="naik cepat" />
      <Kpi label="Laporan menunggu" to={12} at={b(2)} color="#16181d" />
      <Kpi label="Video ditandai terkait TNI" to={27} at={b(3)} color="#2f6fde" />
    </div>
    <div style={{ flex: 1, borderRadius: 20, background: '#fff', border: '1px solid #e2e2dc', padding: 28, fontSize: 26, color: '#16181d' }}>
      <b>Narasi yang perlu ditangani</b>
      <div style={{ marginTop: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ background: C.hoax, color: '#fff', borderRadius: 999, padding: '4px 14px', fontWeight: 800, fontSize: 20 }}>naik cepat</span>
        “18.000 personel TNI dikerahkan ke Aceh” · naik cepat · laporan baru
      </div>
    </div>
  </AbsoluteFill>
);

const Telegram: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 220 } });
  return (
    <div
      style={{
        position: 'absolute',
        right: 90,
        bottom: 70,
        width: 560,
        padding: 26,
        borderRadius: 22,
        background: '#1e2a38',
        border: '2px solid #2aabee',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        transform: `translateY(${(1 - s) * 200}px)`,
        fontFamily: FONT,
        color: '#fff',
      }}
    >
      <div style={{ fontSize: 22, color: '#2aabee', fontWeight: 800 }}>✈ Telegram · Peringatan Dini NARASI</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, lineHeight: 1.3 }}>⚠ Narasi naik cepat: mencatut TNI, prioritas tinggi</div>
    </div>
  );
};

// Gradasi bawah saat zoom ke narasi teratas, supaya fokus ke kasus yang baru direkam.
const DashFade: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const o = Math.min(1, Math.max(0, (frame - at) / 10));
  return <AbsoluteFill style={{ background: `linear-gradient(transparent 55%, ${C.bg} 92%)`, opacity: o }} />;
};

export const S6Lapor: React.FC = () => {
  const whip = useWhip(SPLIT, SCENES.lapor.dur + 6);
  return (
    <AbsoluteFill>
      <Bg tint={C.gold} />
      <Sequence durationInFrames={SPLIT}>
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 150 }}>
          <PhoneFrame width={W} height={H}>
            <PhoneScreen
              width={W}
              height={H}
              from={DEMO ? DEMO.t.reportOpen - 0.3 : 0}
              to={DEMO ? DEMO.t.reportSent + 1 : 0}
              zoomTo="panel"
              zoom={1.1}
              fallback={<FakePanel />}
            />
          </PhoneFrame>
        </AbsoluteFill>
        <AbsoluteFill style={{ left: 900, width: 930, justifyContent: 'center', gap: 40 }}>
          <Kinetic text="Lapor? Sekali klik." at={0} size={92} align="left" highlight={{ Sekali: C.gold, klik: C.gold }} />
          <Kinetic text="Prajurit, keluarga, warga, semua bisa." at={b(3)} size={50} weight={700} align="left" color={C.muted} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={SPLIT} durationInFrames={SCENES.lapor.dur - SPLIT}>
        <AbsoluteFill style={{ ...whip }}>
          <AbsoluteFill style={{ alignItems: 'center', paddingTop: 60, gap: 30 }}>
            <Kinetic text="Tim Penerangan tahu duluan." at={0} size={72} highlight={{ Penerangan: C.accent, duluan: C.accent }} />
            <div style={{ width: 1500, height: 820, borderRadius: 24, overflow: 'hidden', border: `2px solid ${C.border}`, boxShadow: '0 40px 120px rgba(0,0,0,0.7)', position: 'relative' }}>
              <div style={{ height: 44, background: '#1b1d22', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 18 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
                <span style={{ marginLeft: 20, fontFamily: FONT, fontSize: 18, color: C.muted }}>Mode Satuan · Dashboard Penerangan</span>
              </div>
              <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}>
                {DASH ? (
                  <RecClip
                    src={DASH.file}
                    from={DASH.t.start}
                    to={DASH.t.end}
                    viewport={DASH.viewport}
                    crop={{ x: 0, y: 0, w: DASH.viewport.w, h: DASH.viewport.h }}
                    width={1500}
                    height={776}
                    focus={DASH.narrative ? [{ at: b(3), box: { ...DASH.narrative, x: DASH.narrative.x - 70, y: DASH.narrative.y - 40 }, zoom: 2.3 }] : []}
                  />
                ) : (
                  <FakeDash />
                )}
                {DASH && <DashFade at={b(3) + 6} />}
              </div>
            </div>
          </AbsoluteFill>
          <Telegram at={b(8)} />
        </AbsoluteFill>
      </Sequence>
      <Flash at={SPLIT} color={C.accent} />
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MONO } from '../theme';
import { Glitch, SvgDefs } from '../ui/Fx';
import { DataFlow } from './Flow';
import { LogoReveal } from './Logo';
import { Ring, type Card } from './Ring';
import {
  BrowserWin, CYAN, Flash, Footage, Grain, Grid3D, LottieAt, LottieFx, ORANGE, Phone, phoneGeom, Slam, Tag, Words, type Box,
} from './parts';

// Iklan 30 detik NARASI. 120 BPM -> 1 beat = 15 frame. Semua footage diambil dari rekaman asli
// extension/e2e/record-ad.spec.ts (public/rec/feed.mp4 dan dashlive.mp4). Detik sumber di bawah ini dicari
// langsung dari frame rekaman (komposisi Sheet), karena jam Playwright dan durasi webm tidak sama persis.
export const AD_FPS = 30;
export const AD_TOTAL = 900;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = Easing.bezier(0.7, 0, 0.2, 1);

const S = { open: 0, feed: 120, hoax: 360, flow: 510, live: 570, reel: 750, logo: 825 } as const;

const FEED = { file: 'rec/feed.mp4', vp: { w: 1280, h: 900 } };
const DASH = { file: 'rec/dashlive.mp4', vp: { w: 1600, h: 1400 } };
const playerAt = (x: number): Box => ({ x, y: 64, w: 452, h: 804 });

const NEUTRAL = '#6B7688';
const HOAX = C.hoax;

// Lima Shorts acak yang di-scroll + detik label-nya muncul di rekaman.
const SEGS = [
  { src: 33.0, rate: 1.25, label: 34.5, bx: 418, by: 763, bw: 110, text: 'Tanpa Klaim', color: NEUTRAL, line: 'Nonton kayak biasa.' },
  { src: 45.5, rate: 1.5, label: 47.25, bx: 418, by: 763, bw: 110, text: 'Tanpa Klaim', color: NEUTRAL, line: 'Caption dibaca.' },
  { src: 58.5, rate: 1.5, label: 60.25, bx: 418, by: 769, bw: 130, text: 'Tanpa Klaim', color: NEUTRAL, line: 'Teks layar dibaca.' },
  { src: 77.0, rate: 1.5, label: 78.75, bx: 418, by: 763, bw: 170, text: 'Belum Terverifikasi', color: C.unverified, line: 'Suaranya didengerin.' },
  { src: 107.0, rate: 1.5, label: 108.75, bx: 418, by: 795, bw: 130, text: 'Tanpa Klaim', color: NEUTRAL, line: 'Tanpa pindah tab.' },
];
const SEG_LEN = 48;
const segLabelFrame = (i: number) => S.feed + i * SEG_LEN + Math.round(((SEGS[i].label - SEGS[i].src) / SEGS[i].rate) * AD_FPS);

// Potongan rekaman feed di dalam ponsel (frame global).
const PHONE_CLIPS: { from: number; dur: number; src: number; rate: number; x: number }[] = [
  ...SEGS.map((s, i) => ({ from: S.feed + i * SEG_LEN, dur: SEG_LEN, src: s.src, rate: s.rate, x: 402 })),
  { from: 360, dur: 60, src: 129.6, rate: 2, x: 534 }, // video hoaks: "Membaca teks…" -> 100% Indikasi Hoaks di frame ~419
  { from: 420, dur: 45, src: 133.6, rate: 1, x: 534 },
  { from: 465, dur: 25, src: 144.2, rate: 1.2, x: 402 }, // panel bukti
  { from: 490, dur: 136, src: 161.2, rate: 1.5, x: 402 }, // klik "Kirim laporan" -> terkirim di frame ~626
  { from: 626, dur: 124, src: 168.0, rate: 0.72, x: 402 },
];
const HOAX_LABEL = 419;
const REPORT_SENT = 626;

// Dashboard: baris "Indikasi hoaks 100%" masuk di detik 148,0; "Laporan pengguna masuk" di 183,25.
const DASH_CLIPS = [
  { from: S.flow, dur: 60, src: 146.5, rate: 1 }, // hoaks masuk di frame 555
  { from: S.live, dur: 180, src: 181.38, rate: 1 }, // laporan masuk di frame 626
];
const HOAX_ROW = 555;

const THUMBS: Card[] = [
  { src: 'ad/t0.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
  { src: 'ad/t1.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
  { src: 'ad/t9.jpg', label: '100% Indikasi Hoaks', color: HOAX },
  { src: 'ad/t2.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
  { src: 'ad/t4.jpg', label: 'Membaca teks…', color: CYAN },
  { src: 'ad/t5.jpg', label: 'Belum Terverifikasi', color: C.unverified },
  { src: 'ad/t6.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
  { src: 'ad/t7.jpg', label: 'Membaca teks…', color: CYAN },
  { src: 'ad/t8.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
  { src: 'ad/t3.jpg', label: 'Tanpa Klaim', color: NEUTRAL },
];

// ---------------------------------------------------------------- Ponsel (persisten 120–750)
const PW = 470;
const G = phoneGeom(PW);
const K = G.innerW / 452; // skala piksel rekaman -> layar ponsel

function phoneTransform(f: number) {
  // Posisi pusat ponsel di layar + skala, berubah antar babak.
  const x = interpolate(f, [S.flow, S.flow + 30], [600, 360], { ...clamp, easing: ease });
  const scale = interpolate(f, [S.flow, S.flow + 30], [1, 0.92], { ...clamp, easing: ease });
  const zoom = interpolate(f, [400, 420, 455, 470], [1, 1.32, 1.32, 1], { ...clamp, easing: ease });
  return { x, y: 540, scale: scale * zoom };
}

const PhoneLayer: React.FC = () => {
  const f = useCurrentFrame() + S.feed;
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f - S.feed, fps, config: { damping: 14, stiffness: 160 } });
  const t = phoneTransform(f);
  // Badge hoaks (sebelum geser layout) sebagai titik pusat zoom.
  const ox = G.pad + (546 - 534 + 128) * K;
  const oy = G.pad + (698 - 64 + 15) * K;
  // Transisi "scroll": konten masuk dari bawah dengan blur di awal tiap Shorts.
  const segIdx = Math.floor((f - S.feed) / SEG_LEN);
  const inSeg = f < S.hoax ? (f - S.feed) % SEG_LEN : f - S.hoax;
  const swipe = (f < S.hoax && segIdx > 0) || f >= S.hoax ? interpolate(inSeg, [0, 6], [1, 0], clamp) : 0;
  return (
    <div style={{
      position: 'absolute', left: t.x - PW / 2, top: t.y - G.h / 2, width: PW, height: G.h,
      transform: `perspective(1400px) rotateY(${(1 - enter) * 70}deg) scale(${t.scale * (0.6 + enter * 0.4)})`,
      transformOrigin: `${ox}px ${oy}px`, opacity: Math.min(1, enter * 2),
    }}>
      <Glitch at={HOAX_LABEL + 1 - S.feed} dur={8}>
        <Phone width={PW} glow={f >= HOAX_LABEL && f < S.flow ? HOAX : CYAN}>
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${swipe * G.innerH * 0.5}px)`, filter: swipe > 0.05 ? `blur(${swipe * 18}px)` : undefined }}>
            {PHONE_CLIPS.map((c) => (
              <Sequence key={c.from} from={c.from - S.feed} durationInFrames={c.dur} layout="none">
                <Footage file={FEED.file} vp={FEED.vp} crop={playerAt(c.x)} width={G.innerW} from={c.src} rate={c.rate} />
              </Sequence>
            ))}
          </div>
        </Phone>
      </Glitch>
      {/* Ledakan Lottie tepat di badge tiap kali label muncul */}
      {SEGS.map((s, i) => (
        <LottieAt key={i} name="burst" at={segLabelFrame(i) - S.feed} size={300} dur={24}
          x={G.pad + (s.bx - 402 + s.bw / 2) * K} y={G.pad + (s.by - 64 + 15) * K} />
      ))}
      <LottieAt name="burst-red" at={HOAX_LABEL - S.feed} size={460} dur={24} x={ox} y={oy} />
      <LottieAt name="check" at={REPORT_SENT - S.feed} size={200} dur={60} x={PW / 2} y={G.h * 0.55} />
    </div>
  );
};

// ---------------------------------------------------------------- Dashboard (persisten 510–750)
const WIN = { x: 700, y: 170, w: 1150, h: 740 };
type Region = Box;
const LOG: Region = { x: 110, y: 905, w: 880, h: 560 };
const FLOWR: Region = { x: 760, y: 360, w: 780, h: 520 };
const camAt = (f: number): Region => {
  const p = interpolate(f, [690, 712], [0, 1], { ...clamp, easing: ease });
  const push = interpolate(f, [712, 750], [0, 1], clamp);
  const r = {
    x: LOG.x + (FLOWR.x - LOG.x) * p, y: LOG.y + (FLOWR.y - LOG.y) * p,
    w: LOG.w + (FLOWR.w - LOG.w) * p, h: LOG.h + (FLOWR.h - LOG.h) * p,
  };
  // Dorongan kamera pelan supaya tidak pernah diam.
  return { x: r.x + r.w * 0.03 * push, y: r.y + r.h * 0.03 * push, w: r.w * (1 - 0.06 * push), h: r.h * (1 - 0.06 * push) };
};

const DashCam: React.FC<{ f: number; w: number; h: number; clips: typeof DASH_CLIPS; offset: number }> = ({ f, w, h, clips, offset }) => {
  const r = camAt(f);
  const s = Math.min(w / r.w, h / r.h);
  const tx = -r.x * s + (w - r.w * s) / 2;
  const ty = -r.y * s + (h - r.h * s) / 2;
  return (
    <div style={{ width: w, height: h, overflow: 'hidden', position: 'relative', background: '#0b0d12' }}>
      <div style={{ position: 'absolute', left: tx, top: ty }}>
        {clips.map((c) => (
          <Sequence key={c.from} from={c.from - offset} durationInFrames={c.dur} layout="none">
            <Footage file={DASH.file} vp={DASH.vp} crop={{ x: 0, y: 0, w: 1600, h: 1400 }} width={1600 * s} from={c.src} rate={c.rate} />
          </Sequence>
        ))}
      </div>
    </div>
  );
};

const DashLayer: React.FC = () => {
  const local = useCurrentFrame();
  const f = local + S.flow;
  const { fps } = useVideoConfig();
  const fly = spring({ frame: local, fps, config: { damping: 16, stiffness: 90 } });
  const row = interpolate(f, [HOAX_ROW, HOAX_ROW + 4, HOAX_ROW + 40], [0, 1, 0], clamp);
  const rep = interpolate(f, [REPORT_SENT, REPORT_SENT + 4, REPORT_SENT + 50], [0, 1, 0], clamp);
  // Posisi baris teratas log di layar (kamera LOG) untuk sorotan.
  const cam = camAt(f);
  const s = Math.min(WIN.w / cam.w, (WIN.h - 44) / cam.h);
  const rowY = 44 + (995 - cam.y) * s + ((WIN.h - 44) - cam.h * s) / 2;
  return (
    <div style={{
      position: 'absolute', left: WIN.x, top: WIN.y, transformOrigin: '0% 50%',
      transform: `perspective(1600px) translateX(${(1 - fly) * 900}px) rotateY(${-40 * (1 - fly) - 6}deg)`, opacity: Math.min(1, fly * 3),
    }}>
      <BrowserWin width={WIN.w} url="localhost:5174 · NARASI Mode Satuan">
        <DashCam f={f} w={WIN.w} h={WIN.h - 44} clips={DASH_CLIPS} offset={S.flow} />
      </BrowserWin>
      {/* Sorotan baris baru di log */}
      {f < 690 && (row > 0 || rep > 0) && (
        <div style={{
          position: 'absolute', left: 16, right: 16, top: rowY - 34, height: 68, borderRadius: 12,
          border: `3px solid ${row > 0 ? HOAX : C.gold}`, opacity: Math.max(row, rep),
          boxShadow: `0 0 40px ${row > 0 ? HOAX : C.gold}`,
        }} />
      )}
      <div style={{ position: 'absolute', right: 20, top: 56, display: 'flex', alignItems: 'center', gap: 4 }}>
        <LottieFx name="pulse" size={56} loop />
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: C.supported, letterSpacing: '0.1em' }}>LIVE</span>
      </div>
      <LottieAt name="burst-red" at={HOAX_ROW - S.flow} x={120} y={rowY} size={360} dur={24} />
      <LottieAt name="burst" at={REPORT_SENT - S.flow} x={120} y={rowY} size={360} dur={24} />
    </div>
  );
};

// ---------------------------------------------------------------- Babak
const Open: React.FC = () => {
  const f = useCurrentFrame();
  const words: [number, boolean, number][] = [[0, false, -10], [15, true, 0], [30, false, 10], [45, true, 0]];
  const ringScale = interpolate(f, [100, 120], [1, 2.4], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Grid3D />
      <AbsoluteFill style={{ transform: `scale(${ringScale})`, opacity: interpolate(f, [104, 120], [1, 0], clamp) }}>
        <Ring cards={THUMBS} period={150} radius={820} cardW={250} tilt={-8} showLabels />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, #07080bcc 0%, transparent 60%)' }} />
      {words.map(([at, stroke, rot]) => (
        <Slam key={at} text="SCROLL." at={at} until={at + 15} size={300} stroke={stroke} rotate={rot} color={stroke ? CYAN : C.text} />
      ))}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Words text="Ratusan video sehari." at={60} until={90} size={120} stagger={3} />
      </AbsoluteFill>
      <Glitch at={90} dur={6}>
        <Slam text={'Yang mana\nHOAKS?'} at={90} until={120} size={190} color={C.text} style={{}} />
      </Glitch>
      <Flash at={90} color={HOAX} peak={0.4} />
    </AbsoluteFill>
  );
};

const FeedText: React.FC = () => {
  const f = useCurrentFrame() + S.feed;
  const { fps } = useVideoConfig();
  const i = Math.min(SEGS.length - 1, Math.floor((f - S.feed) / SEG_LEN));
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 980, top: 150 }}>
        <Tag color={HOAX}><span style={{ width: 12, height: 12, borderRadius: 6, background: HOAX }} />REKAMAN ASLI · YOUTUBE SHORTS</Tag>
      </div>
      {SEGS.map((s, k) => (
        <div key={k} style={{ position: 'absolute', left: 980, top: 250 }}>
          <Words text={s.line} at={k * SEG_LEN} until={(k + 1) * SEG_LEN} size={92} stagger={2} accent={{ dibaca: CYAN, didengerin: CYAN, tab: CYAN }} />
        </div>
      ))}
      {/* Tally: tiap video yang lewat langsung punya label */}
      <div style={{ position: 'absolute', left: 980, top: 430, display: 'grid', gap: 14 }}>
        {SEGS.map((s, k) => {
          const at = segLabelFrame(k);
          if (f < at) return null;
          const p = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 240 } });
          return (
            <div key={k} style={{
              display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.text,
              transform: `translateX(${(1 - p) * 120}px)`, opacity: p * (k === i ? 1 : 0.55),
            }}>
              <span style={{ fontFamily: MONO, color: C.muted, fontSize: 28 }}>#{String(k + 1).padStart(2, '0')}</span>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: s.color, boxShadow: `0 0 14px ${s.color}` }} />
              {s.text}
              <span style={{ fontFamily: MONO, color: C.muted, fontSize: 24 }}>· dicek</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const HoaxText: React.FC = () => {
  const f = useCurrentFrame() + S.hoax;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 980, top: 250 }}>
        <Words text="Eh, tunggu…" at={0} until={HOAX_LABEL - S.hoax} size={110} />
      </div>
      {f >= HOAX_LABEL && f < 465 && (
        <>
          <div style={{ position: 'absolute', left: 1030, top: 180 }}>
            <Sequence from={HOAX_LABEL - S.hoax} layout="none"><LottieFx name="alert" size={170} /></Sequence>
          </div>
          <div style={{ position: 'absolute', left: 1000, top: 380 }}>
            <StampAt at={HOAX_LABEL - S.hoax} />
          </div>
          <div style={{ position: 'absolute', left: 1000, top: 640 }}>
            <Words text="100% Indikasi Hoaks." at={HOAX_LABEL - S.hoax + 8} size={64} accent={{ Hoaks: HOAX }} />
          </div>
          <div style={{ position: 'absolute', left: 1000, top: 730, display: 'flex', gap: 16 }}>
            <Pop at={HOAX_LABEL - S.hoax + 16}><span style={{ padding: '8px 18px', borderRadius: 10, background: C.gold, color: C.goldText, fontFamily: FONT, fontWeight: 900, fontSize: 32 }}>Mencatut TNI</span></Pop>
            <Pop at={HOAX_LABEL - S.hoax + 22}><span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, color: C.muted }}>dibantah Komdigi</span></Pop>
          </div>
        </>
      )}
      <div style={{ position: 'absolute', left: 980, top: 260 }}>
        <Words text="Buktinya ada. Sumbernya resmi." at={465 - S.hoax} until={490 - S.hoax} size={84} accent={{ resmi: CYAN }} style={{ width: 820 }} />
      </div>
      <div style={{ position: 'absolute', left: 980, top: 260 }}>
        <Words text="Lapor ke TNI AD? Sekali klik." at={490 - S.hoax} until={S.flow - S.hoax} size={84} accent={{ klik: C.gold }} style={{ width: 820 }} />
      </div>
      <Flash at={HOAX_LABEL - S.hoax} color={HOAX} peak={0.55} />
    </AbsoluteFill>
  );
};

const StampAt: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 9, stiffness: 320, mass: 0.7 } });
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 900, fontSize: 210, color: HOAX, padding: '0 36px', border: `14px solid ${HOAX}`, borderRadius: 22,
      transform: `rotate(-7deg) scale(${2.4 - s * 1.4})`, opacity: Math.min(1, s * 2), textShadow: `0 0 40px ${HOAX}88`,
      boxShadow: `0 0 60px ${HOAX}55, inset 0 0 40px ${HOAX}33`, background: '#07080baa', transformOrigin: '30% 50%',
    }}>HOAKS</div>
  );
};

const Pop: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 260 } });
  return <div style={{ transform: `scale(${s})`, opacity: Math.min(1, s * 2) }}>{children}</div>;
};

const LiveText: React.FC = () => {
  const f = useCurrentFrame() + S.flow;
  return (
    <AbsoluteFill>
      <DataFlow from={[360 + (PW * 0.92) / 2, 540]} to={[WIN.x + 10, WIN.y + 380]} at={10} lanes={5} hot={2} />
      <div style={{ position: 'absolute', left: WIN.x, top: 60 }}>
        <Words text="Detik itu juga, masuk dashboard." at={S.flow + 6 - S.flow} until={REPORT_SENT - S.flow} size={66} accent={{ dashboard: CYAN }} />
      </div>
      <div style={{ position: 'absolute', left: WIN.x, top: 60 }}>
        <Words text="Laporan masuk. Penerangan tahu duluan." at={REPORT_SENT - S.flow} until={700 - S.flow} size={66} accent={{ duluan: C.gold }} />
      </div>
      <div style={{ position: 'absolute', left: WIN.x, top: 60 }}>
        <Words text="Realtime. Tanpa refresh." at={700 - S.flow} size={66} accent={{ Realtime: CYAN }} />
      </div>
      {f >= HOAX_ROW && f < HOAX_ROW + 40 && (
        <div style={{ position: 'absolute', left: WIN.x + 40, top: WIN.y + WIN.h + 24 }}>
          <Tag color={HOAX}>VONIS MASUK · 100% HOAKS</Tag>
        </div>
      )}
      {f >= REPORT_SENT && f < REPORT_SENT + 60 && (
        <div style={{ position: 'absolute', left: WIN.x + 40, top: WIN.y + WIN.h + 24 }}>
          <Tag color={C.gold}>LAPORAN · ANONIM</Tag>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Showreel: potongan cepat tab dashboard asli di kartu 3D, tiap 15 frame (1 beat).
const REEL = [
  { src: 451.5, text: 'Rangkuman.' },
  { src: 460.5, text: 'Rekomendasi aksi.' },
  { src: 471.0, text: 'Laporan warga.' },
  { src: 430.0, text: 'Peringatan dini.' },
];
const Reel: React.FC = () => {
  const f = useCurrentFrame();
  const i = Math.floor(f / 15);
  const k = f % 15;
  const shot = REEL[i];
  return (
    <AbsoluteFill>
      <Grid3D speed={3} />
      {shot ? (
        <>
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1600 }}>
            <div style={{
              transform: `rotateY(${(i % 2 ? -1 : 1) * (14 - k * 0.6)}deg) rotateX(8deg) scale(${0.92 + k * 0.006})`,
              borderRadius: 18, overflow: 'hidden', boxShadow: `0 40px 100px #000, 0 0 60px ${CYAN}33`, border: `1px solid ${C.border}`,
            }}>
              <Sequence from={i * 15} durationInFrames={15} layout="none">
                <Footage file={DASH.file} vp={DASH.vp} crop={{ x: 100, y: 150, w: 1400, h: 860 }} width={1440} from={shot.src} rate={1} />
              </Sequence>
            </div>
          </AbsoluteFill>
          <AbsoluteFill style={{ background: 'linear-gradient(to top, #07080bf0 0%, transparent 40%)' }} />
          <Slam text={shot.text} at={i * 15} until={i * 15 + 15} size={130} y={330} />
          <Flash at={i * 15} peak={0.35} />
        </>
      ) : (
        <>
          <Ring cards={THUMBS} period={60} radius={700} cardW={230} tilt={-6} showLabels />
          <Slam text={'Shorts. Reels.\nTikTok. Facebook.'} at={60} size={130} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Komposisi
export const NarasiAd: React.FC = () => {
  const frame = useCurrentFrame();
  const midBg = frame >= S.feed && frame < S.reel;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <SvgDefs />
      {midBg && <Grid3D tint={frame >= HOAX_LABEL && frame < S.flow ? HOAX : CYAN} speed={frame >= S.flow ? 1.6 : 1} />}
      <Sequence from={S.open} durationInFrames={S.feed} name="1 open"><Open /></Sequence>
      <Sequence from={S.feed} durationInFrames={S.hoax - S.feed} name="2 feed"><FeedText /></Sequence>
      <Sequence from={S.hoax} durationInFrames={S.flow - S.hoax} name="3 hoaks"><HoaxText /></Sequence>
      <Sequence from={S.flow} durationInFrames={S.reel - S.flow} name="4 dashboard"><DashLayer /><LiveText /></Sequence>
      <Sequence from={S.feed} durationInFrames={S.reel - S.feed} name="ponsel"><PhoneLayer /></Sequence>
      <Sequence from={S.reel} durationInFrames={S.logo - S.reel} name="5 showreel"><Reel /></Sequence>
      <Sequence from={S.logo} durationInFrames={AD_TOTAL - S.logo} name="6 logo"><Grid3D speed={0.6} /><LogoReveal /></Sequence>
      <Flash at={S.feed} peak={0.6} />
      <Flash at={S.flow} color={CYAN} peak={0.3} />
      <Flash at={S.reel} peak={0.5} />
      <Grain />
      <Audio src={staticFile('music-ad.wav')} volume={(f) => interpolate(f, [AD_TOTAL - 20, AD_TOTAL], [1, 0], clamp)} />
      {/* Penanda kecil di pojok supaya jelas ini produk asli */}
      {frame >= S.feed && frame < S.reel && (
        <div style={{ position: 'absolute', left: 48, bottom: 36, fontFamily: MONO, fontSize: 20, color: C.muted, letterSpacing: '0.08em' }}>
          NARASI · ekstensi browser + dashboard Mode Satuan · <span style={{ color: ORANGE }}>rekaman layar asli</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

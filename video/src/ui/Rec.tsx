import React from 'react';
import { interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import type { Box } from '../rec';
import { C, MONO } from '../theme';

type Focus = { at: number; box: Box; zoom: number };

// Potongan rekaman asli dari detik `from` sampai `to`, dipadatkan supaya pas `durationInFrames` Sequence.
// `focus` berisi keyframe zoom/pan ke area tertentu (koordinat halaman rekaman).
export const RecClip: React.FC<{
  src: string;
  from: number;
  to: number;
  viewport: { w: number; h: number };
  crop: Box; // area rekaman yang ditampilkan
  width: number; // ukuran tampil di komposisi
  height: number;
  focus?: Focus[];
  muted?: boolean;
}> = ({ src, from, to, viewport, crop, width, height, focus = [], muted = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const rate = Math.max(0.25, (to - from) / (durationInFrames / fps));

  // Zoom/pan: interpolasi antar keyframe focus, default menampilkan seluruh crop.
  // Tiap keyframe ditempuh dalam 12 frame mulai dari `at`-nya, berangkat dari keyframe sebelumnya.
  const keys: Focus[] = [{ at: 0, box: crop, zoom: 1 }, ...focus];
  let i = 0;
  while (i + 1 < keys.length && frame >= keys[i + 1].at) i++;
  const prev = keys[Math.max(0, i - 1)];
  const cur = keys[i];
  const p = i === 0 ? 1 : interpolate(frame, [cur.at, cur.at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const lerp = (a: number, b2: number) => a + (b2 - a) * p;
  const zoom = lerp(prev.zoom, cur.zoom);
  const cx = lerp(prev.box.x + prev.box.w / 2, cur.box.x + cur.box.w / 2);
  const cy = lerp(prev.box.y + prev.box.h / 2, cur.box.y + cur.box.h / 2);

  const base = Math.max(width / crop.w, height / crop.h);
  const scale = base * zoom;
  // Pan dibatasi supaya tidak pernah menampilkan area di luar rekaman (hitam).
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(width / 2 - cx * scale, width - viewport.w * scale, 0);
  const ty = clamp(height / 2 - cy * scale, height - viewport.h * scale, 0);

  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', background: '#000' }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(from * fps)}
        playbackRate={rate}
        muted={muted}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: viewport.w,
          height: viewport.h,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        }}
      />
    </div>
  );
};

// Bingkai HP vertikal.
export const PhoneFrame: React.FC<{ width: number; height: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  width,
  height,
  children,
  style,
}) => (
  <div
    style={{
      width: width + 28,
      height: height + 28,
      padding: 14,
      borderRadius: 44,
      background: 'linear-gradient(145deg, #2a2e37, #0d0f13)',
      boxShadow: '0 40px 120px rgba(0,0,0,0.7), inset 0 0 0 2px #3a3f4a',
      ...style,
    }}
  >
    <div style={{ width, height, borderRadius: 32, overflow: 'hidden', position: 'relative', background: '#000' }}>{children}</div>
  </div>
);

// Timer waktu nyata: menampilkan detik sejak `t0` dihitung dari posisi rekaman.
export const RealTimer: React.FC<{ from: number; to: number; t0: number; label?: string; color?: string }> = ({
  from,
  to,
  t0,
  label = 'WAKTU NYATA',
  color = C.supported,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = from + (to - from) * (frame / durationInFrames) - t0;
  return (
    <div style={{ fontFamily: MONO, color: C.text, textAlign: 'right' }}>
      <div style={{ fontSize: 22, letterSpacing: '0.2em', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 72, fontWeight: 700, color }}>{Math.max(0, t).toFixed(1)}s</div>
    </div>
  );
};

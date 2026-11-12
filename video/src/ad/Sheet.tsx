import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

// Alat bantu produksi: lembar kontak rekaman (bukan bagian video). Dipakai untuk mencari detik kejadian.
//   remotion still src/index.ts Sheet out.png --props='{"file":"rec/feed.mp4","from":30,"step":1,"crop":[...]}'
export type SheetProps = { file: string; from: number; step: number; cols: number; rows: number; crop: [number, number, number, number]; vw: number; vh: number };

export const Sheet: React.FC<SheetProps> = ({ file, from, step, cols, rows, crop, vw, vh }) => {
  const [cx, cy, cw, ch] = crop;
  const cellW = 1920 / cols;
  const k = cellW / cw;
  const cellH = ch * k;
  return (
    <AbsoluteFill style={{ background: '#222', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const t = from + i * step;
        return (
          <div key={i} style={{ width: cellW, height: cellH + 22, position: 'relative', overflow: 'hidden', borderRight: '1px solid #000' }}>
            <div style={{ width: cellW, height: cellH, overflow: 'hidden', position: 'relative' }}>
              <OffthreadVideo src={staticFile(file)} startFrom={Math.round(t * 30)} muted
                style={{ position: 'absolute', left: -cx * k, top: -cy * k, width: vw * k, height: vh * k, maxWidth: 'none' }} />
            </div>
            <div style={{ color: '#fff', font: 'bold 16px sans-serif', padding: 2 }}>{t.toFixed(1)}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

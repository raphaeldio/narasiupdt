import React from 'react';
import { Composition } from 'remotion';
import { NarasiDemo } from './NarasiDemo';
import { AD_FPS, AD_TOTAL, NarasiAd } from './ad/NarasiAd';
import { Sheet, type SheetProps } from './ad/Sheet';
import { FPS, TOTAL } from './theme';

// Lembar kontak rekaman untuk mencari detik kejadian (alat bantu produksi, bukan video).
const SHEET: SheetProps = { file: 'rec/feed.mp4', from: 0, step: 2, cols: 16, rows: 5, crop: [390, 40, 620, 840], vw: 1280, vh: 900 };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="NarasiDemo" component={NarasiDemo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="NarasiAd" component={NarasiAd} durationInFrames={AD_TOTAL} fps={AD_FPS} width={1920} height={1080} />
    <Composition id="Sheet" component={Sheet} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={SHEET} />
  </>
);

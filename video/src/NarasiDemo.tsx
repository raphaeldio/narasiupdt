import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from 'remotion';
import { getStaticFiles } from '@remotion/studio';
import { FPS, SCENES } from './theme';
import { VO_SECONDS } from './vo';
import { SvgDefs } from './ui/Fx';
import { S1Hook } from './scenes/S1Hook';
import { S2Masalah } from './scenes/S2Masalah';
import { S3Reveal } from './scenes/S3Reveal';
import { S4Demo } from './scenes/S4Demo';
import { S5Inovasi } from './scenes/S5Inovasi';
import { S6Lapor } from './scenes/S6Lapor';
import { S7Siap } from './scenes/S7Siap';
import { S8Penutup } from './scenes/S8Penutup';

const ORDER: [keyof typeof SCENES, React.FC][] = [
  ['hook', S1Hook],
  ['masalah', S2Masalah],
  ['reveal', S3Reveal],
  ['demo', S4Demo],
  ['inovasi', S5Inovasi],
  ['lapor', S6Lapor],
  ['siap', S7Siap],
  ['penutup', S8Penutup],
];

// Musik (scripts/music.mjs) dan VO (scripts/vo.mjs) opsional: dipakai hanya bila file-nya ada di public/.
const has = (name: string) => getStaticFiles().some((f) => f.name === name);

// VO masuk 3 frame setelah cut supaya tidak bertabrakan dengan hantaman musik.
const VO_DELAY = 3;
const MUSIC = 0.55;
const MUSIC_UNDER_VO = 0.2;
const DUCK_RAMP = 6;

// Rentang frame tiap VO dalam timeline utama, untuk ducking musik.
const voRanges = ORDER.map(([key], i) => {
  const from = SCENES[key].from + VO_DELAY;
  return { from, to: from + Math.round((VO_SECONDS[i + 1] ?? 0) * FPS) };
});

function musicVolume(f: number) {
  // 1 = sedang ada VO (dengan ramp masuk/keluar), 0 = jeda.
  const duck = Math.max(
    0,
    ...voRanges.map(({ from, to }) =>
      interpolate(f, [from - DUCK_RAMP, from, to, to + DUCK_RAMP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    ),
  );
  return MUSIC + (MUSIC_UNDER_VO - MUSIC) * duck;
}

export const NarasiDemo: React.FC = () => (
  <AbsoluteFill style={{ background: '#07080b' }}>
    <SvgDefs />
    {ORDER.map(([key, Scene], i) => (
      <Sequence key={key} name={`${i + 1} ${key}`} from={SCENES[key].from} durationInFrames={SCENES[key].dur}>
        <Scene />
        {has(`vo/s${i + 1}.wav`) && (
          <Sequence from={VO_DELAY} layout="none">
            <Audio src={staticFile(`vo/s${i + 1}.wav`)} />
          </Sequence>
        )}
      </Sequence>
    ))}
    {has('music.wav') && <Audio src={staticFile('music.wav')} volume={musicVolume} />}
  </AbsoluteFill>
);

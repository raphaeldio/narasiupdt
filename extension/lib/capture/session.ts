import type { ContentMessage } from '../messages';
import { AudioCapturer } from './audio';
import { FrameCapturer } from './frames';

export interface CaptureHandle {
  stop(): void;
}

/** Frame + audio satu video untuk sesi `key`; mengirim analyze:complete setelah keduanya selesai. */
export function captureVideo(opts: {
  key: string;
  video: HTMLVideoElement;
  accepts: { frames: boolean; audio: boolean };
  isActive: () => boolean;
  send: <T = unknown>(msg: ContentMessage) => Promise<T>;
}): CaptureHandle {
  const { key, video, accepts, isActive, send } = opts;
  let pending = Number(accepts.frames) + Number(accepts.audio);
  const finished = () => {
    if (--pending === 0 && isActive()) send({ type: 'analyze:complete', key });
  };
  const frames = new FrameCapturer(
    video,
    () => send<string | null>({ type: 'capture:tab' }),
    (shots) => {
      if (shots.length && isActive()) send({ type: 'analyze:frames', key, frames: shots });
      finished();
    },
  );
  const audio = new AudioCapturer(
    video,
    (chunk, index) => {
      if (isActive()) send({ type: 'analyze:audio', key, chunk, index });
    },
    () => finished(),
  );
  if (accepts.frames) frames.start();
  if (accepts.audio) audio.start();
  return {
    stop() {
      frames.stop();
      audio.stop();
    },
  };
}

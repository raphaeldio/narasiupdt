import type { Platform } from '../types';

export interface CaptionInfo {
  caption: string;
  hashtags: string[];
}

/**
 * Adapter platform (PRD 6.1): hanya mengurus video aktif, ID + caption, dan titik tempel badge.
 * Semua analisis lain dipakai bersama oleh seluruh platform.
 */
export interface Adapter {
  platform: Platform;
  matches(location: Location): boolean;
  findActiveVideo(): HTMLVideoElement | null;
  getVideoId(video: HTMLVideoElement): string | null;
  getCaption(video: HTMLVideoElement): CaptionInfo;
  /** Elemen caption tempat badge ditempel di atasnya; null = badge ditempel ke video. */
  getAnchor(video: HTMLVideoElement): Element | null;
  findNextVideo(video: HTMLVideoElement): HTMLVideoElement | null;
}

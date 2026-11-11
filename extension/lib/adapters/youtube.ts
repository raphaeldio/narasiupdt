import { cleanText, mostVisibleVideo, splitCaption, visibleRatio } from './dom';
import type { Adapter } from './types';

const SHORTS_ID = /^\/shorts\/([\w-]{6,})/;

function currentId(): string | null {
  return location.pathname.match(SHORTS_ID)?.[1] ?? null;
}

const ACTIVE = 'ytd-reel-video-renderer[is-active]';
const TITLE_SELECTORS = [
  `${ACTIVE} yt-shorts-video-title-view-model`, `${ACTIVE} h2`, `${ACTIVE} .ytShortsVideoTitleViewModelShortsVideoTitle`,
  `${ACTIVE} #video-title`,
].join(', ');

/** Judul video aktif: overlay player bila tautannya menunjuk video yang sama, lalu judul di kartu Shorts aktif. */
function playerTitle(): string {
  const link = document.querySelector<HTMLAnchorElement>('#shorts-player .ytp-title-link');
  const id = currentId();
  if (link && id && link.href.includes(id)) {
    const text = cleanText(link) || link.textContent?.trim() || '';
    if (text) return text;
  }
  return cleanText(document.querySelector(TITLE_SELECTORS));
}

function titleElement(): Element | null {
  const title = playerTitle();
  if (!title) return null;
  const probe = title.slice(0, 24);
  // Overlay metadata Shorts dirender malas; cari elemen tampak yang memuat judul.
  for (const el of document.querySelectorAll('ytd-reel-video-renderer h2, ytd-reel-video-renderer span, yt-formatted-string')) {
    if (visibleRatio(el) > 0 && cleanText(el).startsWith(probe)) return el;
  }
  return null;
}

export const youtube: Adapter = {
  platform: 'youtube',
  matches: (loc) => /(^|\.)youtube\.com$/.test(loc.hostname),
  findActiveVideo() {
    if (!currentId()) return null;
    // Shorts memakai ulang satu elemen <video> untuk semua video.
    return document.querySelector<HTMLVideoElement>('#shorts-player video') ?? mostVisibleVideo();
  },
  getVideoId: () => currentId(),
  getCaption() {
    const title = playerTitle() || document.title.replace(/\s*-\s*YouTube\s*$/, '');
    return splitCaption(title);
  },
  getAnchor: titleElement,
  findNextVideo: () => null, // video berikutnya belum ada di DOM sebelum di-scroll
};

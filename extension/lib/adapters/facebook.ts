import { cardContainer, cleanText, idFromLinks, longestTextElement, mostVisibleVideo, nextVideoAfter, splitCaption } from './dom';
import type { Adapter } from './types';

// Reels FB dibuka lewat /reel/<id>, /reels/…, tautan bagikan /share/r|v/<kode>, atau Watch (/watch?v=<id>).
const VIDEO_PATH = /^\/(reel|reels|watch|share\/(r|v)|[^/]+\/videos)(\/|$)/;
const PATH_ID = /\/(?:reel|videos)\/(\d+)|\/share\/(?:r|v)\/([\w-]+)/;
const LINK_ID = /\/reel\/(\d+)|\/videos\/(\d+)|[?&]v=(\d+)/;

function captionElement(video: HTMLVideoElement): Element | null {
  const card = cardContainer(video);
  // Reels menaruh caption di lapisan atas video; kartu terdekat kadang hanya berisi pemutar.
  return longestTextElement(card, 'span[dir="auto"], div[dir="auto"]')
    ?? longestTextElement(card.parentElement ?? card, 'span[dir="auto"], div[dir="auto"]');
}

export const facebook: Adapter = {
  platform: 'facebook',
  matches: (loc) => /(^|\.)facebook\.com$/.test(loc.hostname),
  findActiveVideo() {
    return VIDEO_PATH.test(location.pathname) ? mostVisibleVideo() : null;
  },
  getVideoId(video) {
    const fromPath = location.pathname.match(PATH_ID);
    return fromPath?.[1] ?? fromPath?.[2] ?? new URLSearchParams(location.search).get('v')
      ?? idFromLinks(cardContainer(video), 'a[href*="/reel/"], a[href*="/videos/"], a[href*="watch"]', LINK_ID);
  },
  getCaption: (video) => splitCaption(cleanText(captionElement(video))),
  getAnchor: captionElement,
  findNextVideo: nextVideoAfter,
};

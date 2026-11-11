import { cardContainer, cleanText, idFromLinks, longestTextElement, mostVisibleVideo, nextVideoAfter, splitCaption } from './dom';
import type { Adapter } from './types';

const PATH_ID = /\/(?:reels?|p|tv)\/(?!audio\/)([\w-]{5,})/;
// "/reels/audio/<id>/" adalah tautan musik, bukan video.
const LINK_ID = /\/(?:reel|p|tv)\/([\w-]{5,})|\/reels\/(?!audio\/)([\w-]{5,})/;
const CAPTION_SELECTORS = 'h1, span[dir="auto"], div[dir="auto"]';

function captionElement(video: HTMLVideoElement): Element | null {
  const card = cardContainer(video);
  return longestTextElement(card, CAPTION_SELECTORS)
    // Tampilan satu Reel: caption berada di kolom samping, di luar kartu video.
    ?? longestTextElement(video.closest('article, main, [role="dialog"]') ?? card, CAPTION_SELECTORS);
}

export const instagram: Adapter = {
  platform: 'instagram',
  matches: (loc) => /(^|\.)instagram\.com$/.test(loc.hostname),
  findActiveVideo: () => mostVisibleVideo(),
  getVideoId(video) {
    // Di halaman Reels, URL berganti ke /reels/{shortcode}/ mengikuti video aktif. Di tempat lain (mis. profil)
    // ID diambil dari tautan di kartu video.
    return location.pathname.match(PATH_ID)?.[1]
      ?? idFromLinks(cardContainer(video), 'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]', LINK_ID);
  },
  getCaption: (video) => splitCaption(cleanText(captionElement(video))),
  getAnchor: captionElement,
  findNextVideo: nextVideoAfter,
};

import { cardContainer, cleanText, idFromLinks, longestTextElement, mostVisibleVideo, nextVideoAfter, splitCaption } from './dom';
import type { Adapter } from './types';

const DESC_SELECTORS = [
  '[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', '[data-e2e="search-card-desc"]',
  '[data-e2e="new-desc-span"]', '[data-e2e="feed-video-desc"]', '[class*="DivVideoInfoContainer"]',
  '[class*="DivDescriptionContentWrapper"]',
].join(', ');
const CARD_SELECTORS =
  '[data-e2e="recommend-list-item-container"], [data-e2e="feed-video"], [data-scroll-index], article, section[id^="media-card"]';
const PATH_ID = /\/(?:video|photo)\/(\d{8,})/;

function card(video: HTMLVideoElement): Element {
  return video.closest(CARD_SELECTORS) ?? cardContainer(video);
}

function captionElement(video: HTMLVideoElement): Element | null {
  const c = card(video);
  return c.querySelector(DESC_SELECTORS) ?? longestTextElement(c, 'span, h1, div[data-e2e]');
}

export const tiktok: Adapter = {
  platform: 'tiktok',
  matches: (loc) => /(^|\.)tiktok\.com$/.test(loc.hostname),
  findActiveVideo: () => mostVisibleVideo(),
  getVideoId(video) {
    // Pembungkus player TikTok memakai id "xgwrapper-<n>-<videoId>".
    const wrapper = video.closest('[id^="xgwrapper-"]');
    const fromWrapper = wrapper?.id.split('-').pop();
    if (fromWrapper && /^\d{8,}$/.test(fromWrapper)) return fromWrapper;
    return idFromLinks(card(video), 'a[href*="/video/"], a[href*="/photo/"]', PATH_ID)
      ?? location.pathname.match(PATH_ID)?.[1] ?? null;
  },
  getCaption: (video) => splitCaption(cleanText(captionElement(video))),
  getAnchor: captionElement,
  findNextVideo: nextVideoAfter,
};

import { cleanText, longestTextElement, splitCaption } from '../adapters/dom';
import { contentMedia, isSponsored, postId } from './dom';
import type { FeedAdapter, FeedItem } from './types';

const POST_LINK = /\/(?:p|reels?)\/([\w-]+)/;
const CAPTION_SELECTORS = 'h1, span[dir="auto"], div[dir="auto"]';

export function parseInstagram(doc: ParentNode = document): FeedItem[] {
  const items: FeedItem[] = [];
  for (const root of doc.querySelectorAll('article')) {
    if (isSponsored(root)) continue;
    const captionEl = longestTextElement(root, CAPTION_SELECTORS);
    const { caption, hashtags } = splitCaption(cleanText(captionEl));
    const post = postId(root, POST_LINK, caption);
    if (!post) continue;
    items.push({ id: post.id, ...contentMedia(root), text: caption, hashtags, url: post.url, root, anchor: captionEl ?? root });
  }
  return items;
}

export const instagramFeed: FeedAdapter = {
  platform: 'instagram',
  matchesFeed: (loc) => /(^|\.)instagram\.com$/.test(loc.hostname) && (loc.pathname === '/' || loc.pathname.startsWith('/p/')),
  findItems: () => parseInstagram(),
};

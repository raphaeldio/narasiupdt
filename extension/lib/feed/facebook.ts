import { cleanText, longestTextElement, splitCaption } from '../adapters/dom';
import { contentMedia, isSponsored, outermost, postId } from './dom';
import type { FeedAdapter, FeedItem } from './types';

const POST_LINK =
  /\/posts\/(\w+)|[?&]story_fbid=(\w+)|\/videos\/(\d+)|\/permalink\/(\d+)|\/reel\/(\d+)|[?&]fbid=(\d+)|\/photos\/[^/]+\/(\d+)/;
// FB menandai teks postingan dengan atribut ini; komentar tidak memilikinya.
const MESSAGE = '[data-ad-preview="message"], [data-ad-comet-preview="message"]';
const CAPTION_SELECTORS = 'div[dir="auto"], span[dir="auto"]';

/** Unit feed: [aria-posinset] di FB terbaru, anak langsung role=feed, atau role=article (struktur lama). */
function postRoots(doc: ParentNode): Element[] {
  const byPos = [...doc.querySelectorAll('[aria-posinset]')];
  if (byPos.length) return outermost(byPos);
  const feedChildren = [...doc.querySelectorAll('[role="feed"] > *')];
  if (feedChildren.length) return feedChildren;
  return outermost([...doc.querySelectorAll('[role="article"]')]);
}

function captionOf(root: Element): Element | null {
  const message = root.querySelector(MESSAGE);
  if (message) return message;
  // Tanpa penanda pesan: jangan ambil teks dari komentar bersarang.
  const comments = [...root.querySelectorAll('[role="article"]')];
  const el = longestTextElement(root, CAPTION_SELECTORS);
  return el && !comments.some((c) => c !== root && c.contains(el)) ? el : null;
}

export function parseFacebook(doc: ParentNode = document): FeedItem[] {
  const items: FeedItem[] = [];
  for (const root of postRoots(doc)) {
    if (isSponsored(root)) continue;
    const captionEl = captionOf(root);
    const { caption, hashtags } = splitCaption(cleanText(captionEl));
    const post = postId(root, POST_LINK, caption);
    if (!post) continue;
    items.push({ id: post.id, ...contentMedia(root), text: caption, hashtags, url: post.url, root, anchor: captionEl ?? root });
  }
  return items;
}

export const facebookFeed: FeedAdapter = {
  platform: 'facebook',
  matchesFeed: (loc) => /(^|\.)facebook\.com$/.test(loc.hostname) && (loc.pathname === '/' || loc.pathname === '/home.php'),
  findItems: () => parseFacebook(),
};

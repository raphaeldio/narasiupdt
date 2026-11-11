import { hashId, visibleRatio } from '../adapters/dom';
import type { FeedItemKind } from '../types';

const SPONSORED = /^(sponsored|bersponsor)$/i;

export function isSponsored(root: Element): boolean {
  for (const el of root.querySelectorAll('a, span')) {
    if (SPONSORED.test(el.textContent?.trim() ?? '')) return true;
  }
  return false;
}

/** ID dari tautan pertama di postingan yang cocok dengan pola (grup tangkap pertama yang terisi). */
export function firstLink(root: Element, pattern: RegExp): { id: string; url: string } | null {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    const id = href.match(pattern)?.slice(1).find(Boolean);
    if (id) return { id, url: new URL(href, location.origin).href };
  }
  return null;
}

const MIN_HASH_TEXT = 20;

/**
 * ID postingan: dari tautan permalink bila ada; bila platform menyembunyikan tautan (FB merender href asli
 * baru saat di-hover), pakai hash caption agar postingan yang sama tetap ber-ID sama antar-pemindaian.
 */
export function postId(root: Element, pattern: RegExp, text: string): { id: string; url: string } | null {
  const link = firstLink(root, pattern);
  if (link) return link;
  if (text.length < MIN_HASH_TEXT) return null;
  return { id: `t${hashId(text)}`, url: location.href };
}

/** Buang kandidat yang berada di dalam kandidat lain (mis. komentar di dalam postingan). */
export function outermost(candidates: Element[]): Element[] {
  const set = new Set(candidates);
  return candidates.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });
}

function contentImages(root: Element): HTMLImageElement[] {
  return [...root.querySelectorAll('img')].filter((img) => !img.closest('header') && !/profil/i.test(img.alt));
}

export function contentMedia(root: Element): { kind: FeedItemKind; media: Element | null } {
  const video = root.querySelector('video');
  if (video) return { kind: 'video', media: video };
  const img = contentImages(root)[0];
  return img ? { kind: 'image', media: img } : { kind: 'text', media: null };
}

/** Gambar konten yang paling terlihat (slide carousel yang sedang tampil). */
export function visibleImage(root: Element): HTMLImageElement | null {
  let best: HTMLImageElement | null = null;
  let bestArea = 0;
  for (const img of contentImages(root)) {
    const r = img.getBoundingClientRect();
    const area = visibleRatio(img) * r.width * r.height;
    if (area > bestArea) {
      best = img;
      bestArea = area;
    }
  }
  return best;
}

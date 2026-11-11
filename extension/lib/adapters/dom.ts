import type { CaptionInfo } from './types';

const MIN_VISIBLE = 0.6;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

export function visibleRatio(el: Element): number {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return 0;
  const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  return (w * h) / (r.width * r.height);
}

/** Video yang ≥60% terlihat; yang sedang diputar diutamakan (FR02). */
export function mostVisibleVideo(root: ParentNode = document): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let bestScore = 0;
  for (const video of root.querySelectorAll('video')) {
    const ratio = visibleRatio(video);
    if (ratio < MIN_VISIBLE) continue;
    const score = ratio + (video.paused ? 0 : 1);
    if (score > bestScore) {
      best = video;
      bestScore = score;
    }
  }
  return best;
}

export function videosInOrder(): HTMLVideoElement[] {
  return [...document.querySelectorAll('video')].filter((v) => v.getBoundingClientRect().height > 0);
}

export function nextVideoAfter(video: HTMLVideoElement): HTMLVideoElement | null {
  const all = videosInOrder();
  const i = all.indexOf(video);
  return i >= 0 ? (all[i + 1] ?? null) : null;
}

export function cleanText(el: Element | null | undefined): string {
  return ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function splitCaption(text: string): CaptionInfo {
  const hashtags = [...new Set(text.match(HASHTAG) ?? [])].map((t) => t.slice(1));
  return { caption: text.slice(0, 5000), hashtags: hashtags.slice(0, 50) };
}

/** Naik dari video sampai menemukan kontainer yang hanya berisi satu video (satu kartu konten). */
// Instagram Reels asli: caption baru ikut tercakup setelah naik ±16 tingkat dari <video> (dicek Nov 2026).
export function cardContainer(video: HTMLVideoElement, maxDepth = 24): Element {
  let node: Element = video;
  for (let i = 0; i < maxDepth && node.parentElement; i++) {
    const parent = node.parentElement;
    if (parent.querySelectorAll('video').length > 1 || parent === document.body) break;
    node = parent;
  }
  return node;
}

const BUTTON_TEXT_MAX = 40;
const UI_WORDS = /^(follow|ikuti|mengikuti|more|lainnya|selengkapnya|audio asli|original audio|suka|like|share|bagikan|komentar|comments?)$/i;

/** Elemen teks terpanjang di kartu yang tampak seperti caption (bukan tombol atau username). */
export function longestTextElement(container: Element, selectors: string): Element | null {
  let best: Element | null = null;
  let bestLength = 0;
  for (const el of container.querySelectorAll(selectors)) {
    if (el.closest('nav, header')) continue;
    // Tombol sungguhan berteks pendek ("Ikuti", "Suka"). Caption Instagram/Facebook dibungkus role="button"
    // (klik untuk "selengkapnya"), jadi pembungkus berteks panjang tidak boleh dilewati.
    const button = el.closest('button, [role="button"]');
    if (button && cleanText(button).length < BUTTON_TEXT_MAX) continue;
    const text = cleanText(el);
    if (text.length < 12 || UI_WORDS.test(text) || !text.includes(' ')) continue;
    if (text.length > bestLength) {
      best = el;
      bestLength = text.length;
    }
  }
  return best;
}

/**
 * ID cadangan bila platform mengubah struktur halaman dan ID asli tidak ketemu: tanpa ID, video sama sekali
 * tidak dianalisis. Dibuat dari poster/sumber video (bukan blob:, yang berganti tiap muat) dan caption.
 */
export function fallbackId(video: HTMLVideoElement, caption: string): string | null {
  const src = video.currentSrc && !video.currentSrc.startsWith('blob:') ? video.currentSrc.split('?')[0] : '';
  const seed = [video.poster.split('?')[0], src, caption.slice(0, 200)].filter(Boolean).join('|');
  return seed.length >= 12 ? `h${hashId(seed)}` : null;
}

/** Link pertama di kartu yang cocok dengan pola ID. */
export function idFromLinks(container: Element, selector: string, pattern: RegExp): string | null {
  for (const a of container.querySelectorAll<HTMLAnchorElement>(selector)) {
    const m = (a.getAttribute('href') ?? '').match(pattern);
    const id = m?.slice(1).find(Boolean);
    if (id) return id;
  }
  return null;
}

export function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

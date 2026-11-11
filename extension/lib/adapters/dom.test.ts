// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { cleanText, idFromLinks, longestTextElement } from './dom';

function el(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('longestTextElement', () => {
  it('membaca caption yang dibungkus role="button" (Instagram/Facebook Reels asli)', () => {
    const root = el(`
      <div role="button"><span dir="auto">Ikuti</span></div>
      <div role="button"><div dir="auto">ITB lahir 1920, tapi ulang tahunnya dihitung dari 1959. Kok bisa?</div></div>
      <button><span dir="auto">Suka kiriman ini ya</span></button>`);
    expect(cleanText(longestTextElement(root, 'span[dir="auto"], div[dir="auto"]'))).toContain('ITB lahir 1920');
  });

  it('tetap melewati tombol berteks pendek', () => {
    const root = el('<div role="button"><span dir="auto">Lihat terjemahan ini</span></div>');
    expect(longestTextElement(root, 'span[dir="auto"]')).toBeNull();
  });
});

describe('idFromLinks', () => {
  it('tidak menganggap tautan musik /reels/audio/ sebagai ID video', () => {
    const root = el('<a href="/reels/audio/123456789/">Audio</a><a href="/reel/DfZf7zju5TP/">Reel</a>');
    const pattern = /\/(?:reel|p|tv)\/([\w-]{5,})|\/reels\/(?!audio\/)([\w-]{5,})/;
    expect(idFromLinks(root, 'a[href*="/reel/"], a[href*="/reels/"]', pattern)).toBe('DfZf7zju5TP');
  });
});

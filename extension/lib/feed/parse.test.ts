// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { facebookFeed, parseFacebook } from './facebook';
import { instagramFeed, parseInstagram } from './instagram';

const loc = (url: string) => new URL(url) as unknown as Location;

describe('parseInstagram', () => {
  it('mengambil ID, jenis, caption; melewati iklan; tanpa tautan memakai hash caption', () => {
    document.body.innerHTML = `
      <article>
        <header><img alt="foto profil akun_a" src="a.jpg"><a href="/akun_a/">akun_a</a></header>
        <div><img alt="Foto oleh akun_a" src="x.jpg"></div>
        <a href="/p/IG01/">1 jam</a>
        <span dir="auto">BREAKING!! TNI akan menyerang Aceh pada 1 November 2026, mengungsi #aceh #tni</span>
      </article>
      <article><a href="/p/IG02/">2 jam</a><video></video>
        <span dir="auto">Video latihan perang di Natuna terjadi minggu lalu</span></article>
      <article><span>Sponsored</span><a href="/p/AD01/">x</a>
        <span dir="auto">Diskon besar akhir bulan untuk semua produk</span></article>
      <article><span dir="auto">Postingan tanpa tautan memakai ID dari hash caption</span></article>
      <article><a href="/p/IG03/">3 jam</a></article>
      <article><img alt="Foto" src="y.jpg"></article>`;
    const items = parseInstagram();
    expect(items.map((i) => i.kind)).toEqual(['image', 'video', 'text', 'text']);
    expect(items.map((i) => i.id)).toEqual(['IG01', 'IG02', expect.stringMatching(/^t[0-9a-z]+$/), 'IG03']);
    expect(items[0]!.text).toContain('TNI akan menyerang Aceh');
    expect(items[0]!.hashtags).toEqual(['aceh', 'tni']);
    expect(items[0]!.anchor.tagName).toBe('SPAN');
    expect(items[0]!.url).toBe('https://www.instagram.com/p/IG01/');
    expect(items[3]!.text).toBe('');
    expect(items[3]!.anchor).toBe(items[3]!.root);
  });
});

describe('parseFacebook', () => {
  it('hanya artikel tingkat atas, ID dari posts/story_fbid, melewati Bersponsor', () => {
    document.body.innerHTML = `
      <div role="feed">
        <div role="article"><a href="https://www.facebook.com/akun.b/posts/pfbid0ABC">3 j</a>
          <div dir="auto">Minum air rebusan daun sirsak bisa menyembuhkan kanker dalam 3 hari</div>
          <div role="article"><a href="/akun.c/posts/KOMEN1">1 j</a><div dir="auto">Komentar: ini hoaks bukan sih kak?</div></div>
        </div>
        <div role="article"><a href="/permalink.php?story_fbid=123456&id=7">x</a>
          <div dir="auto">Pendaftaran Bintara TNI AD 2026 dibuka gratis</div></div>
        <div role="article"><a href="/iklan">Bersponsor</a><a href="/akun.d/posts/AD"></a><div dir="auto">Promo besar hari ini</div></div>
      </div>`;
    const items = parseFacebook();
    expect(items.map((i) => [i.id, i.kind])).toEqual([['pfbid0ABC', 'text'], ['123456', 'text']]);
    expect(items[0]!.text).toContain('daun sirsak');
  });
});

describe('matchesFeed', () => {
  it('feed vs halaman video', () => {
    expect(instagramFeed.matchesFeed(loc('https://www.instagram.com/'))).toBe(true);
    expect(instagramFeed.matchesFeed(loc('https://www.instagram.com/p/IG01/'))).toBe(true);
    expect(instagramFeed.matchesFeed(loc('https://www.instagram.com/reels/IG01/'))).toBe(false);
    expect(facebookFeed.matchesFeed(loc('https://www.facebook.com/'))).toBe(true);
    expect(facebookFeed.matchesFeed(loc('https://www.facebook.com/reel/123'))).toBe(false);
  });
});

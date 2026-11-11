// Rekam bahan video iklan NARASI (../video, komposisi NarasiAd): penonton scroll YouTube Shorts asli dengan
// ekstensi terpasang, sementara dashboard Realtime direkam bersamaan di browser kedua. Kedua rekaman memakai
// jam dinding yang sama sehingga di video bisa disinkronkan: badge muncul di feed -> baris baru di dashboard.
// Butuh: build ekstensi (npm run build), backend mode langsung di :8000 (restart dulu biar cache kosong),
// dashboard di :5174.
//   RECORD_AD=1 PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/record-ad.spec.ts
// Hasil: ../video/public/rec/{feed,dashlive}.mp4 dan ../video/public/rec/ad.json.
import { chromium, expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const PROFILE = path.resolve(import.meta.dirname, '../.e2e-profile-ad');
const VIDEO_DIR = path.resolve(import.meta.dirname, '../../video');
const REC_DIR = path.join(VIDEO_DIR, 'public/rec');
const TMP = path.resolve(import.meta.dirname, '../test-results/rec-ad');
const FEED_URL = process.env.RECORD_FEED_URL ?? 'https://www.youtube.com/shorts/';
const HOAX_URL = process.env.RECORD_URL ?? 'https://www.youtube.com/shorts/DwvC_FjYxoU';
const DASH_URL = process.env.RECORD_DASH_URL ?? 'http://localhost:5174/';
const SCROLLS = Number(process.env.RECORD_SCROLLS ?? 4);
const FEED_VP = { width: 1280, height: 900 };
const DASH_VP = { width: 1600, height: 1400 };
const CHANNEL = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium');

test.skip(!process.env.RECORD_AD, 'set RECORD_AD=1 untuk merekam bahan iklan');

function toMp4(src: string, name: string) {
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-r', '30', '-g', '15', '-crf', '16', '-preset', 'veryfast', '-an', path.join(REC_DIR, name)], { cwd: VIDEO_DIR, shell: true, stdio: 'inherit' });
}

type Box = { x: number; y: number; w: number; h: number };
const toBox = (b: { x: number; y: number; width: number; height: number } | null): Box | null =>
  b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };

// Kursor palsu: video Playwright tidak merekam kursor sistem.
const CURSOR = `
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;z-index:2147483647;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;' +
      'background:rgba(255,255,255,.85);border:3px solid #111;pointer-events:none;transition:transform .12s;left:-100px;top:-100px';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.6)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
  });
`;

async function glideClick(page: Page, el: Locator) {
  await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(150);
  const b = await el.boundingBox({ timeout: 5000 });
  if (!b) throw new Error('elemen tidak terlihat');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}

// Badge milik video yang sedang diputar: yang terlihat dan paling dekat dengan tengah layar.
async function activeBadge(page: Page) {
  return page.evaluate(() => {
    const host = [...document.querySelectorAll('narasi-overlay')];
    const badges = host.flatMap((h) => [...(h.shadowRoot ?? h).querySelectorAll<HTMLElement>('.nr-badge')]);
    const vis = badges
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight);
    if (!vis.length) return null;
    vis.sort((a, z) => Math.abs(a.r.top - innerHeight * 0.85) - Math.abs(z.r.top - innerHeight * 0.85));
    const { b, r } = vis[0]!;
    return {
      text: b.innerText.trim(),
      loading: b.classList.contains('nr-badge--loading'),
      busy: !!b.querySelector('.nr-spinner'),
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  });
}

async function playerBox(page: Page) {
  return page.evaluate(() => {
    const v = [...document.querySelectorAll('video')].find((x) => !x.paused && x.getBoundingClientRect().height > 100)
      ?? [...document.querySelectorAll('video')].find((x) => x.getBoundingClientRect().height > 100);
    if (!v) return null;
    const r = v.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
}

test('rekam feed + dashboard realtime bersamaan', async () => {
  test.setTimeout(900_000);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(REC_DIR, { recursive: true });

  // 1. Dashboard dulu supaya sudah siap menerima peristiwa sebelum feed mulai.
  const dashBrowser = await chromium.launch({ channel: CHANNEL });
  const dashCtx = await dashBrowser.newContext({
    viewport: DASH_VP, recordVideo: { dir: path.join(TMP, 'dash'), size: DASH_VP }, locale: 'id-ID', colorScheme: 'dark',
  });
  await dashCtx.addInitScript(CURSOR);
  const dash = await dashCtx.newPage();
  const dashT0 = Date.now();
  await dash.goto(DASH_URL, { waitUntil: 'networkidle' });
  await expect(dash.getByText('Log langsung')).toBeVisible({ timeout: 15_000 });
  await dash.waitForTimeout(1500);
  const dashLayout = await dash.evaluate(() => {
    const box = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const title = [...document.querySelectorAll('[data-slot="card-title"], .text-base')].find((e) => e.textContent?.trim() === 'Log langsung');
    const logCard = title?.closest('[data-slot="card"]') ?? title?.parentElement?.parentElement?.parentElement;
    const kpi = document.querySelector('main [role="tabpanel"] > div > div');
    return { log: box(logCard), kpi: box(kpi), tabs: box(document.querySelector('[role="tablist"]')) };
  });

  // 2. Feed dengan ekstensi.
  const feedCtx = await chromium.launchPersistentContext(PROFILE, {
    channel: CHANNEL,
    headless: !process.env.HEADED,
    viewport: FEED_VP,
    locale: 'id-ID',
    recordVideo: { dir: path.join(TMP, 'feed'), size: FEED_VP },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const feed = feedCtx.pages()[0] ?? (await feedCtx.newPage());
  const feedT0 = Date.now();
  await feed.addInitScript(CURSOR);
  const fnow = () => (Date.now() - feedT0) / 1000;
  const dnow = () => (Date.now() - dashT0) / 1000;

  type Clip = { url: string; start: number; badge?: number; label?: number; final?: number; end?: number; first?: string; text?: string; box?: Box | null; player?: Box | null };
  const clips: Clip[] = [];
  const t: Record<string, number> = {};

  async function watchCurrent(clip: Clip, settleMs: number, maxMs: number, needSettle = true) {
    const start = Date.now();
    let quietSince = 0;
    while (Date.now() - start < maxMs) {
      const b = await activeBadge(feed).catch(() => null);
      if (b) {
        clip.badge ??= fnow();
        clip.box = b.box;
        if (!b.loading) {
          clip.label ??= fnow();
          clip.first ??= b.text;
          if (b.text !== clip.text) clip.text = b.text;
          if (!needSettle || !b.busy) {
            quietSince ||= Date.now();
            if (Date.now() - quietSince > settleMs) break;
          } else quietSince = 0;
        }
      }
      await feed.waitForTimeout(150);
    }
    clip.final = fnow();
  }

  try {
    await feed.goto(FEED_URL, { waitUntil: 'domcontentloaded' });
    const reject = feed.getByRole('button', { name: /Tolak semua|Reject all/i });
    if (await reject.isVisible({ timeout: 4000 }).catch(() => false)) await reject.click();
    await feed.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0), null, { timeout: 30_000 });
    await feed.mouse.move(FEED_VP.width / 2, FEED_VP.height / 2, { steps: 8 });

    // 3. Scroll beberapa Shorts acak: tiap video tunggu badge-nya, lalu geser ke bawah.
    for (let i = 0; i <= SCROLLS; i++) {
      const clip: Clip = { url: feed.url(), start: fnow(), player: await playerBox(feed) };
      clips.push(clip);
      await watchCurrent(clip, 1200, 30_000, false);
      await feed.waitForTimeout(700);
      clip.end = fnow();
      if (i < SCROLLS) {
        await feed.mouse.wheel(0, 700);
        await feed.waitForTimeout(1300);
      }
    }

    // 4. Kasus hoaks asli (dibagikan lewat tautan): label naik dari caption -> teks layar/suara.
    t.hoaxNav = fnow();
    await feed.goto(HOAX_URL, { waitUntil: 'domcontentloaded' });
    await feed.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0), null, { timeout: 30_000 });
    const hoax: Clip = { url: HOAX_URL, start: fnow(), player: await playerBox(feed) };
    await watchCurrent(hoax, 1500, 45_000);
    clips.push(hoax);
    await feed.waitForTimeout(600);

    // 5. Buka rincian lalu lapor ke TNI AD. Gagal di sini tidak membatalkan rekaman.
    let panelBox: Box | null = null;
    try {
      const badge = feed.locator('narasi-overlay .nr-badge').filter({ visible: true }).last();
      await glideClick(feed, badge);
      const panel = feed.locator('narasi-overlay .nr-panel');
      await expect(panel).toBeVisible();
      t.panelOpen = fnow();
      panelBox = toBox(await panel.boundingBox());
      await feed.waitForTimeout(1400);
      if (panelBox) {
        await feed.mouse.move(panelBox.x + panelBox.w / 2, panelBox.y + panelBox.h / 2, { steps: 10 });
        for (let i = 0; i < 6; i++) {
          await feed.mouse.wheel(0, 140);
          await feed.waitForTimeout(220);
        }
      }
      t.panelEnd = fnow();
      const open = feed.locator('narasi-overlay .nr-report__open');
      if (await open.isVisible().catch(() => false)) {
        await glideClick(feed, open);
        t.reportOpen = fnow();
        await feed.waitForTimeout(600);
        await glideClick(feed, feed.locator('narasi-overlay input[name="nr-reason"]').first());
        await feed.waitForTimeout(400);
        await glideClick(feed, feed.locator('narasi-overlay .nr-report__submit'));
        await expect(feed.locator('narasi-overlay .nr-report--sent')).toBeVisible({ timeout: 15_000 });
        t.reportSent = fnow();
      }
    } catch (e) {
      console.warn('panel/laporan gagal:', e);
      await feed.screenshot({ path: path.join(TMP, 'report-failed.png') }).catch(() => {});
    }
    await feed.waitForTimeout(2500);
    t.feedEnd = fnow();
    await feedCtx.close();

    // 6. Dashboard: biarkan peristiwa terakhir masuk, lalu jelajahi tab untuk showreel.
    await dash.waitForTimeout(1500);
    const tabs: { name: string; t: number }[] = [];
    for (const name of [/Rangkuman/, /Rekomendasi/, /Laporan/, /Realtime/]) {
      await glideClick(dash, dash.getByRole('tab', { name }));
      tabs.push({ name: String(name).replace(/\//g, ''), t: dnow() });
      await dash.waitForTimeout(1800);
      await dash.mouse.wheel(0, 380);
      await dash.waitForTimeout(1100);
      await dash.mouse.wheel(0, -380);
      await dash.waitForTimeout(500);
    }
    const dashEnd = dnow();
    await dashCtx.close();
    await dashBrowser.close();

    toMp4(await feed.video()!.path(), 'feed.mp4');
    toMp4(await dash.video()!.path(), 'dashlive.mp4');

    const out = {
      feed: { file: 'rec/feed.mp4', viewport: { w: FEED_VP.width, h: FEED_VP.height }, clips, t, panel: panelBox },
      dash: { file: 'rec/dashlive.mp4', viewport: { w: DASH_VP.width, h: DASH_VP.height }, layout: dashLayout, tabs, end: dashEnd },
      // Detik di rekaman feed = detik di rekaman dashboard - offset.
      offset: (feedT0 - dashT0) / 1000,
    };
    fs.writeFileSync(path.join(REC_DIR, 'ad.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 1));
  } finally {
    await feedCtx.close().catch(() => {});
    await dashCtx.close().catch(() => {});
    await dashBrowser.close().catch(() => {});
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
});

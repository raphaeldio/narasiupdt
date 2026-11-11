// Uji langsung di halaman publik platform (tanpa login), mis. TikTok For You. Opsional: butuh internet dan backend.
//   LIVE_URL=https://www.tiktok.com/foryou npx playwright test e2e/platform-live.spec.ts
// Halaman yang butuh login (Instagram, Facebook) tidak bisa diuji dengan cara ini.
import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const PROFILE = path.resolve(import.meta.dirname, '../.e2e-profile-live');
const URL = process.env.LIVE_URL ?? '';

test.skip(!URL, 'set LIVE_URL untuk menjalankan uji platform asli');

test('badge muncul di halaman platform asli', async () => {
  test.setTimeout(120_000);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: process.env.LIVE_HEADED !== '1',
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await context.newPage();
    // Caption dan ID yang benar-benar dikirim extension ke backend (permintaan dari service worker).
    context.on('request', (req) => {
      if (req.url().endsWith('/v1/analyze')) console.log('ANALYZE', (req.postData() ?? '').slice(0, 400));
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const state = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      videos: [...document.querySelectorAll('video')].map((v) => {
        const r = v.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), paused: v.paused, src: v.currentSrc.slice(0, 40) };
      }),
      overlay: Boolean(document.querySelector('narasi-overlay')),
      text: document.body.innerText.slice(0, 300),
    }));
    console.log(JSON.stringify(state, null, 1));
    fs.mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/platform-live.png' });

    const badge = page.locator('narasi-overlay .nr-badge');
    await expect(badge).toBeVisible({ timeout: 40_000 });
    await expect(badge).not.toHaveClass(/nr-badge--loading/, { timeout: 40_000 });
    const badgeText = await badge.innerText();
    await badge.click();
    const panel = page.locator('narasi-overlay .nr-panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(6000);
    console.log(JSON.stringify({ badgeText, panelText: (await panel.innerText()).slice(0, 700) }, null, 1));
    await page.screenshot({ path: 'test-results/platform-live-panel.png' });
  } finally {
    await context.close();
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
});

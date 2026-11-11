// Uji langsung di YouTube Shorts asli (opsional: butuh internet, backend mode langsung, dan memakai kuota API).
//   LIVE_YT=1 npx playwright test e2e/youtube-live.spec.ts
// Ganti video lewat LIVE_YT_URL bila video default tidak tersedia.
import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const PROFILE = path.resolve(import.meta.dirname, '../.e2e-profile-yt');
const URL = process.env.LIVE_YT_URL ?? 'https://www.youtube.com/shorts/uT8-OBvBdtc';

test.skip(!process.env.LIVE_YT, 'set LIVE_YT=1 untuk menjalankan uji YouTube Shorts asli');

test('badge dan panel muncul di YouTube Shorts asli', async () => {
  test.setTimeout(90_000);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    const badge = page.locator('narasi-overlay .nr-badge');
    await expect(badge).toBeVisible({ timeout: 30_000 });
    const firstText = await badge.innerText();
    const firstAt = Date.now() - started;

    // Hasil akhir: panel tidak lagi bertuliskan "masih menganalisis" (OCR dan audio sudah masuk).
    await badge.click();
    const panel = page.locator('narasi-overlay .nr-panel');
    await expect(panel).toBeVisible();
    await expect(panel).not.toContainText('masih menganalisis', { timeout: 45_000 });
    const finalText = await badge.innerText();
    const finalAt = Date.now() - started;
    const panelText = await panel.innerText();
    await page.screenshot({ path: 'test-results/youtube-live.png' });

    console.log(JSON.stringify({ url: URL, firstText, firstAt, finalText, finalAt, panelText }, null, 1));
  } finally {
    await context.close();
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
});

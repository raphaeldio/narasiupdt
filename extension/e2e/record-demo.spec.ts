// Rekam demo asli NARASI di YouTube Shorts + dashboard Mode Satuan untuk video Remotion (folder ../video).
// Butuh: build ekstensi biasa (npm run build), backend mode langsung di :8000, dashboard di :5174.
//   RECORD_DEMO=1 RECORD_URL=https://www.youtube.com/shorts/<id> npx playwright test e2e/record-demo.spec.ts
// Hasil: ../video/public/rec/{demo,dash}.mp4 dan ../video/src/rec.ts (timestamp tiap kejadian).
import { chromium, expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const PROFILE = path.resolve(import.meta.dirname, '../.e2e-profile-rec');
const VIDEO_DIR = path.resolve(import.meta.dirname, '../../video');
const REC_DIR = path.join(VIDEO_DIR, 'public/rec');
const TMP = path.resolve(import.meta.dirname, '../test-results/rec');
const URL = process.env.RECORD_URL ?? '';
const DASH_URL = process.env.RECORD_DASH_URL ?? 'http://localhost:5174/';
const VIEWPORT = { width: 1280, height: 900 };
const DASH_VIEWPORT = { width: 1500, height: 776 };

// WebM dari Playwright (VP8) jarang punya keyframe sehingga seek di Remotion lambat sampai timeout.
// Konversi ke H.264 dengan keyframe tiap 15 frame memakai ffmpeg bawaan Remotion (lokal di ../video).
function toMp4(webm: string, name: string) {
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-r', '30', '-g', '15', '-crf', '18', '-preset', 'veryfast', '-an', path.join(REC_DIR, name)], { cwd: VIDEO_DIR, shell: true, stdio: 'inherit' });
}

test.skip(!process.env.RECORD_DEMO || !URL, 'set RECORD_DEMO=1 dan RECORD_URL untuk merekam demo');
test.describe.configure({ mode: 'serial' });

type Box = { x: number; y: number; w: number; h: number };
const toBox = (b: { x: number; y: number; width: number; height: number } | null): Box | null =>
  b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };

// Kursor palsu: video Playwright tidak merekam kursor sistem, jadi klik dibuat kelihatan.
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
  // Elemen di dalam panel bisa tersembunyi di area scroll; gulir dulu supaya koordinatnya benar.
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const b = await el.boundingBox();
  if (!b) throw new Error('elemen tidak terlihat');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

test('rekam demo di YouTube Shorts asli', async () => {
  test.setTimeout(180_000);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: !process.env.HEADED,
    viewport: VIEWPORT,
    locale: 'id-ID',
    recordVideo: { dir: TMP, size: VIEWPORT },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  await page.addInitScript(CURSOR);

  const t: Record<string, number> = { feedStart: 0 };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    // Banner persetujuan cookie: pilih opsi paling privat bila muncul.
    const reject = page.getByRole('button', { name: /Tolak semua|Reject all/i });
    if (await reject.isVisible({ timeout: 3000 }).catch(() => false)) await reject.click();

    await page.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0), null, { timeout: 30_000 });
    t.videoStart = now();
    t.feedEnd = t.videoStart;
    const player = await page.evaluate(() => {
      const v = [...document.querySelectorAll('video')].find((x) => !x.paused) ?? document.querySelector('video')!;
      const r = v.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    const badge = page.locator('narasi-overlay .nr-badge');
    await expect(badge).toBeVisible({ timeout: 30_000 });
    t.badge = now();
    await expect(badge).not.toHaveClass(/nr-badge--loading/, { timeout: 45_000 });
    t.firstLabel = now();
    const firstText = await badge.innerText();
    const badgeBox = toBox(await badge.boundingBox());

    // Biarkan update teks layar + audio masuk sambil video tetap diputar: tunggu spinner kecil muncul lalu hilang.
    // Bila spinner tak pernah muncul (hasil langsung final, mis. dari cache), berhenti setelah 8 detik.
    const spinner = page.locator('narasi-overlay .nr-badge .nr-spinner');
    let sawSpinner = false;
    let quietSince = 0;
    const waitStart = Date.now();
    while (Date.now() - waitStart < 45_000) {
      const busy = await spinner.isVisible().catch(() => false);
      const text = await badge.innerText().catch(() => firstText);
      if (text !== firstText && t.labelChange === undefined) t.labelChange = now();
      if (busy) {
        sawSpinner = true;
        quietSince = 0;
      } else if (sawSpinner) {
        quietSince ||= Date.now();
        if (Date.now() - quietSince > 1200) break;
      } else if (Date.now() - waitStart > 8000) break;
      await page.waitForTimeout(200);
    }
    t.final = now();
    t.labelChange ??= t.firstLabel;
    const finalText = await badge.innerText();
    await page.waitForTimeout(800);

    await glideClick(page, badge);
    const panel = page.locator('narasi-overlay .nr-panel');
    await expect(panel).toBeVisible();
    t.panelOpen = now();
    await page.waitForTimeout(1800);
    const panelBox = toBox(await panel.boundingBox());
    const pb = await panel.boundingBox();
    if (pb) {
      await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 10 });
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 140);
        await page.waitForTimeout(260);
      }
    }
    await page.waitForTimeout(600);
    t.panelEnd = now();

    const open = page.locator('narasi-overlay .nr-report__open');
    if (await open.isVisible().catch(() => false)) {
      await open.scrollIntoViewIfNeeded();
      await glideClick(page, open);
      t.reportOpen = now();
      await page.waitForTimeout(700);
      await glideClick(page, page.locator('narasi-overlay input[name="nr-reason"]').first());
      await page.waitForTimeout(500);
      await glideClick(page, page.locator('narasi-overlay .nr-report__submit'));
      await expect(page.locator('narasi-overlay .nr-report--sent')).toBeVisible({ timeout: 15_000 }).catch(async (e) => {
        await page.screenshot({ path: path.join(TMP, 'report-failed.png') });
        throw e;
      });
      t.reportSent = now();
      await page.waitForTimeout(1500);
    } else {
      t.reportOpen = t.panelEnd;
      t.reportSent = t.panelEnd;
    }

    const title = (await page.title()).replace(/ - YouTube$/, '');
    await context.close();
    const raw = await page.video()!.path();
    fs.mkdirSync(REC_DIR, { recursive: true });
    toMp4(raw, 'demo.mp4');

    const demo = {
      file: 'rec/demo.mp4',
      url: URL,
      title,
      viewport: { w: VIEWPORT.width, h: VIEWPORT.height },
      player: toBox(player),
      badge: badgeBox,
      panel: panelBox,
      t,
      firstText,
      finalText,
    };
    fs.writeFileSync(path.join(REC_DIR, 'demo.json'), JSON.stringify(demo, null, 2));
    console.log(JSON.stringify(demo, null, 1));
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }
});

test('rekam dashboard Mode Satuan', async () => {
  test.setTimeout(60_000);
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium') });
  const context = await browser.newContext({
    viewport: DASH_VIEWPORT,
    recordVideo: { dir: TMP, size: DASH_VIEWPORT },
    locale: 'id-ID',
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  await page.goto(DASH_URL, { waitUntil: 'networkidle' });
  // Tanpa scroll: bagian atas (status siaga, KPI, narasi teratas) sudah memuat kasus yang baru direkam.
  await expect(page.locator('.narrative').first()).toBeVisible({ timeout: 15_000 });
  const start = now();
  const situation = toBox(await page.locator('.situation').boundingBox());
  const narrative = toBox(await page.locator('.narrative').first().boundingBox());
  const topClaim = await page.locator('.narrative__claim').first().innerText();
  await page.waitForTimeout(6500);
  const end = now();
  await context.close();
  await browser.close();
  toMp4(await page.video()!.path(), 'dash.mp4');
  const dash = {
    file: 'rec/dash.mp4',
    viewport: { w: DASH_VIEWPORT.width, h: DASH_VIEWPORT.height },
    situation,
    narrative,
    topClaim,
    t: { start, end },
  };
  fs.writeFileSync(path.join(REC_DIR, 'dash.json'), JSON.stringify(dash, null, 2));

  // Tulis metadata ke src/rec.ts supaya komposisi Remotion memakai rekaman ini.
  const demo = JSON.parse(fs.readFileSync(path.join(REC_DIR, 'demo.json'), 'utf8'));
  const recTs = path.join(VIDEO_DIR, 'src/rec.ts');
  const src = fs.readFileSync(recTs, 'utf8')
    .replace(/export const DEMO: DemoRec \| null = [\s\S]*?;\r?\n(?=export const DASH)/, `export const DEMO: DemoRec | null = ${JSON.stringify(demo, null, 2)};\n`)
    .replace(/export const DASH: DashRec \| null = [\s\S]*?;\s*$/, `export const DASH: DashRec | null = ${JSON.stringify(dash, null, 2)};\n`);
  fs.writeFileSync(recTs, src);
});

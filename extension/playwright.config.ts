import { defineConfig } from '@playwright/test';

// Browser Playwright (bila dipakai) disimpan di dalam node_modules project, bukan di folder global
// pengguna. Di Windows tes memakai Microsoft Edge yang sudah terpasang, jadi tidak perlu unduhan.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});

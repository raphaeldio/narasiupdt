// Menjalankan CLI Remotion lokal dengan TEMP/TMP di folder project (.tmp).
// Disk C: hampir penuh, sedangkan Chrome & Remotion menulis frame sementara ke %TEMP%.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tmp = path.resolve(import.meta.dirname, '../.tmp');
fs.mkdirSync(tmp, { recursive: true });
const r = spawnSync('npx', ['remotion', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp },
});
process.exit(r.status ?? 1);

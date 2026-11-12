// Render beberapa frame NarasiAd sekaligus (sekali bundle): node scripts/stills.mjs 20 160 425 ...
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'out/stills-ad');
fs.mkdirSync(out, { recursive: true });
const id = process.env.COMP ?? 'NarasiAd';
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });
const composition = await selectComposition({ serveUrl, id });
for (const f of process.argv.slice(2).map(Number)) {
  await renderStill({ serveUrl, composition, frame: f, output: path.join(out, `${f}.jpg`), imageFormat: 'jpeg', jpegQuality: 70, scale: 0.5 });
  console.log('still', f);
}

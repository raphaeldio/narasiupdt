import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    // Hanya berkas berkomentar `@vitest-environment happy-dom` yang memakai DOM.
    environmentOptions: { happyDOM: { url: 'https://www.instagram.com/' } },
  },
});

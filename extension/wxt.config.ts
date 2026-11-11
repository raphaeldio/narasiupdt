import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Paket juri dibangun ke folder terpisah agar build lokal (.output, ikut di-commit) tidak tertimpa.
  outDir: process.env.WXT_OUT_DIR ?? '.output',
  manifest: {
    name: 'NARASI — Cek Hoaks Video Pendek',
    description:
      'Cek hoaks berbasis bukti untuk Instagram Reels, TikTok, YouTube Shorts, dan Facebook Reels (semua topik, termasuk konten berbahasa asing).',
    permissions: ['storage'],
    host_permissions: [
      '*://*.instagram.com/*',
      '*://*.tiktok.com/*',
      '*://*.youtube.com/*',
      '*://*.facebook.com/*',
      // Backend NARASI; tambahkan domain produksi di sini saat deploy.
      'http://localhost:8000/*',
      'http://127.0.0.1:8000/*',
    ],
    action: { default_title: 'NARASI' },
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // Server satuan: WXT_BACKEND_URL=http://10.1.2.3 npm run build -> alamat itu ikut diizinkan.
      const backend = process.env.WXT_BACKEND_URL;
      if (backend) manifest.host_permissions?.push(`${new URL(backend).origin}/*`);
    },
  },
});

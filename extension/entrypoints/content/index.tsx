import ReactDOM from 'react-dom/client';
import { Boundary } from '@/components/Boundary';
import { FeedBadges } from '@/components/FeedBadges';
import { Overlay } from '@/components/Overlay';
import '@/components/overlay.css';
import { adapterFor } from '@/lib/adapters';
import { Controller } from '@/lib/controller';
import { feedAdapterFor } from '@/lib/feed';
import { FeedScanner } from '@/lib/feed/scanner';
import { useOverlay } from '@/lib/store';

// Penanda versi di elemen host: memastikan browser benar-benar menjalankan build terbaru.
const BUILD = '2026-11-10.4';

function Root() {
  const resetKey = useOverlay((s) => `${s.key}:${s.status}:${s.result?.label ?? ''}:${s.panelOpen}`);
  return (
    <>
      {/* Chip feed dirender lebih dulu agar badge dan panel aktif selalu di atasnya. */}
      <Boundary resetKey="feed"><FeedBadges /></Boundary>
      <Boundary resetKey={resetKey}><Overlay /></Boundary>
    </>
  );
}

// Hanya domain platform video pendek (PRD 6.1). Halaman uji localhost ditambahkan lewat
// wxt.config.ts khusus build pengembangan/demo.
export const PLATFORM_MATCHES = [
  '*://*.instagram.com/*',
  '*://*.tiktok.com/*',
  '*://*.youtube.com/*',
  '*://*.facebook.com/*',
];

// Event dari overlay tidak boleh sampai ke halaman (mis. klik badge menjeda video,
// atau spasi di panel memicu shortcut YouTube).
const ISOLATED_EVENTS = ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'keydown', 'keyup', 'wheel'];

export default defineContentScript({
  matches: PLATFORM_MATCHES,
  cssInjectionMode: 'ui',
  runAt: 'document_idle',

  async main(ctx) {
    if (!adapterFor(location) && !feedAdapterFor(location)) return;

    const ui = await createShadowRootUi(ctx, {
      name: 'narasi-overlay',
      position: 'inline',
      anchor: 'body',
      onMount(container, _shadow, host) {
        for (const type of ISOLATED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());
        const root = ReactDOM.createRoot(container);
        host.dataset.narasiBuild = BUILD;
        root.render(<Root />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();

    // Reels/Shorts → Controller (satu video aktif); beranda/feed → FeedScanner (banyak chip).
    // IG dan FB adalah SPA: mode dipilih ulang setiap kali URL berubah.
    let current: { destroy(): void } | null = null;
    let route: 'feed' | 'video' | null = null;
    const pick = async () => {
      const feed = feedAdapterFor(location);
      const video = feed ? null : adapterFor(location);
      const next = feed ? 'feed' : video ? 'video' : null;
      if (next === route) return;
      current?.destroy();
      route = next;
      const instance = feed ? new FeedScanner(feed) : video ? new Controller(video) : null;
      current = instance;
      await instance?.start();
      if (current !== instance) instance?.destroy(); // URL berganti lagi selama start()
    };
    await pick();
    ctx.addEventListener(window, 'wxt:locationchange', () => void pick());
    ctx.onInvalidated(() => current?.destroy());
  },
});

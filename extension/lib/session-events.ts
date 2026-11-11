import type { BackgroundMessage } from './messages';
import { useOverlay } from './store';

/** Terapkan event SSE dari background ke overlay bila milik sesi yang sedang aktif. */
export function applySessionEvent(raw: unknown, activeKey: string | null | undefined): BackgroundMessage | null {
  const msg = raw as BackgroundMessage;
  if (msg?.type !== 'analyze:event' || !activeKey || msg.key !== activeKey) return null;
  const overlay = useOverlay.getState();
  if (overlay.key !== msg.key) return null;
  switch (msg.event) {
    case 'stage': overlay.stage(msg.data); break;
    case 'result': overlay.setResult(msg.data); break;
    case 'error': overlay.fail(msg.data.message); break;
    case 'done': overlay.done(); break;
  }
  return msg;
}

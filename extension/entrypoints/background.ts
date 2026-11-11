import type { BackgroundMessage, ContentMessage, HealthResponse, ScanResponse, StartResponse } from '@/lib/messages';
import { backendUrlItem, installIdItem } from '@/lib/settings';
import { readSse } from '@/lib/sse';

interface TabSession {
  key: string;
  sessionId: string | null;
  controller: AbortController;
}

const REQUEST_TIMEOUT_MS = 8000;
const SCAN_TIMEOUT_MS = 5000;

export default defineBackground(() => {
  // Satu sesi per tab: ganti video membatalkan sesi lama (FR02, FR11).
  const sessions = new Map<number, TabSession>();

  async function api(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<Response> {
    const base = (await backendUrlItem.getValue()).replace(/\/+$/, '');
    const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
    if (init.signal) signals.push(init.signal);
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: AbortSignal.any(signals),
      headers: {
        'Content-Type': 'application/json',
        'X-Narasi-Install': await installIdItem.getValue(),
        ...init.headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  function post(path: string, body: unknown, signal?: AbortSignal) {
    return api(path, { method: 'POST', body: JSON.stringify(body), signal });
  }

  function send(tabId: number, message: BackgroundMessage) {
    browser.tabs.sendMessage(tabId, message).catch(() => {
      // Tab ditutup atau berpindah halaman: hentikan sesi.
      cancel(tabId);
    });
  }

  function cancel(tabId: number, key?: string) {
    const current = sessions.get(tabId);
    if (!current || (key && current.key !== key)) return;
    current.controller.abort();
    sessions.delete(tabId);
  }

  async function stream(tabId: number, session: TabSession) {
    const base = (await backendUrlItem.getValue()).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/v1/analyze/${session.sessionId}/events`, {
        signal: session.controller.signal,
        headers: { Accept: 'text/event-stream' },
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      for await (const msg of readSse(res.body)) {
        if (sessions.get(tabId) !== session) return;
        send(tabId, { type: 'analyze:event', key: session.key, event: msg.event, data: JSON.parse(msg.data) } as BackgroundMessage);
      }
    } catch (err) {
      if (session.controller.signal.aborted) return;
      send(tabId, { type: 'analyze:event', key: session.key, event: 'error', data: { message: String(err) } });
    } finally {
      if (sessions.get(tabId) === session) sessions.delete(tabId);
    }
  }

  async function start(tabId: number, msg: Extract<ContentMessage, { type: 'analyze:start' }>): Promise<StartResponse> {
    cancel(tabId);
    const session: TabSession = { key: msg.key, sessionId: null, controller: new AbortController() };
    sessions.set(tabId, session);
    try {
      const res = await post('/v1/analyze', msg.payload, session.controller.signal);
      const body = await res.json();
      if (body.cached) {
        sessions.delete(tabId);
        return { ok: true, cached: true, result: body.result };
      }
      session.sessionId = body.session_id;
      void stream(tabId, session);
      return { ok: true, cached: false, sessionId: body.session_id, accepts: body.accepts ?? { frames: true, audio: true } };
    } catch (err) {
      if (sessions.get(tabId) === session) sessions.delete(tabId);
      return { ok: false, error: String(err) };
    }
  }

  function forward(tabId: number, key: string, path: string, body: unknown) {
    const session = sessions.get(tabId);
    if (!session || session.key !== key || !session.sessionId) return;
    post(`/v1/analyze/${session.sessionId}/${path}`, body, session.controller.signal).catch(() => {});
  }

  async function captureTab(windowId: number): Promise<string | null> {
    try {
      return await browser.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 });
    } catch {
      return null;
    }
  }

  async function health(): Promise<HealthResponse> {
    try {
      return { ok: true, health: await (await api('/health')).json() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as ContentMessage;
    const tabId = sender.tab?.id;

    if (msg.type === 'health') {
      health().then(sendResponse);
      return true;
    }
    if (tabId === undefined) return;

    switch (msg.type) {
      case 'analyze:start':
        start(tabId, msg).then(sendResponse);
        return true;
      case 'analyze:frames':
        forward(tabId, msg.key, 'frames', { frames: msg.frames });
        return;
      case 'analyze:audio':
        forward(tabId, msg.key, 'audio', { chunk: msg.chunk, index: msg.index });
        return;
      case 'analyze:complete':
        forward(tabId, msg.key, 'complete', {});
        return;
      case 'analyze:cancel':
        cancel(tabId, msg.key);
        return;
      case 'prefetch':
        post('/v1/prefetch', { platform: msg.platform, video_id: msg.videoId, caption: msg.caption }).catch(() => {});
        return;
      case 'feedback':
        post('/v1/feedback', { platform: msg.platform, video_id: msg.videoId, claim_id: msg.claimId })
          .then(() => sendResponse(true))
          .catch(() => sendResponse(false));
        return true;
      case 'report':
        post('/v1/reports', {
          platform: msg.platform, video_id: msg.videoId, url: msg.url, reason: msg.reason, note: msg.note,
          result: msg.result,
        })
          .then(() => sendResponse(true))
          .catch(() => sendResponse(false));
        return true;
      case 'feed:scan':
        post('/v1/scan', { platform: msg.platform, items: msg.items }, AbortSignal.timeout(SCAN_TIMEOUT_MS))
          .then(async (res) => sendResponse({ ok: true, results: (await res.json()).results } satisfies ScanResponse))
          .catch((err) => sendResponse({ ok: false, error: String(err) } satisfies ScanResponse));
        return true;
      case 'capture:tab':
        captureTab(sender.tab!.windowId).then(sendResponse);
        return true;
      case 'status':
        // Ikon menandai NARASI aktif di tab ini (FR01).
        browser.action.setBadgeText({ tabId, text: msg.active ? 'ON' : '' });
        browser.action.setBadgeBackgroundColor({ tabId, color: '#30A46C' });
        return;
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => cancel(tabId));
});

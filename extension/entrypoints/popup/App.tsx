import { useEffect, useState } from 'react';
import type { HealthResponse } from '@/lib/messages';
import {
  backendUrlItem, enabledItem, feedEnabledItem, modeItem, PLATFORM_LABELS, platformsItem, type PlatformToggles,
} from '@/lib/settings';
import type { Mode, Platform } from '@/lib/types';

const VISIBLE_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'facebook'];
const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Klaim, OCR & kesimpulan (Gemini)',
  groq: 'Audio ke teks (Groq Whisper)',
  factcheck: 'Google Fact Check',
  tavily: 'Pencarian situs terpercaya',
  feeds: 'Indeks pemeriksa fakta (Mafindo, Snopes, dll)',
  news: 'Google News (media terverifikasi)',
};

interface Item<T> {
  getValue(): Promise<T>;
  setValue(v: T): Promise<void>;
  watch(cb: (v: T) => void): () => void;
}

function useItem<T>(item: Item<T>) {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return [value, (v: T) => item.setValue(v)] as const;
}

export default function App() {
  const [enabled, setEnabled] = useItem(enabledItem);
  const [platforms, setPlatforms] = useItem<PlatformToggles>(platformsItem);
  const [mode, setMode] = useItem<Mode>(modeItem);
  const [feedEnabled, setFeedEnabled] = useItem(feedEnabledItem);
  const [backendUrl, setBackendUrl] = useItem(backendUrlItem);
  const [urlDraft, setUrlDraft] = useState('');
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    if (backendUrl !== null) setUrlDraft(backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    if (backendUrl === null) return;
    setHealth(null);
    browser.runtime
      .sendMessage({ type: 'health' })
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, error: String(e) }));
  }, [backendUrl]);

  if (enabled === null || platforms === null || mode === null || feedEnabled === null) return null;

  return (
    <main className="popup">
      <header className="popup__head">
        <div className="popup__brand">
          <img src="/icon/48.png" alt="" width={36} height={36} />
          <div>
            <h1>NARASI</h1>
            <p>Cek hoaks video pendek berbasis bukti</p>
          </div>
        </div>
        <label className="switch" title={enabled ? 'Matikan NARASI' : 'Aktifkan NARASI'}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span aria-hidden />
          <span className="sr-only">NARASI aktif</span>
        </label>
      </header>

      <section className={enabled ? '' : 'is-disabled'}>
        <h2>Platform</h2>
        {VISIBLE_PLATFORMS.map((p) => (
          <label key={p} className="row">
            <span>{PLATFORM_LABELS[p]}</span>
            <input
              type="checkbox"
              disabled={!enabled}
              checked={platforms[p]}
              onChange={(e) => setPlatforms({ ...platforms, [p]: e.target.checked })}
            />
          </label>
        ))}
        <label className="row">
          <span>
            Scan feed
            <small>Beri label setiap postingan di beranda Instagram & Facebook</small>
          </span>
          <input type="checkbox" disabled={!enabled} checked={feedEnabled} onChange={(e) => setFeedEnabled(e.target.checked)} />
        </label>
      </section>

      <section className={enabled ? '' : 'is-disabled'}>
        <h2>Analisis</h2>
        <label className="row">
          <span>
            Multimodal
            <small>Caption, teks di layar (3 frame), dan 15 detik audio</small>
          </span>
          <input type="radio" name="mode" disabled={!enabled} checked={mode === 'multimodal'} onChange={() => setMode('multimodal')} />
        </label>
        <label className="row">
          <span>
            Caption saja
            <small>Frame dan audio tidak dikirim</small>
          </span>
          <input type="radio" name="mode" disabled={!enabled} checked={mode === 'caption'} onChange={() => setMode('caption')} />
        </label>
      </section>

      <section>
        <h2>Server</h2>
        <form
          className="server"
          onSubmit={(e) => {
            e.preventDefault();
            setBackendUrl(urlDraft.trim());
          }}
        >
          <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} aria-label="Alamat backend" spellCheck={false} />
          <button type="submit" disabled={urlDraft.trim() === backendUrl}>Simpan</button>
        </form>
        <Status health={health} />
      </section>

      <footer>
        Yang dikirim hanya konten publik video atau postingan yang sedang tampil. Akun, cookie, DM, dan riwayat tidak pernah
        dikirim; frame dan audio dihapus setelah diproses.
      </footer>
    </main>
  );
}

function Status({ health }: { health: HealthResponse | null }) {
  if (!health) return <p className="status">Memeriksa server…</p>;
  if (!health.ok) return <p className="status status--down">Server tidak terhubung</p>;
  const { mode, providers } = health.health;
  return (
    <div className="status">
      <p className="status--up">Terhubung · mode {mode === 'live' ? 'langsung' : 'lokal (korpus terkurasi)'}</p>
      <ul>
        {Object.entries(PROVIDER_LABELS).map(([k, label]) => (
          <li key={k} className={providers[k] ? 'on' : 'off'}>{label}</li>
        ))}
      </ul>
    </div>
  );
}

import { useState } from 'react';
import type { ContentMessage } from '@/lib/messages';
import type { AnalysisResult, Platform, ReportReason } from '@/lib/types';

const REASONS: { value: ReportReason; text: string }[] = [
  { value: 'mencatut_tni', text: 'Mencatut nama TNI / pejabat TNI' },
  { value: 'provokasi', text: 'Provokasi atau ajakan kekerasan' },
  { value: 'hoaks', text: 'Hoaks lain yang perlu diklarifikasi' },
  { value: 'lainnya', text: 'Lainnya' },
];

type State = 'closed' | 'open' | 'sending' | 'sent' | 'failed';

/** Laporan ke Penerangan TNI AD (FR18). Anonim: yang dikirim hanya tautan video dan hasil analisis. */
export function ReportForm({ platform, videoId, result }: { platform: Platform; videoId: string; result: AnalysisResult }) {
  const [state, setState] = useState<State>('closed');
  const [reason, setReason] = useState<ReportReason>(result.tni_related ? 'mencatut_tni' : 'hoaks');
  const [note, setNote] = useState('');

  if (state === 'sent') {
    return (
      <section className="nr-report nr-report--sent" role="status">
        Laporan terkirim ke dashboard petugas Penerangan TNI AD. Identitas kamu tidak ikut dikirim.
      </section>
    );
  }

  if (state === 'closed') {
    return (
      <section className="nr-report">
        <button className="nr-report__open" onClick={() => setState('open')}>
          Laporkan ke TNI AD
        </button>
        <span className="nr-report__hint">Bantu petugas mengklarifikasi sebelum konten ini viral.</span>
      </section>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const msg: ContentMessage = {
      type: 'report', platform, videoId, url: location.href, reason, note: note.trim(), result,
    };
    const ok = await browser.runtime.sendMessage(msg).catch(() => false);
    setState(ok ? 'sent' : 'failed');
  }

  return (
    <form className="nr-report nr-report--form" onSubmit={submit}>
      <h3>Laporkan ke TNI AD</h3>
      <fieldset>
        <legend className="nr-sr">Alasan laporan</legend>
        {REASONS.map((r) => (
          <label key={r.value}>
            <input type="radio" name="nr-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
            {r.text}
          </label>
        ))}
      </fieldset>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Catatan (opsional), mis. sudah beredar di grup WhatsApp"
        aria-label="Catatan laporan"
      />
      <p className="nr-report__hint">
        Dikirim: tautan video publik, hasil analisis, dan catatanmu. Akun dan identitasmu tidak dikirim.
      </p>
      <div className="nr-report__actions">
        <button type="button" className="nr-link" onClick={() => setState('closed')}>Batal</button>
        <button type="submit" className="nr-report__submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Mengirim…' : state === 'failed' ? 'Gagal, coba lagi' : 'Kirim laporan'}
        </button>
      </div>
    </form>
  );
}

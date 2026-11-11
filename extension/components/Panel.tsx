import { forwardRef, useState } from 'react';
import type { ContentMessage } from '@/lib/messages';
import { useOverlay } from '@/lib/store';
import { BASIS_TEXT, LABELS, LANGUAGE_TEXT, MODALITY_TEXT, TOPIC_TEXT, verdictColor } from './labels';
import { ReportForm } from './ReportForm';

const CONFIDENCE = { high: 'Keyakinan tinggi', medium: 'Keyakinan sedang', low: 'Peringatan awal, belum ada bukti' } as const;

export const Panel = forwardRef<HTMLDivElement, { style: React.CSSProperties }>(function Panel({ style }, ref) {
  const { result, platform, videoId, togglePanel, status, notes } = useOverlay();
  const [reported, setReported] = useState<'idle' | 'sent' | 'failed'>('idle');
  if (!result) return null;

  const label = LABELS[result.label] ?? LABELS.unverified;
  const claims = result.claims.filter((c) => c.kind !== 'opinion');
  const allNotes = [...result.notes, ...notes.filter((n) => !result.notes.includes(n))];
  const topics = (result.topics ?? []).filter((t) => TOPIC_TEXT[t]);
  const foreign = result.language && result.language !== 'id' ? LANGUAGE_TEXT[result.language] ?? result.language : null;
  const basis = result.basis && result.basis !== 'evidence' ? BASIS_TEXT[result.basis] : '';
  const signals = result.risk?.signals ?? [];

  async function report() {
    const msg: ContentMessage = {
      type: 'feedback', platform: platform!, videoId: videoId!, claimId: result!.claims[0]?.id ?? null,
    };
    const ok = await browser.runtime.sendMessage(msg).catch(() => false);
    setReported(ok ? 'sent' : 'failed');
  }

  return (
    <div ref={ref} className="nr-panel" role="dialog" aria-label="Bukti dan kesimpulan NARASI" style={style}>
      <header className="nr-panel__head" style={{ '--nr-color': label.color } as React.CSSProperties}>
        <div>
          <div className="nr-panel__verdict">
            {label.showScore && result.score !== null && <strong>{result.score}%</strong>} {label.text}
          </div>
          <div className="nr-panel__meta">
            {basis || (result.confidence && CONFIDENCE[result.confidence])}
            {result.cached && ' · dari cache'}
            {status === 'partial' && ' · masih menganalisis'}
          </div>
        </div>
        <button className="nr-close" onClick={() => togglePanel(false)} aria-label="Tutup panel">×</button>
      </header>

      <div className="nr-panel__body">
        {(topics.length > 0 || foreign) && (
          <div className="nr-tags">
            {topics.map((t) => <span key={t} className="nr-chip">{TOPIC_TEXT[t]}</span>)}
            {foreign && <span className="nr-chip">Bahasa {foreign}</span>}
          </div>
        )}

        {claims.length > 0 && (
          <section>
            <h3>Klaim terdeteksi</h3>
            <ul className="nr-claims">
              {claims.map((c) => (
                <li key={c.id}>
                  <span className="nr-chip">{MODALITY_TEXT[c.source]}</span>
                  {c.kind === 'satire' && <span className="nr-chip">Satire</span>}
                  {c.tni_related && <span className="nr-chip nr-chip--tni">TNI</span>}
                  <span>{c.text}</span>
                  {c.original && <span className="nr-original">Asli: {c.original}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.evidence.length > 0 && (
          <section>
            <h3>Sumber</h3>
            <ol className="nr-sources">
              {result.evidence.map((e, i) => (
                <li key={e.url + i}>
                  <span className="nr-sources__n">[{i + 1}]</span>
                  <div>
                    <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a>
                    <div className="nr-sources__meta">
                      <span className="nr-rating" style={{ '--nr-color': verdictColor(e.verdict) } as React.CSSProperties}>
                        {e.rating}
                      </span>
                      <span>{e.publisher}</span>
                      {e.date && <span>{e.date}</span>}
                      <span>kecocokan {Math.round(e.match * 100)}%</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {result.conclusion && (
          <section>
            <h3>Kesimpulan</h3>
            <p className="nr-conclusion">{result.conclusion}</p>
          </section>
        )}

        {signals.length > 0 && result.label !== 'neutral' && (
          <section>
            <h3>Pola bahasa yang perlu dicurigai</h3>
            <ul className="nr-signals">
              {signals.map((s) => (
                <li key={s.id}>
                  {s.label}
                  {s.hits.length > 0 && <span> — “{s.hits.slice(0, 2).join('”, “')}”</span>}
                </li>
              ))}
            </ul>
            <p className="nr-signals__hint">Ini ciri penulisan, bukan bukti isinya salah.</p>
          </section>
        )}

        {(result.tni_related || result.label === 'hoax' || result.label === 'caution') && (
          <ReportForm platform={platform!} videoId={videoId!} result={result} />
        )}

        {allNotes.length > 0 && (
          <ul className="nr-notes">
            {allNotes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
      </div>

      <footer className="nr-panel__foot">
        <span>Indeks dihitung dari bukti, bukan vonis mutlak.</span>
        <button className="nr-link" onClick={report} disabled={reported !== 'idle'}>
          {reported === 'sent' ? 'Terima kasih' : reported === 'failed' ? 'Gagal mengirim' : 'Laporkan tidak relevan'}
        </button>
      </footer>
    </div>
  );
});

import { forwardRef } from 'react';
import { activeStage, useOverlay } from '@/lib/store';
import { LABELS, STAGE_TEXT } from './labels';

export const Badge = forwardRef<HTMLButtonElement>(function Badge(_, ref) {
  const { status, stages, result, panelOpen, togglePanel, retry } = useOverlay();
  const stage = activeStage(stages);

  if (status === 'loading' || (status !== 'error' && !result)) {
    return (
      <button ref={ref} className="nr-badge nr-badge--loading" aria-busy="true" tabIndex={-1}>
        <span className="nr-spinner" aria-hidden />
        <span>{STAGE_TEXT[stage ?? 'caption']}</span>
      </button>
    );
  }

  if (status === 'error' || !result) {
    return (
      <button ref={ref} className="nr-badge" style={{ '--nr-color': LABELS.error.color } as React.CSSProperties}
        onClick={() => retry?.()} title="Coba periksa lagi">
        <span className="nr-dot" aria-hidden />
        <span>{LABELS.error.text}</span>
        <span className="nr-badge__retry">Coba lagi</span>
      </button>
    );
  }

  // Label yang belum dikenal build ini (backend lebih baru) tidak boleh membuat tampilan gagal.
  const label = LABELS[result.label] ?? LABELS.unverified;
  const updating = status === 'partial' && stage !== null;
  const mencatut = result.tni_related && (result.label === 'hoax' || result.label === 'caution');
  return (
    <button
      ref={ref}
      className="nr-badge"
      style={{ '--nr-color': label.color } as React.CSSProperties}
      aria-expanded={panelOpen}
      aria-label={`NARASI: ${label.text}${label.showScore && result.score !== null ? ` ${result.score}%` : ''}. Klik untuk melihat bukti.`}
      onClick={() => togglePanel()}
    >
      <span className="nr-dot" aria-hidden />
      {label.showScore && result.score !== null && <strong className="nr-badge__score">{result.score}%</strong>}
      <span>{label.text}</span>
      {mencatut && <span className="nr-tag">Mencatut TNI</span>}
      {updating && <span className="nr-spinner nr-spinner--small" title={STAGE_TEXT[stage]} aria-hidden />}
    </button>
  );
});

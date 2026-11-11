import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { Alert, Report, ReportStatus, Summary } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LABEL_COLOR, LABEL_TEXT, LEVEL_COLOR, LEVEL_TEXT, PLATFORM_TEXT, REASON_TEXT, TOPIC_TEXT, ago, number,
} from '@/format';

const STATUS_ORDER: ReportStatus[] = ['baru', 'ditinjau', 'ditindaklanjuti', 'ditutup'];
const STATUS_TEXT: Record<ReportStatus, string> = {
  baru: 'Baru', ditinjau: 'Ditinjau', ditindaklanjuti: 'Ditindaklanjuti', ditutup: 'Ditutup',
};

export function Laporan({ summary, reports, alerts, onUpdate }: {
  summary: Summary;
  reports: Report[] | null;
  alerts: Alert[] | null;
  onUpdate: (id: string, status: ReportStatus, note: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<ReportStatus | 'terbuka'>('terbuka');
  const shown = (reports ?? []).filter((r) => (filter === 'terbuka' ? r.status === 'baru' || r.status === 'ditinjau' : r.status === filter));

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATUS_ORDER.map((k) => (
          <div key={k} className="rounded-xl border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{STATUS_TEXT[k]}</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">{number.format(summary.reports.by_status[k] ?? 0)}</dd>
          </div>
        ))}
      </dl>

      <Card className="gap-3 py-5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Laporan pengguna</CardTitle>
            <CardDescription>Dikirim dari tombol “Laporkan” di extension. Identitas pelapor tidak disimpan.</CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-44" aria-label="Saring status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="terbuka">Belum selesai</SelectItem>
              {STATUS_ORDER.map((k) => <SelectItem key={k} value={k}>{STATUS_TEXT[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!reports ? <p className="text-sm text-muted-foreground">Memuat laporan…</p>
            : shown.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada laporan di saringan ini.</p>
            : <ul className="grid gap-2">{shown.map((r) => <ReportRow key={r.id} r={r} onUpdate={onUpdate} />)}</ul>}
        </CardContent>
      </Card>

      <Card className="gap-3 py-5">
        <CardHeader>
          <CardTitle className="text-base">Rincian per konten</CardTitle>
          <CardDescription>Semua konten bermasalah atau dilaporkan, urut prioritas.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!alerts ? <p className="text-sm text-muted-foreground">Memuat…</p>
            : alerts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Belum ada konten yang ditandai.</p>
            : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">Prioritas</th>
                    <th className="py-2 pr-3 font-medium">Klaim</th>
                    <th className="py-2 pr-3 font-medium">Label</th>
                    <th className="py-2 pr-3 font-medium">Topik</th>
                    <th className="py-2 pr-3 font-medium">Platform</th>
                    <th className="py-2 pr-3 text-right font-medium">Penonton/jam</th>
                    <th className="py-2 text-right font-medium">Laporan</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.video_key} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[a.level] }} />{LEVEL_TEXT[a.level]}
                        </span>
                      </td>
                      <td className="max-w-[340px] py-2 pr-3">
                        {a.url ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 hover:text-primary">
                            <span className="line-clamp-2">{a.claim ?? 'Klaim belum terdeteksi'}</span>
                            <ExternalLink className="mt-0.5 size-3 shrink-0" />
                          </a>
                        ) : <span className="line-clamp-2">{a.claim ?? 'Klaim belum terdeteksi'}</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[a.label] }} />
                          {LABEL_TEXT[a.label]}{a.score != null && ` ${a.score}%`}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{TOPIC_TEXT[a.topic] ?? a.topic}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{PLATFORM_TEXT[a.platform] ?? a.platform}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{number.format(a.viewers_1h)}{a.rising && ' ↑'}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{a.reports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportRow({ r, onUpdate }: { r: Report; onUpdate: (id: string, status: ReportStatus, note: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const next = STATUS_ORDER[STATUS_ORDER.indexOf(r.status) + 1];
  const claim = r.claims[0]?.text;

  async function move(status: ReportStatus) {
    setBusy(true);
    try {
      await onUpdate(r.id, status, r.status_note);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-lg border bg-secondary/40 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="font-normal">{REASON_TEXT[r.reason]}</Badge>
          {r.label && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[r.label] }} />
              {LABEL_TEXT[r.label]}{r.score != null && ` ${r.score}%`}
            </span>
          )}
          <span className="text-muted-foreground">{PLATFORM_TEXT[r.platform] ?? r.platform} · {ago(r.created)}</span>
        </div>
        <p className="mt-1 text-sm font-medium">{claim ?? 'Klaim belum terdeteksi'}</p>
        {r.note && <p className="mt-0.5 text-sm text-muted-foreground">Catatan pelapor: {r.note}</p>}
        {r.evidence[0] && (
          <p className="mt-1 text-xs text-muted-foreground">
            Bukti: <a className="text-primary hover:underline" href={r.evidence[0].url} target="_blank" rel="noopener noreferrer">
              {r.evidence[0].publisher} — {r.evidence[0].rating}</a>
          </p>
        )}
        {r.url && <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={r.url}
          target="_blank" rel="noopener noreferrer">Buka konten <ExternalLink className="size-3" /></a>}
      </div>
      <div className="flex items-center gap-2 md:flex-col md:items-end">
        <Badge variant="secondary">{STATUS_TEXT[r.status]}</Badge>
        {next && <Button size="sm" variant="secondary" disabled={busy} onClick={() => move(next)}>Jadikan “{STATUS_TEXT[next]}”</Button>}
      </div>
    </li>
  );
}

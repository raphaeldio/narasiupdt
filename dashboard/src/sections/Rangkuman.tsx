import { ArrowRight, Eye, Flag, Globe2, ShieldAlert, ShieldCheck, TrendingUp, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Label, Narrative, Summary } from '@/api';
import CountUp from '@/components/CountUp';
import SpotlightCard from '@/components/SpotlightCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BASIS_TEXT, LABEL_COLOR, LABEL_ORDER, LABEL_TEXT, LANGUAGE_TEXT, LEVEL_COLOR, LEVEL_TEXT, PLATFORM_TEXT,
  TOPIC_TEXT, ago, number,
} from '@/format';

const STATUS = {
  siaga: { text: 'Siaga', color: 'var(--st-hoax)', Icon: ShieldAlert },
  waspada: { text: 'Waspada', color: 'var(--st-caution)', Icon: ShieldAlert },
  normal: { text: 'Normal', color: 'var(--st-supported)', Icon: ShieldCheck },
} as const;

export function Rangkuman({ summary, onOpenActions, onOpenReports }: {
  summary: Summary;
  onOpenActions: (key: string) => void;
  onOpenReports: () => void;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const s = summary.stats;
  const status = STATUS[summary.status];
  const narratives = useMemo(
    () => summary.narratives.filter((n) => !topic || n.topic === topic), [summary.narratives, topic]);

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-4" aria-live="polite"
        style={{ borderColor: `color-mix(in oklab, ${status.color} 45%, var(--border))` }}>
        <span className="grid size-10 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${status.color} 18%, transparent)` }}>
          <status.Icon className="size-5" style={{ color: status.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">
            <span className="mr-2 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-background"
              style={{ background: status.color }}>{status.text}</span>
            {summary.headline}
          </p>
          <p className="text-sm text-muted-foreground">
            {summary.narratives_total} narasi dari {number.format(summary.videos_flagged)} konten ·{' '}
            {summary.tni_narratives} terkait TNI · {summary.narratives_total - summary.tni_narratives} isu lain
          </p>
        </div>
        {summary.reports.open > 0 && (
          <Button size="sm" onClick={onOpenReports}>Tinjau {summary.reports.open} laporan <ArrowRight className="size-3.5" /></Button>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Angka kunci">
        <Kpi label="Narasi prioritas tinggi" value={summary.levels.tinggi}
          hint={summary.rising ? `${summary.rising} sedang naik cepat` : 'tidak ada yang naik cepat'} />
        <Kpi label="Laporan menunggu" value={summary.reports.open} hint="perlu ditinjau petugas" />
        <Kpi label="Total pemeriksaan" value={s.total_checks} hint={`${Math.round(s.cache_hit_rate * 100)}% dilayani cache`} />
        <Kpi label="Teridentifikasi" value={Math.round(s.identified_rate * 100)} suffix="%"
          hint="hasil selain “belum terverifikasi”" />
        <Kpi label="Konten bahasa asing" value={s.foreign_checks}
          hint={Object.keys(s.languages).filter((l) => l !== 'id').map((l) => LANGUAGE_TEXT[l] ?? l).slice(0, 3).join(', ') || 'belum ada'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="gap-3 py-5">
          <CardHeader>
            <CardTitle className="text-base">Pemeriksaan per jam</CardTitle>
            <CardDescription>Jumlah konten yang diperiksa, dikelompokkan menurut label hasil.</CardDescription>
          </CardHeader>
          <CardContent><Timeline stats={s} /></CardContent>
        </Card>

        <Card className="gap-3 py-5">
          <CardHeader>
            <CardTitle className="text-base">Hasil pemeriksaan</CardTitle>
            <CardDescription>Label dan dasar penilaiannya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Distribution labels={s.labels} total={s.total_checks} />
            <dl className="grid gap-1.5 text-sm">
              {(Object.keys(BASIS_TEXT) as (keyof typeof BASIS_TEXT)[]).map((b) => (
                <div key={b} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{BASIS_TEXT[b]}</dt>
                  <dd className="font-mono tabular-nums">{number.format(s.basis[b] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card className="gap-3 py-5">
          <CardHeader>
            <CardTitle className="text-base">Isu per topik</CardTitle>
            <CardDescription>Klik topik untuk menyaring daftar narasi.</CardDescription>
          </CardHeader>
          <CardContent><Topics stats={s} selected={topic} onSelect={setTopic} /></CardContent>
        </Card>

        <Card className="gap-3 py-5">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Narasi yang perlu ditangani</CardTitle>
              <CardDescription>Konten dengan klaim serupa digabung, paling mendesak di atas.</CardDescription>
            </div>
            {topic && <Badge variant="secondary">{TOPIC_TEXT[topic] ?? topic}</Badge>}
          </CardHeader>
          <CardContent>
            {narratives.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada narasi yang perlu ditindaklanjuti{topic ? ' di topik ini' : ''}.</p>
            ) : (
              <ol className="grid gap-2">
                {narratives.map((n) => <NarrativeRow key={n.key} n={n} onOpen={() => onOpenActions(n.key)} />)}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, suffix }: { label: string; value: number; hint: string; suffix?: string }) {
  return (
    <SpotlightCard className="rounded-xl border bg-card p-4" spotlightColor="#38c6f4" intensity={0.35}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
        <CountUp to={value} duration={0.8} separator="." suffix={suffix} />
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>
    </SpotlightCard>
  );
}

function Distribution({ labels, total }: { labels: Partial<Record<Label, number>>; total: number }) {
  const rows = LABEL_ORDER.map((l) => ({ label: l, n: labels[l] ?? 0 })).filter((r) => r.n > 0);
  if (!total) return <p className="text-sm text-muted-foreground">Belum ada pemeriksaan di rentang ini.</p>;
  return (
    <div className="grid gap-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Sebaran label hasil">
        {rows.map((r) => (
          <span key={r.label} title={`${LABEL_TEXT[r.label]}: ${number.format(r.n)}`}
            style={{ width: `${(r.n / total) * 100}%`, background: LABEL_COLOR[r.label] }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: LABEL_COLOR[r.label] }} />
              <span className="truncate">{LABEL_TEXT[r.label]}</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{Math.round((r.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Topics({ stats, selected, onSelect }: { stats: Summary['stats']; selected: string | null; onSelect: (t: string | null) => void }) {
  const max = Math.max(1, ...stats.topics.map((t) => t.total));
  if (!stats.topics.length) return <p className="text-sm text-muted-foreground">Belum ada pemeriksaan di rentang ini.</p>;
  return (
    <ul className="grid gap-1">
      {stats.topics.map((t) => {
        const active = selected === t.topic;
        return (
          <li key={t.topic}>
            <button onClick={() => onSelect(active ? null : t.topic)} aria-pressed={active}
              className={`grid w-full gap-1 rounded-md px-2 py-1.5 text-left hover:bg-accent/60 ${active ? 'bg-accent' : ''}`}>
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span>{TOPIC_TEXT[t.topic] ?? t.topic}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {number.format(t.total)} diperiksa · {number.format(t.flagged)} bermasalah
                </span>
              </span>
              <span className="flex h-2 gap-[2px]" title={`${t.flagged} bermasalah dari ${t.total}`}>
                <span className="rounded-full bg-hoax" style={{ width: `${(t.flagged / max) * 100}%` }} />
                <span className="rounded-full bg-neutral" style={{ width: `${((t.total - t.flagged) / max) * 100}%` }} />
              </span>
            </button>
          </li>
        );
      })}
      <li className="mt-1 flex gap-4 px-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-hoax" /> Hoaks / perlu diwaspadai</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-neutral" /> Lainnya</span>
      </li>
    </ul>
  );
}

const SERIES: Label[] = ['hoax', 'caution', 'supported', 'unverified', 'satire', 'neutral'];

function Timeline({ stats }: { stats: Summary['stats'] }) {
  // Rentang 7 hari digabung per 6 jam supaya batangnya tetap terbaca.
  const step = stats.window_hours > 48 ? 6 : 1;
  const data = useMemo(() => {
    const out: Record<string, number | string>[] = [];
    for (let i = 0; i < stats.timeline.length; i += step) {
      const chunk = stats.timeline.slice(i, i + step);
      const last = chunk[chunk.length - 1];
      const row: Record<string, number | string> = { t: last ? (last.hours_ago === 0 ? 'kini' : `-${last.hours_ago}j`) : '' };
      for (const k of SERIES) row[k] = chunk.reduce((sum, r) => sum + (r[k as keyof typeof r] as number ?? 0), 0);
      out.push(row);
    }
    return out;
  }, [stats.timeline, step]);
  const empty = stats.total_checks === 0;

  return (
    <div>
      <div className="h-56">
        {empty ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Belum ada pemeriksaan di rentang ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--muted-foreground)' }} itemStyle={{ color: 'var(--foreground)' }}
                formatter={(v, name) => [number.format(Number(v)), LABEL_TEXT[name as Label] ?? String(name)]} />
              {SERIES.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="a" fill={LABEL_COLOR[k]} stroke="var(--card)" strokeWidth={1}
                  radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[k] }} /> {LABEL_TEXT[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NarrativeRow({ n, onOpen }: { n: Narrative; onOpen: () => void }) {
  const growth = n.viewers_1h - n.viewers_prev_1h;
  const next = n.actions.find((a) => !a.done) ?? n.actions[0];
  return (
    <li className="rounded-lg border bg-secondary/40 p-3" style={{ borderLeft: `3px solid ${LEVEL_COLOR[n.level]}` }}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide">{LEVEL_TEXT[n.level]}</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[n.label] }} />
          {LABEL_TEXT[n.label]}{n.score != null && ` ${n.score}%`}
        </span>
        <Badge variant="outline" className="font-normal">{TOPIC_TEXT[n.topic] ?? n.topic}</Badge>
        {n.tni_related && <Badge variant="outline" className="font-normal">Terkait TNI</Badge>}
        {n.language !== 'id' && (
          <Badge variant="outline" className="gap-1 font-normal"><Globe2 className="size-3" />{LANGUAGE_TEXT[n.language] ?? n.language}</Badge>
        )}
        {n.rising && <span className="flex items-center gap-1 text-caution"><TrendingUp className="size-3" /> Naik cepat</span>}
        <span className="ml-auto text-muted-foreground">Aktif {ago(n.last_seen)}</span>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{n.claim ?? <em className="text-muted-foreground">Klaim belum terdeteksi</em>}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Video className="size-3.5" /> {n.videos} konten · {Object.keys(n.platforms).map((p) => PLATFORM_TEXT[p] ?? p).join(', ')}</span>
        <span className="flex items-center gap-1"><Eye className="size-3.5" /> {number.format(n.viewers_1h)}/jam{growth > 0 && <span className="text-caution"> +{growth}</span>}</span>
        {n.reports > 0 && <span className="flex items-center gap-1"><Flag className="size-3.5" /> {n.reports} laporan</span>}
        <span>{BASIS_TEXT[n.basis]}</span>
        {next && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-primary" onClick={onOpen}>
            {next.title} <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}

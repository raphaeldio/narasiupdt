import { Check, Clock, Info, TrendingUp, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ActionSpec, Narrative, Summary } from '@/api';
import CountUp from '@/components/CountUp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { LABEL_COLOR, LABEL_TEXT, LEVEL_COLOR, LEVEL_TEXT, TOPIC_TEXT, URGENCY_COLOR, URGENCY_TEXT, number } from '@/format';
import { simulate, type SimAction } from '@/lib/sim';

const BASELINE_COLOR = 'var(--st-unverified)';
const ACTION_COLOR = 'var(--primary)';

export function Aksi({ summary, selectedKey, onSelect, onRecord }: {
  summary: Summary;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onRecord: (narrative: string, action: string) => Promise<void>;
}) {
  const narratives = summary.narratives;
  const current = narratives.find((n) => n.key === selectedKey) ?? narratives[0];

  if (!current) {
    return (
      <Card className="py-10">
        <CardContent className="text-center text-sm text-muted-foreground">
          Belum ada narasi yang perlu ditindaklanjuti. Rekomendasi muncul otomatis begitu ada konten bermasalah atau laporan masuk.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <Card className="gap-3 py-5 lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle className="text-base">Pilih narasi</CardTitle>
          <CardDescription>{narratives.length} narasi, paling mendesak di atas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid max-h-[560px] gap-1 overflow-y-auto pr-1">
            {narratives.map((n) => {
              const active = n.key === current.key;
              const open = n.actions.filter((a) => !a.done && a.id !== 'pantau').length;
              return (
                <li key={n.key}>
                  <button onClick={() => onSelect(n.key)} aria-pressed={active}
                    className={`grid w-full gap-1 rounded-md border px-3 py-2 text-left ${active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/60'}`}>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[n.level] }} />
                      <span className="font-medium">{LEVEL_TEXT[n.level]}</span>
                      <span className="text-muted-foreground">{TOPIC_TEXT[n.topic] ?? n.topic}</span>
                      {open > 0 && <span className="ml-auto text-muted-foreground">{open} aksi</span>}
                    </span>
                    <span className="line-clamp-2 text-sm">{n.claim ?? 'Klaim belum terdeteksi'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Detail key={current.key} n={current} catalog={summary.action_catalog} onRecord={onRecord} />
    </div>
  );
}

function Detail({ n, catalog, onRecord }: {
  n: Narrative;
  catalog: Record<string, ActionSpec>;
  onRecord: (narrative: string, action: string) => Promise<void>;
}) {
  const effective = n.actions.filter((a) => (catalog[a.id]?.growth_cut ?? 0) + (catalog[a.id]?.reach_cut ?? 0) > 0);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(effective.map((a, i) => [a.id, i < 2])));
  const [extraDelay, setExtraDelay] = useState(0);
  const [horizon, setHorizon] = useState(48);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setEnabled((cur) => Object.fromEntries(effective.map((a, i) => [a.id, cur[a.id] ?? i < 2])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.actions.map((a) => a.id).join(',')]);

  const chosen: SimAction[] = effective.filter((a) => enabled[a.id]).map((a) => ({
    id: a.id, delay: catalog[a.id]!.delay_hours, growthCut: catalog[a.id]!.growth_cut, reachCut: catalog[a.id]!.reach_cut,
  }));
  const result = useMemo(() => simulate(n.sim, chosen, horizon, extraDelay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n.sim.rate, n.sim.growth, n.sim.reach, horizon, extraDelay, chosen.map((c) => c.id).join(',')]);
  const firstEffect = chosen.length ? Math.min(...chosen.map((c) => c.delay)) + extraDelay : null;

  async function record(action: string) {
    setSaving(action);
    try {
      await onRecord(n.key, action);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <Card className="gap-3 py-5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[n.label] }} />
              {LABEL_TEXT[n.label]}{n.score != null && ` ${n.score}%`}
            </span>
            <Badge variant="outline" className="font-normal">{TOPIC_TEXT[n.topic] ?? n.topic}</Badge>
            {n.tni_related && <Badge variant="outline" className="font-normal">Terkait TNI</Badge>}
            {n.rising && <span className="flex items-center gap-1 text-caution"><TrendingUp className="size-3" /> Naik cepat</span>}
          </div>
          <CardTitle className="text-lg leading-snug">{n.claim ?? 'Klaim belum terdeteksi'}</CardTitle>
          <CardDescription>
            {n.videos} konten · {number.format(n.viewers_1h)} penonton terpantau/jam · {n.reports} laporan pengguna
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="gap-3 py-5">
        <CardHeader>
          <CardTitle className="text-base">Rekomendasi aksi selanjutnya</CardTitle>
          <CardDescription>Urut dari yang paling mendesak. Alasannya ditulis supaya bisa dicek, bukan diikuti buta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2">
            {n.actions.map((a, i) => (
              <li key={a.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${a.done ? 'opacity-60' : 'bg-secondary/40'}`}>
                <span className="grid size-7 place-items-center rounded-full border font-mono text-xs">{a.done ? <Check className="size-3.5" /> : i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ background: URGENCY_COLOR[a.urgency] }} />
                      {URGENCY_TEXT[a.urgency]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.why}</p>
                  <p className="mt-1 text-sm">{a.how}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UserRound className="size-3.5" /> {a.owner}</span>
                    {catalog[a.id] && catalog[a.id]!.delay_hours > 0 && (
                      <span className="flex items-center gap-1"><Clock className="size-3.5" /> terasa ±{catalog[a.id]!.delay_hours} jam setelah dijalankan</span>
                    )}
                  </p>
                </div>
                {a.id !== 'pantau' && (
                  <Button size="sm" variant={a.done ? 'ghost' : 'secondary'} disabled={a.done || saving === a.id}
                    onClick={() => record(a.id)} className="self-start">
                    {a.done ? 'Sudah dicatat' : saving === a.id ? 'Menyimpan…' : 'Tandai sudah dilakukan'}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="gap-3 py-5">
        <CardHeader>
          <CardTitle className="text-base">Simulasi: kalau aksi dijalankan</CardTitle>
          <CardDescription>
            Proyeksi penonton terpantau {horizon} jam ke depan. Nyalakan atau matikan aksi dan geser jedanya untuk melihat bedanya.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {effective.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rekomendasi untuk narasi ini belum punya aksi yang mengubah sebaran (baru dipantau).</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ul className="grid content-start gap-2">
                {effective.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <span>
                        {a.title}
                        <span className="block text-xs text-muted-foreground">
                          {catalog[a.id]!.growth_cut > 0 && `laju sebar −${Math.round(catalog[a.id]!.growth_cut * 100)}%`}
                          {catalog[a.id]!.growth_cut > 0 && catalog[a.id]!.reach_cut > 0 && ' · '}
                          {catalog[a.id]!.reach_cut > 0 && `tayangan −${Math.round(catalog[a.id]!.reach_cut * 100)}%`}
                        </span>
                      </span>
                      <Switch checked={Boolean(enabled[a.id])} onCheckedChange={(v) => setEnabled((c) => ({ ...c, [a.id]: v }))} />
                    </label>
                  </li>
                ))}
              </ul>
              <div className="grid content-start gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="flex justify-between"><span>Jeda sebelum mulai bertindak</span>
                    <span className="font-mono tabular-nums">{extraDelay === 0 ? 'langsung' : `+${extraDelay} jam`}</span></span>
                  <Slider value={[extraDelay]} min={0} max={24} step={1} onValueChange={(v) => setExtraDelay(v[0] ?? 0)}
                    aria-label="Jeda sebelum mulai bertindak" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="flex justify-between"><span>Rentang proyeksi</span>
                    <span className="font-mono tabular-nums">{horizon} jam</span></span>
                  <Slider value={[horizon]} min={12} max={72} step={12} onValueChange={(v) => setHorizon(v[0] ?? 48)}
                    aria-label="Rentang proyeksi" />
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tanpa aksi" value={result.baselineTotal} hint={`penonton terpantau dalam ${horizon} jam`} color={BASELINE_COLOR} />
            <Stat label="Dengan aksi" value={result.actionTotal} hint={chosen.length ? `${chosen.length} aksi berjalan` : 'belum ada aksi dipilih'} color={ACTION_COLOR} />
            <Stat label="Paparan dicegah" value={result.prevented} hint={`${result.preventedPct}% dari tambahan paparan`} />
          </div>

          <div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="hour" type="number" domain={[0, horizon]} tickCount={7}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }}
                    tickFormatter={(h) => (h === 0 ? 'kini' : `+${h}j`)} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => number.format(Number(v))} width={56} />
                  <Tooltip
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--muted-foreground)' }} itemStyle={{ color: 'var(--foreground)' }}
                    labelFormatter={(h) => (Number(h) === 0 ? 'Sekarang' : `${h} jam dari sekarang`)}
                    formatter={(v, name) => [number.format(Number(v)), name === 'baseline' ? 'Tanpa aksi' : 'Dengan aksi']} />
                  {firstEffect !== null && firstEffect <= horizon && (
                    <ReferenceLine x={firstEffect} stroke="var(--input)" strokeDasharray="4 4"
                      label={{ value: 'aksi mulai terasa', position: 'insideTopLeft', fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  )}
                  <Line dataKey="baseline" stroke={BASELINE_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                  <Line dataKey="action" stroke={ACTION_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: BASELINE_COLOR }} /> Tanpa aksi</li>
              <li className="flex items-center gap-2"><span className="h-0 w-5 border-t-2" style={{ borderColor: ACTION_COLOR }} /> Dengan aksi terpilih</li>
            </ul>
          </div>

          <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Ini model sederhana, bukan ramalan. “Penonton terpantau” hanya pengguna extension NARASI, jadi angka aslinya lebih besar.
              Titik awal: {number.format(n.sim.rate)} penonton/jam dengan faktor tumbuh ×{n.sim.growth}; besar efek tiap aksi adalah asumsi awal
              yang bisa disetel di <code>backend/app/advisor.py</code>.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: number; hint: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}{label}
      </div>
      <div className="font-mono text-2xl font-semibold tabular-nums"><CountUp to={value} duration={0.5} separator="." /></div>
      <div className="truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

import { AnimatePresence, motion } from 'motion/react';
import { Activity, AlertTriangle, CheckCircle2, Database, Flag, Play, Radar, ScanSearch, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, type Connection, type LiveEvent } from '@/api';
import CountUp from '@/components/CountUp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BASIS_TEXT, LABEL_COLOR, LABEL_TEXT, LANGUAGE_TEXT, PLATFORM_TEXT, TOPIC_TEXT, ago, clock, number } from '@/format';
import { eventKey, type Live } from '@/lib/useLive';
import { FlowDiagram, type FlowFilter } from './FlowDiagram';

// Contoh nyata lintas topik dan bahasa; dikirim ke pipeline sungguhan lewat /v1/analyze (platform "testbed").
const SAMPLES = [
  'Katanya besok semua ATM diblokir!! Sebarkan sebelum dihapus, media menutupi kabar ini',
  'TNI akan menyerang Aceh pada 1 November 2026, warga diminta segera mengungsi',
  'Minum air rebusan daun sirsak bisa menyembuhkan kanker dalam 3 hari',
  'The FBI and DHS seized voting machines in Texas and Arizona before November 7, 2026',
  'Lagi ngopi santai sore sama teman-teman, cuaca enak banget',
  'Pendaftaran Bintara TNI AD 2026 dibuka gratis lewat situs resmi rekrutmen TNI AD',
];

const ORIGIN_TEXT: Record<string, string> = {
  corpus: 'korpus', factcheck: 'cek fakta', feed: 'feed pemeriksa fakta', news: 'berita', search: 'pencarian',
};

function topicsOf(e: LiveEvent): string[] {
  return Array.isArray(e.topics) ? e.topics : Object.keys(e.topics ?? {});
}

function describe(e: LiveEvent): { icon: React.ReactNode; title: React.ReactNode; detail?: string } {
  const platform = PLATFORM_TEXT[e.platform ?? ''] ?? e.platform ?? '';
  switch (e.type) {
    case 'vonis': {
      const label = e.label ?? 'unverified';
      const meta = [platform, ...topicsOf(e).slice(0, 1).map((t) => TOPIC_TEXT[t] ?? t),
        e.language && e.language !== 'id' ? `bahasa ${LANGUAGE_TEXT[e.language] ?? e.language}` : '',
        e.basis && e.basis !== 'none' ? BASIS_TEXT[e.basis].toLowerCase() : '', e.cached ? 'dari cache' : '']
        .filter(Boolean).join(' · ');
      return {
        icon: <span className="size-2.5 rounded-[3px]" style={{ background: LABEL_COLOR[label] }} />,
        title: <><span className="font-medium">{LABEL_TEXT[label]}{e.score != null && ` ${e.score}%`}</span>
          {e.claim && <span className="text-muted-foreground"> — {e.claim}</span>}</>,
        detail: meta,
      };
    }
    case 'pindai':
      return { icon: <ScanSearch className="size-3.5 text-primary" />,
        title: <>Feed {platform}: <span className="font-medium">{e.count} postingan</span> dipindai</>,
        detail: Object.entries(e.labels ?? {}).map(([k, v]) => `${LABEL_TEXT[k as keyof typeof LABEL_TEXT] ?? k} ${v}`).join(' · ') };
    case 'laporan':
      return { icon: <Flag className="size-3.5 text-serious" />, title: <>Laporan pengguna masuk dari {platform}</>,
        detail: e.reason?.replace('_', ' ') };
    case 'peringatan':
      return { icon: <AlertTriangle className="size-3.5 text-hoax" />,
        title: <>Peringatan dini prioritas <span className="font-medium">{e.level}</span>{e.rising && ' · naik cepat'}</>,
        detail: [platform, TOPIC_TEXT[e.topic ?? ''] ?? e.topic].filter(Boolean).join(' · ') };
    case 'aksi':
      return { icon: <CheckCircle2 className="size-3.5 text-supported" />, title: <>Aksi dicatat: <span className="font-medium">{e.title}</span></> };
    case 'klaim':
      return { icon: <Radar className="size-3.5 text-muted-foreground" />,
        title: <span className="text-muted-foreground">{e.count} klaim ditemukan</span>,
        detail: [platform, ...topicsOf(e).map((t) => TOPIC_TEXT[t] ?? t)].join(' · ') };
    case 'bukti':
      return { icon: <Database className="size-3.5 text-muted-foreground" />,
        title: <span className="text-muted-foreground">Bukti dicari</span>,
        detail: Object.entries(e.origins ?? {}).map(([k, v]) => `${ORIGIN_TEXT[k] ?? k} ${v}`).join(' · ') || 'belum ada yang cocok' };
    case 'tahap':
      return { icon: <Activity className="size-3.5 text-muted-foreground" />,
        title: <span className="text-muted-foreground">Membaca {e.stage === 'ocr' ? 'teks di layar' : e.stage === 'audio' ? 'audio' : 'caption'}</span>, detail: platform };
    default:
      return { icon: <Activity className="size-3.5 text-muted-foreground" />,
        title: <span className="text-muted-foreground">Video dibuka{e.cached ? ' (hasil dari cache)' : ''}</span>, detail: platform };
  }
}

const HEADLINE = new Set<LiveEvent['type']>(['vonis', 'pindai', 'laporan', 'peringatan', 'aksi']);

export function Realtime({ live, conn }: { live: Live; conn: Connection }) {
  const [filter, setFilter] = useState<FlowFilter>(null);
  const [verbose, setVerbose] = useState(false);
  const [sending, setSending] = useState(false);

  const shown = useMemo(() => live.events.filter((e) => {
    if (!verbose && !HEADLINE.has(e.type)) return false;
    if (filter?.kind === 'platform') return e.platform === filter.value;
    if (filter?.kind === 'label') return e.label === filter.value || (e.labels && filter.value in e.labels);
    return true;
  }).slice(0, 40), [live.events, verbose, filter]);

  const perMinute = live.perSecond.reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...live.perSecond);
  const snap = live.snapshot;
  const verdicts = live.events.filter((e) => e.type === 'vonis');
  const identified = verdicts.length
    ? Math.round((verdicts.filter((e) => e.label !== 'unverified' && e.label !== 'error').length / verdicts.length) * 100) : 0;

  async function sendSamples() {
    setSending(true);
    const run = Date.now().toString(36);
    try {
      for (const [i, caption] of SAMPLES.entries()) {
        await api.sample(conn, `contoh-${run}-${i}`, caption);
        await new Promise((r) => setTimeout(r, 450));
      }
    } catch {
      // status koneksi sudah ditampilkan di kepala halaman
    } finally {
      setSending(false);
    }
  }

  const sources: [string, boolean, string][] = snap ? [
    ['Korpus resmi', true, 'bantahan terkurasi'],
    ['Feed pemeriksa fakta', Boolean(snap.providers.feeds), snap.feeds ? `${number.format(snap.feeds.entries)} artikel terindeks` : 'mati'],
    ['Google News', Boolean(snap.providers.news), 'media terverifikasi, semua bahasa'],
    ['Google Fact Check', Boolean(snap.providers.factcheck), 'ClaimReview'],
    ['Tavily', Boolean(snap.providers.tavily), 'pencarian situs terpercaya'],
    ['LLM', (snap.providers.llm as string[] | undefined ?? []).length > 0, (snap.providers.llm as string[] | undefined ?? []).join(' → ') || 'mode heuristik'],
  ] : [];

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Peristiwa / menit" value={perMinute} hint={live.connected ? 'aliran tersambung' : 'menunggu sambungan'} />
        <Tile label="Sesi analisis aktif" value={snap?.active_sessions ?? 0} hint="video yang sedang diproses" />
        <Tile label="Teridentifikasi" value={identified} suffix="%" hint={`dari ${verdicts.length} vonis terakhir`} />
        <Tile label="Panggilan LLM dihemat" value={Math.round((snap?.usage.llm_saving_rate ?? 0) * 100)} suffix="%"
          hint={`${number.format(snap?.usage.llm_saved ?? 0)} dari cache bersama`} />
      </div>

      <Card className="min-w-0 gap-3 overflow-hidden py-5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`size-2 rounded-full ${live.connected ? 'live-dot bg-supported' : 'bg-unverified'}`} />
              Aliran data pipeline
            </CardTitle>
            <CardDescription>
              Tiap titik adalah satu konten yang sedang lewat: dari platform asal, dicari buktinya, sampai dapat label.
            </CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={sendSamples} disabled={sending}>
            <Play className="size-3.5" /> {sending ? 'Mengirim…' : 'Kirim 6 contoh ke pipeline'}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <FlowDiagram live={live} filter={filter} onFilter={setFilter} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="gap-3 py-5">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Log langsung</CardTitle>
              <CardDescription>Hasil terbaru di atas. Tidak ada identitas penonton.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {filter && (
                <Badge variant="secondary" className="gap-1">
                  {filter.kind === 'platform' ? PLATFORM_TEXT[filter.value] ?? filter.value
                    : LABEL_TEXT[filter.value as keyof typeof LABEL_TEXT] ?? filter.value}
                  <button aria-label="Hapus saringan" onClick={() => setFilter(null)}><X className="size-3" /></button>
                </Badge>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={verbose} onCheckedChange={setVerbose} /> Semua langkah
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada peristiwa. Buka video dengan extension aktif, atau kirim contoh lewat tombol di atas.
              </p>
            ) : (
              <ul className="grid max-h-[420px] gap-1 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {shown.map((e) => {
                    const d = describe(e);
                    return (
                      <motion.li key={eventKey(e)} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50">
                        <span className="mt-1 grid size-4 place-items-center">{d.icon}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{d.title}</span>
                          {d.detail && <span className="block truncate text-xs text-muted-foreground">{d.detail}</span>}
                        </span>
                        <time className="font-mono text-[11px] text-muted-foreground tabular-nums" title={ago(e.ts)}>{clock(e.ts)}</time>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 content-start gap-4">
          <Card className="gap-3 py-5">
            <CardHeader>
              <CardTitle className="text-base">Denyut 60 detik</CardTitle>
              <CardDescription>Jumlah peristiwa per detik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-20 items-end gap-[2px]" role="img" aria-label={`${perMinute} peristiwa dalam 60 detik terakhir`}>
                {live.perSecond.map((n, i) => (
                  <span key={i} title={`${59 - i} dtk lalu: ${n} peristiwa`} className="flex-1 rounded-t-[2px] bg-primary"
                    style={{ height: `${Math.max(3, (n / peak) * 100)}%`, opacity: n ? 0.95 : 0.18 }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>60 dtk lalu</span><span>sekarang</span>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader>
              <CardTitle className="text-base">Sumber bukti</CardTitle>
              <CardDescription>Tidak bergantung pada satu layanan.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {sources.map(([name, on, note]) => (
                  <li key={name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${on ? 'bg-supported' : 'bg-neutral'}`} />
                      {name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{on ? note : 'tidak aktif'}</span>
                  </li>
                ))}
                {!snap && <li className="text-sm text-muted-foreground">Memuat status…</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, hint, suffix }: { label: string; value: number; hint: string; suffix?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        <CountUp to={value} duration={0.6} suffix={suffix} />
      </div>
      <div className="truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

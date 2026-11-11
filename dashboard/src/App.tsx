import { Activity, ClipboardList, Inbox, LayoutDashboard, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Unauthorized, type Alert, type Connection, type Report, type ReportStatus, type Summary } from '@/api';
import Aurora from '@/components/Aurora';
import GradientText from '@/components/GradientText';
import ShinyText from '@/components/ShinyText';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { clock, number } from '@/format';
import { useLive } from '@/lib/useLive';
import { Aksi } from '@/sections/Aksi';
import { Laporan } from '@/sections/Laporan';
import { Rangkuman } from '@/sections/Rangkuman';
import { Realtime } from '@/sections/Realtime';

const REFRESH_MS = 15_000;
const STORAGE_KEY = 'narasi-dashboard-connection';
type View = 'realtime' | 'rangkuman' | 'aksi' | 'laporan';

/** Token dari tautan undangan (`/#token=...`). Dibaca dari hash agar tidak ikut terkirim ke server/log. */
function tokenFromLink(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

function loadConnection(): Connection {
  const fallback: Connection = { baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000', token: '' };
  let conn = fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    // baseUrl kosong valid: dashboard di-host satu origin dengan API (lewat proxy nginx).
    if (typeof saved?.baseUrl === 'string') conn = saved;
  } catch {
    // penyimpanan lokal tidak tersedia
  }
  const token = tokenFromLink();
  if (token) {
    conn = { ...conn, token };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
    } catch {
      // penyimpanan lokal tidak tersedia; token tetap dipakai selama tab terbuka
    }
  }
  return conn;
}

export default function App() {
  const [conn, setConn] = useState<Connection>(loadConnection);
  const [hours, setHours] = useState(24);
  const [view, setView] = useState<View>('realtime');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const live = useLive(conn);

  const load = useCallback(async () => {
    try {
      const [s, a, r] = await Promise.all([
        api.summary(conn, hours),
        view === 'laporan' ? api.alerts(conn, hours) : Promise.resolve(null),
        view === 'laporan' ? api.reports(conn) : Promise.resolve(null),
      ]);
      setSummary(s);
      if (a) setAlerts(a);
      if (r) setReports(r);
      setError(null);
      setNeedsToken(false);
    } catch (e) {
      if (e instanceof Unauthorized) setNeedsToken(true);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [conn, hours, view]);

  useEffect(() => {
    void load();
    // Tab yang tidak dilihat tidak ikut membebani server; data disegarkan begitu tab dibuka lagi.
    const timer = setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Vonis, laporan, atau aksi baru: rangkuman disegarkan (paling sering sekali per 3 detik).
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = live.subscribe((e) => {
      if (timer || !['vonis', 'laporan', 'aksi', 'peringatan'].includes(e.type)) return;
      timer = setTimeout(() => {
        timer = undefined;
        void loadRef.current();
      }, 3000);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [live.subscribe]);

  async function updateReport(id: string, status: ReportStatus, note: string) {
    await api.updateReport(conn, id, status, note);
    await load();
  }

  async function recordAction(narrative: string, action: string) {
    await api.recordAction(conn, narrative, action);
    await load();
  }

  const online = !error && live.connected;

  return (
    <TooltipProvider>
      <div className="relative min-h-svh">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[300px] opacity-30" aria-hidden>
          <Aurora colorStops={['#0b3b52', '#38c6f4', '#12324a']} amplitude={0.9} blend={0.6} speed={0.5} mouseInteraction={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>

        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" className="size-9 rounded-lg ring-1 ring-primary/40" />
              <div className="leading-tight">
                <div className="text-sm font-bold tracking-wide">NARASI</div>
                <div className="text-[11px] text-muted-foreground">Mode Satuan</div>
              </div>
            </div>
            <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <span className={`size-2 rounded-full ${online ? 'live-dot bg-supported' : 'bg-hoax'}`} />
              {online ? <ShinyText text="Tersambung langsung" speed={3} /> : needsToken ? 'Butuh token' : 'Terputus'}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-lg border p-0.5" role="group" aria-label="Rentang waktu">
                {[24, 168].map((h) => (
                  <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}
                    className={`rounded-md px-3 py-1 text-xs ${hours === h ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                    {h === 24 ? '24 jam' : '7 hari'}
                  </button>
                ))}
              </div>
              <ConnectionSheet conn={conn} needsToken={needsToken} onSave={(c) => {
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
                } catch {
                  // abaikan
                }
                setConn(c);
              }} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-5 pb-10 pt-7">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">
              Pantau narasi. <GradientText colors={['#38c6f4', '#8de0ff', '#38c6f4']} animationSpeed={6}>Putuskan langkah.</GradientText>
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Semua hasil scan extension masuk ke sini: hoaks soal TNI, kesehatan, bencana, penipuan, sampai konten luar negeri.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-hoax/50 bg-hoax/10 px-4 py-2.5 text-sm" role="alert">
              {needsToken ? 'Masukkan token dashboard lewat tombol Koneksi untuk melanjutkan.' : `Tidak dapat memuat data dari ${conn.baseUrl}: ${error}`}
            </p>
          )}

          <Tabs value={view} onValueChange={(v) => setView(v as View)} className="gap-5">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="realtime" className="gap-2 px-3 py-1.5"><Activity className="size-4" /> Realtime</TabsTrigger>
              <TabsTrigger value="rangkuman" className="gap-2 px-3 py-1.5"><LayoutDashboard className="size-4" /> Rangkuman</TabsTrigger>
              <TabsTrigger value="aksi" className="gap-2 px-3 py-1.5">
                <ClipboardList className="size-4" /> Rekomendasi & simulasi
                {summary && summary.levels.tinggi > 0 && <Count n={summary.levels.tinggi} tone="hoax" />}
              </TabsTrigger>
              <TabsTrigger value="laporan" className="gap-2 px-3 py-1.5">
                <Inbox className="size-4" /> Laporan
                {summary && summary.reports.open > 0 && <Count n={summary.reports.open} tone="caution" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="realtime"><Realtime live={live} conn={conn} /></TabsContent>
            <TabsContent value="rangkuman">
              {summary ? (
                <Rangkuman summary={summary} onOpenReports={() => setView('laporan')}
                  onOpenActions={(key) => { setSelected(key); setView('aksi'); }} />
              ) : <Loading />}
            </TabsContent>
            <TabsContent value="aksi">
              {summary ? <Aksi summary={summary} selectedKey={selected} onSelect={setSelected} onRecord={recordAction} /> : <Loading />}
            </TabsContent>
            <TabsContent value="laporan">
              {summary ? <Laporan summary={summary} reports={reports} alerts={alerts} onUpdate={updateReport} /> : <Loading />}
            </TabsContent>
          </Tabs>

          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
            <span>{summary ? `Rangkuman diperbarui ${clock(summary.generated_at)} · otomatis saat ada data baru` : 'Menunggu data'}</span>
            <span>Data agregat anonim: tidak ada identitas penonton atau pelapor.</span>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}

function Count({ n, tone }: { n: number; tone: 'hoax' | 'caution' }) {
  return (
    <span className="rounded-full px-1.5 font-mono text-[11px] font-semibold text-background"
      style={{ background: `var(--st-${tone})` }}>{number.format(n)}</span>
  );
}

function Loading() {
  return <p className="py-16 text-center text-sm text-muted-foreground">Memuat data…</p>;
}

function ConnectionSheet({ conn, needsToken, onSave }: { conn: Connection; needsToken: boolean; onSave: (c: Connection) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(conn);
  useEffect(() => {
    if (needsToken) setOpen(true);
  }, [needsToken]);
  const field = 'h-9 rounded-md border bg-input/30 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline"><Settings2 className="size-3.5" /> Koneksi</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Koneksi server</SheetTitle>
          <SheetDescription>Alamat backend NARASI dan token dashboard (bila server memintanya).</SheetDescription>
        </SheetHeader>
        <form className="grid gap-4 px-4" onSubmit={(e) => { e.preventDefault(); onSave(draft); setOpen(false); }}>
          <label className="grid gap-1.5 text-sm">
            Alamat server
            <input className={field} value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm">
            Token dashboard
            <input className={field} type="password" autoComplete="off" value={draft.token}
              onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
          </label>
          <Button type="submit">Simpan</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

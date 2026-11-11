import { useEffect, useMemo, useRef, useState } from 'react';
import type { Label, LiveEvent } from '@/api';
import { LABEL_COLOR, LABEL_TEXT, number } from '@/format';
import type { Live } from '@/lib/useLive';

// Diagram aliran data pipeline: Sumber → Ekstraksi → Klaim → Bukti → Vonis → Tindak lanjut.
// Setiap peristiwa dari backend menjadi partikel yang menempuh rute sebenarnya (platform asal,
// dasar bukti yang dipakai, label akhir). Partikel digerakkan langsung di DOM (requestAnimationFrame),
// jadi ratusan peristiwa per menit tidak memicu render ulang React.

const W = 1220;
const H = 412;
const NODE_H = 36;

interface Node {
  id: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  hint: string;
  color?: string;
}

const col = (x: number, w: number, ys: number[], defs: [string, string, string, string?][], c: number): Node[] =>
  defs.map(([id, text, hint, color], i) => ({ id, col: c, x, y: ys[i] ?? 0, w, h: NODE_H, text, hint, color }));

const NODES: Node[] = [
  ...col(16, 138, [36, 108, 180, 252, 324], [
    ['src:instagram', 'Instagram Reels', 'Video dan feed dari Instagram'],
    ['src:tiktok', 'TikTok', 'Video dari TikTok'],
    ['src:youtube', 'YouTube Shorts', 'Video dari YouTube Shorts'],
    ['src:facebook', 'Facebook Reels', 'Video dan feed dari Facebook'],
    ['src:testbed', 'Contoh', 'Contoh yang dikirim dari dashboard'],
  ], 0),
  ...col(222, 124, [84, 180, 276], [
    ['st:caption', 'Caption', 'Teks caption dan hashtag'],
    ['st:ocr', 'Teks di layar', 'OCR dari frame video'],
    ['st:audio', 'Audio', 'Transkrip suara (semua bahasa)'],
  ], 1),
  { id: 'claims', col: 2, x: 414, y: 150, w: 124, h: 96, text: 'Klaim & topik',
    hint: 'Klaim faktual diekstrak, diberi topik dan bahasa' },
  ...col(606, 150, [36, 108, 180, 252, 324], [
    ['ev:corpus', 'Korpus resmi', 'Bantahan terkurasi (Komdigi, PPID TNI AD)'],
    ['ev:factcheck', 'Pemeriksa fakta', 'Google Fact Check + indeks feed Mafindo, Snopes, dll'],
    ['ev:news', 'Media terverifikasi', 'Google News + pencarian situs terpercaya'],
    ['ev:signals', 'Pola bahasa', 'Sinyal risiko: desakan sebar, sumber anonim, konspirasi'],
    ['ev:ai', 'Penilaian AI', 'Penilaian awal bila belum ada rujukan'],
  ], 3),
  ...col(844, 150, [20, 84, 148, 212, 276, 340], [
    ['lb:hoax', LABEL_TEXT.hoax, 'Dibantah sumber terpercaya', LABEL_COLOR.hoax],
    ['lb:caution', LABEL_TEXT.caution, 'Menyesatkan atau berpola hoaks', LABEL_COLOR.caution],
    ['lb:supported', LABEL_TEXT.supported, 'Sejalan dengan sumber', LABEL_COLOR.supported],
    ['lb:unverified', LABEL_TEXT.unverified, 'Belum ada rujukan', LABEL_COLOR.unverified],
    ['lb:satire', LABEL_TEXT.satire, 'Parodi atau satire', LABEL_COLOR.satire],
    ['lb:neutral', LABEL_TEXT.neutral, 'Tidak ada klaim yang perlu diperiksa', LABEL_COLOR.neutral],
  ], 4),
  ...col(1066, 138, [84, 180, 276], [
    ['ac:laporan', 'Laporan', 'Laporan dari extension masuk ke dashboard'],
    ['ac:peringatan', 'Peringatan dini', 'Narasi masuk antrean prioritas'],
    ['ac:aksi', 'Aksi petugas', 'Tindak lanjut yang dicatat petugas'],
  ], 5),
];

const BY_ID = new Map(NODES.map((n) => [n.id, n]));
const HEADINGS = ['Sumber', 'Ekstraksi', 'Klaim', 'Bukti', 'Vonis', 'Tindak lanjut'];
const HEADING_X = [16, 222, 414, 606, 844, 1066];
// Titik kumpul: semua jalur bukti bertemu di sini sebelum menyebar ke label (mengurangi garis silang).
const JUNCTION = { x: 820, y: 198 };

const right = (n: Node) => ({ x: n.x + n.w, y: n.y + n.h / 2 });
const left = (n: Node) => ({ x: n.x, y: n.y + n.h / 2 });
type Pt = { x: number; y: number };
const curve = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
};
const link = (from: string, to: string) => curve(right(BY_ID.get(from)!), left(BY_ID.get(to)!));
const toJunction = (from: string) => curve(right(BY_ID.get(from)!), JUNCTION);
const fromJunction = (to: string) => curve(JUNCTION, left(BY_ID.get(to)!));

const ids = (prefix: string) => NODES.filter((n) => n.id.startsWith(prefix)).map((n) => n.id);
const EDGES: string[] = [
  ...ids('src:').map((s) => link(s, 'st:caption')),
  ...ids('st:').map((s) => link(s, 'claims')),
  ...ids('ev:').map((e) => link('claims', e)),
  ...ids('ev:').map(toJunction),
  ...ids('lb:').map(fromJunction),
  ...['lb:hoax', 'lb:caution'].flatMap((l) => ['ac:laporan', 'ac:peringatan'].map((a) => link(l, a))),
  // Peringatan → aksi petugas: garis tegak antar-simpul di kolom yang sama.
  ((a: Node, b: Node) => `M${a.x + a.w / 2} ${a.y + a.h} L${b.x + b.w / 2} ${b.y}`)(
    BY_ID.get('ac:peringatan')!, BY_ID.get('ac:aksi')!),
];

function evidenceNode(e: LiveEvent): string | null {
  if (e.basis === 'signals') return 'ev:signals';
  if (e.basis === 'ai') return 'ev:ai';
  const o = e.origins ?? {};
  const groups: [string, number][] = [
    ['ev:corpus', o.corpus ?? 0],
    ['ev:factcheck', (o.factcheck ?? 0) + (o.feed ?? 0)],
    ['ev:news', (o.news ?? 0) + (o.search ?? 0)],
  ];
  const best = groups.sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

/** Rute partikel (daftar path SVG) dan simpul yang dilewati untuk satu peristiwa. */
function route(e: LiveEvent): { paths: string[]; nodes: string[]; color: string } | null {
  const src = `src:${e.platform}`;
  const hasSrc = BY_ID.has(src);
  if (e.type === 'vonis' && e.label && BY_ID.has(`lb:${e.label}`)) {
    const ev = evidenceNode(e);
    const lb = `lb:${e.label}`;
    const paths = [
      ...(hasSrc ? [link(src, 'st:caption')] : []),
      link('st:caption', 'claims'),
      ...(ev ? [link('claims', ev), toJunction(ev)] : [curve(right(BY_ID.get('claims')!), JUNCTION)]),
      fromJunction(lb),
    ];
    return { paths, nodes: [src, 'st:caption', 'claims', ...(ev ? [ev] : []), lb], color: LABEL_COLOR[e.label] };
  }
  if (e.type === 'tahap' && e.stage && e.stage !== 'caption' && hasSrc) {
    const st = `st:${e.stage}`;
    return { paths: [link(src, st), link(st, 'claims')], nodes: [src, st], color: 'var(--primary)' };
  }
  if ((e.type === 'laporan' || e.type === 'peringatan') && e.label) {
    const lb = BY_ID.has(`lb:${e.label}`) ? `lb:${e.label}` : 'lb:unverified';
    const target = `ac:${e.type}`;
    return { paths: [link(lb, target)], nodes: [target], color: 'var(--st-serious)' };
  }
  return null;
}

/** Simpul yang dihitung (dan berkedip) untuk peristiwa tanpa partikel. */
function touched(e: LiveEvent): string[] {
  if (e.type === 'masuk') return [`src:${e.platform}`];
  if (e.type === 'aksi') return ['ac:aksi'];
  if (e.type === 'laporan') return ['ac:laporan'];
  if (e.type === 'peringatan') return ['ac:peringatan'];
  if (e.type === 'klaim') return ['claims'];
  return [];
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_PARTICLES = 60;
const SPEED = 520; // unit viewBox per detik

interface Particle {
  el: SVGCircleElement;
  path: SVGPathElement;
  length: number;
  start: number;
  duration: number;
  nodes: string[];
}

export type FlowFilter = { kind: 'platform' | 'label'; value: string } | null;

export function FlowDiagram({ live, filter, onFilter }: { live: Live; filter: FlowFilter; onFilter: (f: FlowFilter) => void }) {
  const layer = useRef<SVGGElement>(null);
  const pulses = useRef<SVGGElement>(null);
  const particles = useRef<Particle[]>([]);
  const counts = useRef(new Map<string, number>());
  const seeded = useRef(false);
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<Node | null>(null);

  const bump = (id: string, by = 1) => counts.current.set(id, (counts.current.get(id) ?? 0) + by);

  // Hitungan awal dari riwayat (tanpa partikel).
  useEffect(() => {
    if (seeded.current || !live.snapshot) return;
    seeded.current = true;
    for (const e of live.snapshot.events) count(e);
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.snapshot]);

  function count(e: LiveEvent) {
    if (e.type === 'vonis' && e.label) {
      bump(`lb:${e.label}`);
      const ev = evidenceNode(e);
      if (ev) bump(ev);
      bump('st:caption');
    } else if (e.type === 'pindai') {
      bump(`src:${e.platform}`, e.count ?? 0);
      for (const [label, n] of Object.entries(e.labels ?? {})) bump(`lb:${label}`, n ?? 0);
    } else if (e.type === 'tahap' && e.stage && e.stage !== 'caption') {
      bump(`st:${e.stage}`);
    } else if (e.type === 'klaim') {
      bump('claims', e.count ?? 1);
    } else {
      for (const id of touched(e)) bump(id);
    }
  }

  useEffect(() => {
    const pulse = (id: string, color?: string) => {
      const n = BY_ID.get(id);
      const g = pulses.current;
      if (!n || !g || g.childElementCount > 40) return;
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(n.x));
      r.setAttribute('y', String(n.y));
      r.setAttribute('width', String(n.w));
      r.setAttribute('height', String(n.h));
      r.setAttribute('rx', '9');
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', color ?? n.color ?? 'var(--primary)');
      r.setAttribute('stroke-width', '2');
      r.setAttribute('class', 'node-pulse');
      r.addEventListener('animationend', () => r.remove());
      g.appendChild(r);
    };

    const unsubscribe = live.subscribe((e) => {
      count(e);
      const r = route(e);
      if (!r) {
        touched(e).forEach((id) => pulse(id));
        if (e.type === 'pindai') pulse(`src:${e.platform}`);
        return;
      }
      if (document.hidden || !layer.current || particles.current.length >= MAX_PARTICLES) return;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', r.paths.join(' ').replace(/ M[\d.]+ [\d.]+/g, ''));
      const length = path.getTotalLength();
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('r', '4.5');
      el.setAttribute('fill', r.color);
      el.setAttribute('stroke', 'var(--card)');
      el.setAttribute('stroke-width', '1.5');
      el.style.filter = `drop-shadow(0 0 6px ${r.color})`;
      layer.current.appendChild(el);
      pulse(r.nodes[0] ?? '', r.color);
      particles.current.push({ el, path, length, start: performance.now(), duration: (length / SPEED) * 1000, nodes: r.nodes });
    });

    let raf = 0;
    const step = (now: number) => {
      const keep: Particle[] = [];
      for (const p of particles.current) {
        const t = Math.min(1, (now - p.start) / p.duration);
        const pt = p.path.getPointAtLength(t * p.length);
        p.el.setAttribute('cx', String(pt.x));
        p.el.setAttribute('cy', String(pt.y));
        if (t < 1) {
          keep.push(p);
        } else {
          p.el.remove();
          pulse(p.nodes[p.nodes.length - 1] ?? '');
        }
      }
      particles.current = keep;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const repaint = setInterval(() => setTick((t) => t + 1), 500);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
      clearInterval(repaint);
      particles.current.forEach((p) => p.el.remove());
      particles.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.subscribe]);

  const selectedId = filter ? `${filter.kind === 'platform' ? 'src' : 'lb'}:${filter.value}` : null;
  const edges = useMemo(() => EDGES, []);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[860px]" role="img"
        aria-label="Aliran data pipeline dari sumber video sampai tindak lanjut">
        {HEADINGS.map((h, i) => (
          <text key={h} x={HEADING_X[i]} y={12} className="fill-muted-foreground" fontSize="10.5" fontWeight={600}
            letterSpacing="0.08em">{h.toUpperCase()}</text>
        ))}
        <g fill="none" stroke="var(--primary)" strokeOpacity="0.22" strokeWidth="1.25">
          {edges.map((d, i) => <path key={i} d={d} className="flow-edge" />)}
        </g>
        <circle cx={JUNCTION.x} cy={JUNCTION.y} r="3.5" fill="var(--primary)" fillOpacity="0.5" />
        {NODES.map((n) => {
          const value = counts.current.get(n.id) ?? 0;
          const clickable = n.col === 0 || n.col === 4;
          const selected = selectedId === n.id;
          const tall = n.h > NODE_H;
          return (
            <g key={n.id} tabIndex={clickable ? 0 : undefined} role={clickable ? 'button' : undefined}
              aria-label={`${n.text}: ${value}`} aria-pressed={clickable ? selected : undefined}
              className={clickable ? 'cursor-pointer outline-none' : undefined}
              onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n)} onBlur={() => setHover(null)}
              onClick={() => clickable && onFilter(selected ? null : {
                kind: n.col === 0 ? 'platform' : 'label', value: n.id.split(':')[1] ?? '' })}
              onKeyDown={(ev) => {
                if (clickable && (ev.key === 'Enter' || ev.key === ' ')) {
                  ev.preventDefault();
                  onFilter(selected ? null : { kind: n.col === 0 ? 'platform' : 'label', value: n.id.split(':')[1] ?? '' });
                }
              }}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9" fill="var(--secondary)"
                stroke={selected ? 'var(--primary)' : hover?.id === n.id ? 'var(--input)' : 'var(--border)'}
                strokeWidth={selected ? 2 : 1} />
              {n.color && <rect x={n.x + 8} y={n.y + n.h / 2 - 5} width="10" height="10" rx="3" fill={n.color} />}
              <text x={n.x + (n.color ? 25 : 11)} y={tall ? n.y + 30 : n.y + n.h / 2 + 4} fontSize="11.5" fontWeight={500}
                className="fill-foreground">{n.text}</text>
              <text x={tall ? n.x + 11 : n.x + n.w - 10} y={tall ? n.y + 66 : n.y + n.h / 2 + 4}
                textAnchor={tall ? 'start' : 'end'} fontSize={tall ? 24 : 11.5} fontWeight={600}
                className={value ? 'fill-foreground' : 'fill-muted-foreground'}
                style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {number.format(value)}
              </text>
            </g>
          );
        })}
        <g ref={pulses} />
        <g ref={layer} />
      </svg>
      {hover && (
        <div className="pointer-events-none absolute z-10 max-w-64 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(78, (hover.x / W) * 100)}%`, top: `${((hover.y + hover.h + 8) / H) * 100}%` }}>
          <div className="font-medium">{hover.text} · {number.format(counts.current.get(hover.id) ?? 0)}</div>
          <div className="text-muted-foreground">{hover.hint}</div>
          {(hover.col === 0 || hover.col === 4) && <div className="mt-1 text-primary">Klik untuk menyaring log</div>}
        </div>
      )}
    </div>
  );
}

export type { Label };

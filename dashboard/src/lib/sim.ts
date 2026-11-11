// Simulasi "bagaimana kalau aksi ini dijalankan": proyeksi penonton terpantau per jam, dengan dan tanpa aksi.
//
// Model sengaja sederhana supaya bisa dijelaskan ke pimpinan dalam satu kalimat:
//   laju(t) = laju(t-1) × tumbuh(t), dan daya tumbuh memudar seiring waktu (minat penonton turun).
// Tiap aksi punya jeda sampai mulai terasa, lalu (a) mengurangi daya tumbuh dan/atau (b) memangkas tayangan
// yang masih beredar. Semua angka efek adalah ASUMSI dari backend (app/advisor.py), bukan hasil pengukuran.

export interface SimBase {
  rate: number;   // penonton terpantau per jam saat ini
  growth: number; // faktor tumbuh per jam (jam ini dibanding jam sebelumnya)
  reach: number;  // penonton terpantau sejauh ini
}

export interface SimAction {
  id: string;
  delay: number;     // jam sampai aksi mulai terasa
  growthCut: number; // 0..1
  reachCut: number;  // 0..1
}

export interface SimPoint {
  hour: number;
  baseline: number; // kumulatif tanpa aksi
  action: number;   // kumulatif dengan aksi
}

export interface SimResult {
  points: SimPoint[];
  baselineTotal: number;
  actionTotal: number;
  prevented: number;
  preventedPct: number;
  peakHour: number;
}

const FADE_HOURS = 6;      // daya tumbuh memudar ~63% tiap 6 jam
const HOURLY_DECAY = 0.03; // minat turun 3% per jam walau tanpa aksi
const RAMP_HOURS = 2;      // aksi butuh ±2 jam sampai efeknya penuh

const round1 = (v: number) => Math.round(v * 10) / 10;
const ramp = (t: number, delay: number) => Math.min(1, Math.max(0, (t - delay) / RAMP_HOURS));

export function simulate(base: SimBase, actions: SimAction[], horizon = 48, extraDelay = 0): SimResult {
  let rb = Math.max(base.rate, 0.5); // video tanpa penonton jam ini tetap bisa menyebar pelan
  let ra = rb;
  let cb = base.reach;
  let ca = base.reach;
  let peak = 0;
  let peakHour = 0;
  const points: SimPoint[] = [{ hour: 0, baseline: round1(cb), action: round1(ca) }];

  for (let t = 1; t <= horizon; t++) {
    const g = 1 + (base.growth - 1) * Math.exp(-t / FADE_HOURS) - HOURLY_DECAY;
    rb *= g;

    // Efek gabungan aksi pada jam t.
    let keepGrowth = 1;
    let keepReach = 1;
    let keepPrev = 1;
    for (const a of actions) {
      const now = ramp(t, a.delay + extraDelay);
      const before = ramp(t - 1, a.delay + extraDelay);
      keepGrowth *= 1 - a.growthCut * now;
      keepReach *= 1 - a.reachCut * now;
      keepPrev *= 1 - a.reachCut * before;
    }
    // Daya tumbuh di atas 1 dipotong; laju juga turun sebanding tayangan yang hilang pada jam ini.
    const ga = g > 1 ? 1 + (g - 1) * keepGrowth : g - (1 - keepGrowth) * 0.08;
    ra *= ga * (keepReach / keepPrev);

    cb += rb;
    ca += ra;
    if (rb > peak) {
      peak = rb;
      peakHour = t;
    }
    points.push({ hour: t, baseline: round1(cb), action: round1(ca) });
  }

  const added = cb - base.reach;
  const prevented = Math.max(0, cb - ca);
  return {
    points,
    baselineTotal: Math.round(cb),
    actionTotal: Math.round(ca),
    prevented: Math.round(prevented),
    preventedPct: added > 0 ? Math.round((prevented / added) * 100) : 0,
    peakHour,
  };
}

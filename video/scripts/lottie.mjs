// Animasi Lottie untuk video iklan (NarasiAd), ditulis langsung sebagai JSON Bodymovin tanpa After Effects.
//   node scripts/lottie.mjs  ->  public/lottie/{burst,pulse,check,alert}.json
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../public/lottie');
fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const still = (k) => ({ a: 0, k });
const EASE_OUT = { i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } };
// Keyframe animasi: [[frame, nilai], ...]. Nilai skalar dibungkus array sesuai format Lottie.
const anim = (keys) => ({
  a: 1,
  k: keys.map(([t, s], i) => ({ t, s: Array.isArray(s) ? s : [s], ...(i < keys.length - 1 ? EASE_OUT : {}) })),
});
const tr = (extra = {}) => ({ ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), ...extra });
const stroke = (color, w, extra = {}) => ({ ty: 'st', c: still(hex(color)), o: still(100), w: typeof w === 'number' ? still(w) : w, lc: 2, lj: 2, ...extra });
const fill = (color, o = 100) => ({ ty: 'fl', c: still(hex(color)), o: typeof o === 'number' ? still(o) : o, r: 1 });
const ellipse = (d) => ({ ty: 'el', p: still([0, 0]), s: typeof d === 'number' ? still([d, d]) : d });
const pathShape = (vs, closed = false) => ({
  ty: 'sh',
  ks: still({ i: vs.map(() => [0, 0]), o: vs.map(() => [0, 0]), v: vs, c: closed }),
});
const trim = (s, e) => ({ ty: 'tm', s, e, o: still(0), m: 1 });

function layer(nm, shapes, { op, p = [0, 0], s, o, r } = {}) {
  return {
    ddd: 0, ty: 4, nm, sr: 1, ip: 0, op, st: 0, bm: 0,
    ks: { o: o ?? still(100), r: r ?? still(0), p: still([...p, 0]), a: still([0, 0, 0]), s: s ?? still([100, 100, 100]) },
    shapes,
  };
}

function comp(nm, w, h, op, layers) {
  return { v: '5.7.4', fr: 30, ip: 0, op, w, h, nm, ddd: 0, assets: [], layers };
}

// 1. Burst: cincin meledak + 10 sinar. Dipakai tiap badge NARASI muncul. 24 frame.
function burst(color, name) {
  const op = 24;
  const c = [200, 200];
  const ring = layer('ring', [{ ty: 'gr', it: [ellipse(anim([[0, [20, 20]], [16, [300, 300]]])), stroke(color, anim([[0, 18], [16, 0]])), tr()] }], {
    op, p: c, o: anim([[0, 100], [12, 100], [18, 0]]),
  });
  const rays = Array.from({ length: 10 }, (_, k) => ({
    ty: 'gr',
    it: [
      pathShape([[0, -60], [0, -170]]),
      trim(anim([[2, 0], [18, 100]]), anim([[0, 0], [12, 100]])),
      stroke(k % 2 ? '#ffffff' : color, k % 2 ? 6 : 10),
      tr({ r: still(k * 36 + 18) }),
    ],
  }));
  const dots = Array.from({ length: 6 }, (_, k) => {
    const a = ((k * 60 + 5) * Math.PI) / 180;
    return {
      ty: 'gr',
      it: [ellipse(14), fill(color), tr({ p: anim([[0, [0, 0]], [18, [Math.cos(a) * 150, Math.sin(a) * 150]]]), s: anim([[0, [100, 100]], [20, [0, 0]]]) })],
    };
  });
  return comp(name, 400, 400, op, [layer('rays', rays, { op, p: c }), layer('dots', dots, { op, p: c }), ring]);
}

// 2. Pulse: titik LIVE dengan dua gelombang yang berulang mulus (loop 30 frame).
function pulse(color) {
  const op = 30;
  const c = [100, 100];
  const wave = (delay) =>
    layer(`wave${delay}`, [{ ty: 'gr', it: [ellipse(40), stroke(color, 6), tr()] }], {
      op, p: c,
      s: anim([[delay - 30, [100, 100, 100]], [delay, [430, 430, 100]], [delay + 0.01, [100, 100, 100]], [delay + 30, [430, 430, 100]]]),
      o: anim([[delay - 30, 90], [delay, 0], [delay + 0.01, 90], [delay + 30, 0]]),
    });
  const dot = layer('dot', [{ ty: 'gr', it: [ellipse(44), fill(color), tr()] }], {
    op, p: c, s: anim([[0, [100, 100, 100]], [15, [118, 118, 100]], [30, [100, 100, 100]]]),
  });
  return comp('pulse', 200, 200, op, [dot, wave(15), wave(30)]);
}

// 3. Check: lingkaran tergambar lalu centang (trim path). 30 frame, berhenti di frame terakhir.
function check(color) {
  const op = 30;
  const c = [150, 150];
  const circle = layer('circle', [{ ty: 'gr', it: [ellipse(220), trim(still(0), anim([[0, 0], [16, 100]])), stroke(color, 16), tr({ r: still(-90) })] }], { op, p: c });
  const tick = layer('tick', [{ ty: 'gr', it: [pathShape([[-52, 4], [-14, 42], [58, -40]]), trim(still(0), anim([[12, 0], [26, 100]])), stroke(color, 20), tr()] }], {
    op, p: c, s: anim([[24, [100, 100, 100]], [27, [112, 112, 100]], [30, [100, 100, 100]]]),
  });
  return comp('check', 300, 300, op, [tick, circle]);
}

// 4. Alert: segitiga peringatan yang tergambar, tanda seru jatuh, lalu bergetar. 30 frame.
function alert(color) {
  const op = 30;
  const c = [150, 160];
  const tri = layer('tri', [{ ty: 'gr', it: [pathShape([[0, -110], [120, 95], [-120, 95]], true), trim(still(0), anim([[0, 0], [14, 100]])), stroke(color, 18), tr()] }], {
    op, p: c, r: anim([[16, 0], [18, -6], [20, 6], [22, -4], [24, 3], [26, 0]]),
  });
  const bang = layer('bang', [
    { ty: 'gr', it: [pathShape([[0, -40], [0, 22]]), stroke(color, 20), tr()] },
    { ty: 'gr', it: [ellipse(22), fill(color), tr({ p: still([0, 56]) })] },
  ], { op, p: c, s: anim([[10, [0, 0, 100]], [16, [125, 125, 100]], [20, [100, 100, 100]]]) });
  return comp('alert', 300, 300, op, [bang, tri]);
}

const files = {
  'burst.json': burst('#38c6f4', 'burst'),
  'burst-red.json': burst('#FF5A5F', 'burst-red'),
  'pulse.json': pulse('#3DD68C'),
  'check.json': check('#3DD68C'),
  'alert.json': alert('#FF5A5F'),
};
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
console.log('lottie:', Object.keys(files).join(', '));

// Benchmark thuật toán TSP trên tập điểm liên thông (mọi tập có khoảng cách láng giềng ≤ T = 20).
// Chạy: node bench/bench.js hk    → so với Held-Karp (tối ưu chính xác), n = 12, 14, 16, 18
//       node bench/bench.js ref   → n = 40, 80, 100 so với chuẩn = min(thuật toán, 5 lần 2-opt + Or-opt ngẫu nhiên)
// Chuẩn ở chế độ ref là cận trên của tối ưu nên độ lệch chỉ mang tính tương đối.
const core = require('../core.js');
const U = require('../uncross.js');
const LS = require('../localsearch.js');

const T = 20;

// PRNG mulberry32: ổn định, tránh lỗi số thực của LCG kiểu s * 1103515245.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function connected(P) {
  const n = P.length, seen = new Array(n).fill(false), st = [0];
  seen[0] = true;
  let c = 1;
  while (st.length) {
    const u = st.pop();
    for (let v = 0; v < n; v++) {
      if (!seen[v] && Math.hypot(P[u][0] - P[v][0], P[u][1] - P[v][1]) <= T) {
        seen[v] = true; c++; st.push(v);
      }
    }
  }
  return c === n;
}

const clamp = v => Math.min(100, Math.max(0, v));
const ringPts = (m, R, cx = 50, cy = 50, ph = 0) => Array.from({ length: m }, (_, i) => {
  const a = ph + 2 * Math.PI * i / m;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
});

// Các dạng hình học. Bán kính co theo n để khoảng cách láng giềng ≤ T.
const gens = {
  'Vòng tròn': n => ringPts(n, Math.min(40, 3 * n)),
  'Hai vòng đồng tâm': n => { const R = Math.min(40, 1.6 * n); return ringPts(Math.ceil(n / 2), R).concat(ringPts(Math.floor(n / 2), R / 2, 50, 50, 0.3)); },
  'Vòng ngoài + đồi trong': (n, r) => {
    const m = Math.max(6, Math.round(n * 0.4)), R = Math.min(40, 1.6 * m);
    const P = ringPts(m, R);
    while (P.length < n) { const a = r() * 2 * Math.PI, d = Math.sqrt(r()) * R * 0.6; P.push([50 + d * Math.cos(a), 50 + d * Math.sin(a)]); }
    return P;
  },
  'Lưới có nhiễu': (n, r) => {
    const c = Math.ceil(Math.sqrt(n)), step = Math.min(18, 80 / c), P = [];
    for (let i = 0; P.length < n; i++) P.push([clamp(10 + (i % c) * step + (r() - 0.5) * 3), clamp(10 + Math.floor(i / c) * step + (r() - 0.5) * 3)]);
    return P;
  },
  'Chuỗi cụm': (n, r) => {
    const P = [];
    for (let i = 0; P.length < n; i++) P.push([clamp(10 + (i % 4) * 25 + (r() - 0.5) * 8), clamp(50 + (r() - 0.5) * 12)]);
    return P;
  },
  'Bước đi ngẫu nhiên': (n, r) => {
    const P = [[50, 50]];
    while (P.length < n) { const b = P[P.length - 1], a = r() * 2 * Math.PI, d = 8 + r() * 10; P.push([clamp(b[0] + d * Math.cos(a)), clamp(b[1] + d * Math.sin(a))]); }
    return P;
  },
  'Ngẫu nhiên liên thông': (n, r) => {
    const P = [[r() * 100, r() * 100]];
    while (P.length < n) {
      const b = P[Math.floor(r() * P.length)], a = r() * 2 * Math.PI, d = Math.sqrt(r()) * T;
      const q = [b[0] + d * Math.cos(a), b[1] + d * Math.sin(a)];
      if (q[0] >= 0 && q[0] <= 100 && q[1] >= 0 && q[1] <= 100) P.push(q);
    }
    return P;
  },
};

function make(type, n, r) {
  for (let tries = 0; tries < 200; tries++) {
    const P = gens[type](n, r);
    if (P.length === n && connected(P)) return P;
  }
  return null;
}

const algos = {
  'Bao lồi + chèn': (P, D) => U.hullInsertionTour(P, D),
  'Bao lồi + chèn + 2-opt + Or-opt': (P, D) => LS.orOpt(D, LS.twoOpt(D, U.hullInsertionTour(P, D))),
  'FI': (P, D) => core.farthestInsertionTour(D).order,
  'FI + 2-opt + Or-opt': (P, D) => LS.orOpt(D, LS.twoOpt(D, core.farthestInsertionTour(D).order)),
};

function randomRestartBest(D, n, r, k = 5) {
  let best = Infinity;
  for (let s = 0; s < k; s++) {
    const t = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    best = Math.min(best, core.tourLength(D, LS.orOpt(D, LS.twoOpt(D, t))));
  }
  return best;
}

function run(mode) {
  const sizes = mode === 'hk' ? [12, 14, 16, 18] : [40, 80, 100];
  const trials = mode === 'hk' ? 8 : 6;
  const total = {};
  for (const k of Object.keys(algos)) total[k] = { gap: 0, hit: 0, cnt: 0 };
  for (const type of Object.keys(gens)) {
    for (const n of sizes) {
      const gap = {}, hit = {};
      for (const k of Object.keys(algos)) { gap[k] = 0; hit[k] = 0; }
      let cnt = 0;
      for (let s = 1; s <= trials; s++) {
        const r = rng(s * 1000003 + n * 31 + type.length);
        const P = make(type, n, r);
        if (!P) continue;
        const D = core.distanceMatrix(P);
        const lens = {};
        for (const [k, f] of Object.entries(algos)) {
          const order = f(P, D);
          if (order.length !== n || new Set(order).size !== n) throw new Error(`${k}: đầu ra không phải hoán vị (${type}, n=${n})`);
          lens[k] = core.tourLength(D, order);
        }
        const ref = mode === 'hk' ? core.heldKarpTour(D).length : Math.min(Math.min(...Object.values(lens)), randomRestartBest(D, n, r));
        for (const k of Object.keys(algos)) {
          gap[k] += (lens[k] / ref - 1) * 100;
          if (lens[k] <= ref + 1e-9) hit[k]++;
        }
        cnt++;
      }
      if (!cnt) continue;
      for (const k of Object.keys(algos)) { total[k].gap += gap[k]; total[k].hit += hit[k]; total[k].cnt += cnt; }
      console.log(`${type} n=${n} (${cnt}): ` + Object.keys(algos).map(k => `${k} ${(gap[k] / cnt).toFixed(2)}% [${hit[k]}/${cnt}]`).join(' | '));
    }
  }
  console.log('--- Tổng hợp ---');
  for (const k of Object.keys(algos)) {
    const t = total[k];
    console.log(`${k}: trung bình ${(t.gap / t.cnt).toFixed(2)}%, trúng ${t.hit}/${t.cnt}`);
  }
}

const mode = process.argv[2];
if (mode !== 'hk' && mode !== 'ref') {
  console.log('Cách dùng: node bench/bench.js hk | ref');
  process.exit(1);
}
run(mode);

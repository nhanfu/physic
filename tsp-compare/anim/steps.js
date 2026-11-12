// Phiên bản từng bước của thuật toán "khung tia + chèn + ILS" để minh họa.
// animate() là generator: mỗi lần gọi next() chạy đúng một bước và trả về trạng thái để vẽ.
//
// Hai chế độ:
//   - Điểm thuần (không có cạnh): khoảng cách Euclid. Kết quả cuối khớp với ray.js và ils.js.
//   - Mạng lưới (có cạnh): khoảng cách là đường đi ngắn nhất trên đồ thị (Floyd–Warshall).
//
// Các pha:
//   1. tách lớp            - bóc các lớp bao lồi; đỉnh cao nhất tách riêng; tô màu cạnh nằm trên vành đai
//   2. kiểm tra ngọn đồi giả - đồi phải nối với ≥ 3 vành đai và đi qua nó phải tiết kiệm quãng đường
//   3. chọn khung tia      - thử 36 góc; mỗi vòng chừa một điểm gần tia nhất
//   4. chèn vành đai       - chèn các điểm vành đai (lớp trong và đồi giả)
//   5. chèn ngọn đồi       - chèn các đồi thật, rồi khử giao cắt
//   6. ILS                 - tối ưu cục bộ, rồi lặp phép đổi kép + tối ưu cục bộ
//   7. hoàn tất

(function (root) {
  'use strict';

  let core, U, LS;
  if (typeof module !== 'undefined' && module.exports) {
    core = require('../core.js');
    U = require('../uncross.js');
    LS = require('../localsearch.js');
  } else {
    core = root.core; U = root.uncross; LS = root.localSearch;
  }

  const EPS = 1e-9;
  const eu = (P, a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);

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

  function peel(P, idxs) {
    let rem = idxs.slice();
    const layers = [];
    while (rem.length >= 3) {
      const h = U.hullIdx(rem.map(i => P[i])).map(k => rem[k]);
      if (h.length < 3) break;
      layers.push(h);
      const hs = new Set(h);
      rem = rem.filter(i => !hs.has(i));
    }
    return { layers, rest: rem };
  }

  // Bóc lớp kiểu uncross: mỗi lớp là đa giác đơn quanh tập điểm còn lại (sắp theo góc quanh trọng tâm,
  // khử giao cắt). Đỉnh của lớp: đỉnh bao lồi, và đỉnh có cạnh kề dài hơn factor × trung vị khoảng cách
  // láng giềng gần nhất. Phần còn lại là đồi.
  function uncrossPeel(P, idxs, factor) {
    const f = factor ?? 2;
    let rem = idxs.slice();
    const layers = [];
    let first = true;
    while (rem.length >= 3) {
      let layer;
      if (first) {
        const h = U.hullIdx(rem.map(i => P[i])).map(k => rem[k]);
        if (h.length < 3) break;
        layer = h;
        first = false;
      } else {
        const nn = rem.map(i => Math.min(...rem.filter(j => j !== i).map(j => eu(P, i, j))));
        const sorted = nn.slice().sort((a, b) => a - b);
        const thr = f * sorted[Math.floor(sorted.length / 2)];
        const cx = rem.reduce((a, i) => a + P[i][0], 0) / rem.length;
        const cy = rem.reduce((a, i) => a + P[i][1], 0) / rem.length;
        const order = rem.slice().sort((a, b) => Math.atan2(P[a][1] - cy, P[a][0] - cx) - Math.atan2(P[b][1] - cy, P[b][0] - cx));
        const poly = U.uncross(P, order);
        const m = poly.length;
        const hullSet = new Set(U.hullIdx(rem.map(i => P[i])).map(k => rem[k]));
        layer = [];
        for (let t = 0; t < m; t++) {
          const v = poly[t], pr = poly[(t - 1 + m) % m], nx = poly[(t + 1) % m];
          if (hullSet.has(v) || eu(P, v, pr) > thr || eu(P, v, nx) > thr) layer.push(v);
        }
        if (layer.length < 3) break;
      }
      layers.push(layer);
      const ls = new Set(layer);
      rem = rem.filter(i => !ls.has(i));
    }
    return { layers, rest: rem };
  }

  // Vòng của một lớp trong mạng: chu trình ngắn nhất theo khoảng cách D (đường đi trên mạng) qua các điểm của lớp.
  // Với ≤ 12 điểm: Held–Karp trên ma trận con; lớn hơn: bắt đầu từ thứ tự bao lồi rồi 2-opt + Or-opt.
  // Sau đó khử giao cắt hình học (có thể đổi thứ tự điểm trên vòng).
  function beltOrder(P, D, pts) {
    if (pts.length <= 3) return pts.slice();
    const m = pts.length;
    const Ds = Array.from({ length: m }, (_, a) => Array.from({ length: m }, (_, b) => D[pts[a]][pts[b]]));
    let local;
    if (m <= 12) {
      local = core.heldKarpTour(Ds).order;
    } else {
      const start = U.hullIdx(pts.map(i => P[i]));
      const init = start.concat(Array.from({ length: m }, (_, i) => i).filter(i => !start.includes(i)));
      local = LS.orOpt(Ds, LS.twoOpt(Ds, init));
    }
    return U.uncross(P, local.map(a => pts[a]));
  }

  // Ma trận khoảng cách: Euclid, hoặc đường đi ngắn nhất trên đồ thị. skip: đỉnh bị bỏ khỏi đồ thị.
  function metric(P, edges, skip) {
    const n = P.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) M[i][i] = 0;
    if (!edges) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) M[i][j] = eu(P, i, j);
      return M;
    }
    for (const [a, b] of edges) {
      if (a === skip || b === skip) continue;
      const w = eu(P, a, b);
      M[a][b] = Math.min(M[a][b], w); M[b][a] = Math.min(M[b][a], w);
    }
    for (let k = 0; k < n; k++) {
      if (k === skip) continue;
      for (let i = 0; i < n; i++) {
        if (M[i][k] === Infinity) continue;
        for (let j = 0; j < n; j++) {
          const v = M[i][k] + M[k][j];
          if (v < M[i][j]) M[i][j] = v;
        }
      }
    }
    return M;
  }

  // Cạnh mạng nằm trên vành đai: hai đầu cùng một lớp.
  function beltEdgeList(edges, layers) {
    const lab = new Map();
    layers.forEach((L, k) => L.forEach(v => lab.set(v, k)));
    return edges.filter(([a, b]) => lab.has(a) && lab.has(b) && lab.get(a) === lab.get(b));
  }

  // Kiểm tra ngọn đồi giả: (1) nối với ≥ 3 vành đai khác nhau; (2) đi qua nó tiết kiệm quãng đường
  // so với đường nối trực tiếp giữa hai vành đai (đường đi không qua đồi).
  function checkHills(P, edges, layers, hills, through) {
    const lab = new Map();
    layers.forEach((L, k) => L.forEach(v => lab.set(v, k)));
    const adj = new Map();
    for (const [a, b] of edges) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    }
    const real = [], fake = [], info = [];
    for (const h of hills) {
      // láng giềng vành đai: đi qua các nút 'through' (giao lộ) cho đến khi gặp nút có nhãn vành đai
      const nb = [];
      const seenN = new Set([h]);
      const stack = (adj.get(h) || []).slice();
      while (stack.length) {
        const u = stack.pop();
        if (seenN.has(u)) continue;
        seenN.add(u);
        if (lab.has(u)) nb.push(u);
        else if (through && through.has(u)) stack.push(...(adj.get(u) || []));
      }
      const belts = new Set(nb.map(u => lab.get(u)));
      if (belts.size < 3) {
        fake.push(h);
        info.push({ h, belts: belts.size, saves: null, verdict: 'giả: nối với ' + belts.size + ' vành đai (cần ≥ 3)' });
        continue;
      }
      const alt = metric(P, edges, h);
      let saves = false;
      for (const a of nb) for (const b of nb) {
        if (a >= b || lab.get(a) === lab.get(b)) continue;
        const via = eu(P, a, h) + eu(P, h, b);
        if (via < alt[a][b] - EPS) { saves = true; break; }
      }
      if (saves) { real.push(h); info.push({ h, belts: belts.size, saves: true, verdict: 'thật: đi qua tiết kiệm quãng đường' }); }
      else { fake.push(h); info.push({ h, belts: belts.size, saves: false, verdict: 'giả: đi qua không tiết kiệm' }); }
    }
    return { real, fake, info };
  }

  function cheapestInsert(D, tour, k) {
    let pos = 0, inc = Infinity;
    for (let p = 0; p < tour.length; p++) {
      const i = tour[p], j = tour[(p + 1) % tour.length];
      const c = D[i][k] + D[k][j] - D[i][j];
      if (c < inc) { inc = c; pos = p + 1; }
    }
    return tour.slice(0, pos).concat([k], tour.slice(pos));
  }

  // Khoảng cách từ v đến tia (gốc o, hướng đơn vị u); điểm phía sau gốc trả về Infinity.
  function rayDist(P, v, o, u) {
    const dx = P[v][0] - o[0], dy = P[v][1] - o[1];
    if (dx * u[0] + dy * u[1] < 0) return Infinity;
    return Math.abs(dx * u[1] - dy * u[0]);
  }

  function pickReserved(P, layers, o, u) {
    const reserved = [];
    for (let k = 0; k < layers.length; k++) {
      let bv = -1, bd = Infinity;
      for (const v of layers[k]) {
        const d = rayDist(P, v, o, u);
        if (d < bd) { bd = d; bv = v; }
      }
      if (bv < 0) return null;
      reserved.push(bv);
    }
    return reserved;
  }

  function skeleton(D, peak, layers, reserved) {
    let tour = layers[0].slice();
    const inT = new Set(tour);
    const spine = [peak];
    for (let k = layers.length - 1; k >= 0; k--) spine.push(reserved[k]);
    for (const v of spine) {
      if (inT.has(v)) continue;
      tour = cheapestInsert(D, tour, v);
      inT.add(v);
    }
    return { tour, spine, inT };
  }

  function insertList(D, tour, inT, list) {
    for (const v of list) {
      if (inT.has(v)) continue;
      tour = cheapestInsert(D, tour, v);
      inT.add(v);
    }
    return tour;
  }

  function ringList(layers, fakes) {
    const out = [];
    for (let k = 1; k < layers.length; k++) out.push(...layers[k]);
    return out.concat(fakes);
  }

  function fullTour(P, D, peak, layers, realHills, fakes, reserved) {
    const sk = skeleton(D, peak, layers, reserved);
    let t = insertList(D, sk.tour.slice(), sk.inT, ringList(layers, fakes));
    t = insertList(D, t, sk.inT, realHills);
    return U.uncross(P, t);
  }

  function findPeak(P) {
    const hull = U.hullIdx(P);
    let peak = 0, bestH = -1;
    for (let i = 0; i < P.length; i++) {
      let h = 0;
      for (const v of hull) h = Math.max(h, eu(P, v, i));
      if (h > bestH) { bestH = h; peak = i; }
    }
    return peak;
  }

  function* animate(P, opts) {
    opts = opts || {};
    const iters = opts.iters ?? 150;
    const seed = opts.seed ?? 1;
    const edges = opts.edges || null;
    const angles = 36;
    const n = P.length;
    const D = metric(P, edges, -1);
    const minBelt = opts.minBelt ?? 3;
    const peak = findPeak(P);
    const idxAll = P.map((_, i) => i).filter(i => i !== peak);
    const pl = opts.layering === 'uncross'
      ? uncrossPeel(P, idxAll, opts.uncrossFactor)
      : peel(P, idxAll);
    // Vành đai: lớp ngoài luôn là vành đai; lớp bên trong chỉ là vành đai nếu có ≥ minBelt điểm.
    // Điểm của các lớp nhỏ hơn và điểm còn lại là đồi.
    const layers = [pl.layers[0]].concat(pl.layers.slice(1).filter(L => L.length >= minBelt));
    const smallLayers = pl.layers.slice(1).filter(L => L.length < minBelt).flat();
    const rest = pl.rest.concat(smallLayers);
    // Mạng: thứ tự điểm trên mỗi vòng là chu trình ngắn nhất trên mạng, không phải thứ tự hình học
    if (edges) for (let k = 0; k < layers.length; k++) layers[k] = beltOrder(P, D, layers[k]);
    const beltEdges = edges ? beltEdgeList(edges, layers) : [];
    const base = { edges, beltEdges, peak, layers };

    yield {
      ...base, phase: 1, title: 'Tách lớp',
      text: `Đỉnh cao nhất: ${peak}. Bóc ${layers.length} lớp bao lồi; ${rest.length} điểm còn lại là đồi.`,
      rest, tour: null,
    };

    if (!layers.length || layers[0].length < 3) {
      const t = LS.orOpt(D, LS.twoOpt(D, U.hullInsertionTour(P, D)));
      yield { ...base, phase: 7, title: 'Hoàn tất (dự phòng)', text: 'Các điểm thẳng hàng: bao lồi + chèn.', tour: t, length: core.tourLength(D, t) };
      return;
    }

    // Pha 2: kiểm tra ngọn đồi giả
    let realHills = rest, fakes = [];
    let checkInfo = [];
    if (edges) {
      const c = checkHills(P, edges, layers, rest);
      realHills = c.real; fakes = c.fake; checkInfo = c.info;
    }
    const fakeText = !edges
      ? 'Không có mạng lưới: bỏ qua kiểm tra.'
      : `${fakes.length} đồi giả, ${realHills.length} đồi thật. ` + checkInfo.map(x => `${x.h}: ${x.verdict}`).join('; ');
    yield {
      ...base, phase: 2, title: 'Kiểm tra ngọn đồi giả',
      text: fakeText, rest: realHills, fakes, checkInfo, tour: null,
    };

    // Pha 3: chọn khung tia tốt nhất theo độ dài tour đầy đủ (giống ray.js)
    const o = P[peak];
    let best = null, bestLen = Infinity;
    for (let a = 0; a < angles; a++) {
      const th = 2 * Math.PI * a / angles;
      const u = [Math.cos(th), Math.sin(th)];
      const reserved = pickReserved(P, layers, o, u);
      if (!reserved) continue;
      const full = fullTour(P, D, peak, layers, realHills, fakes, reserved);
      const L = core.tourLength(D, full);
      if (L < bestLen) { bestLen = L; best = { angle: a * 360 / angles, reserved }; }
    }
    if (!best) {
      const t = LS.orOpt(D, LS.twoOpt(D, U.hullInsertionTour(P, D)));
      yield { ...base, phase: 7, title: 'Hoàn tất (dự phòng)', text: 'Không chọn được khung tia.', tour: t, length: core.tourLength(D, t) };
      return;
    }
    const sk = skeleton(D, peak, layers, best.reserved);
    yield {
      ...base, phase: 3, title: 'Chọn khung tia',
      text: `Thử ${angles} góc. Góc tốt nhất: ${best.angle}°. Điểm chừa lại: ${best.reserved.join(', ')}.`,
      rest: realHills, fakes, angle: best.angle, reserved: best.reserved, spine: sk.spine,
      tour: sk.tour, tried: null,
    };

    // Pha 4: chèn vành đai (lớp trong + đồi giả)
    const inT = new Set(sk.inT);
    const t4 = insertList(D, sk.tour.slice(), inT, ringList(layers, fakes));
    yield {
      ...base, phase: 4, title: 'Chèn vành đai',
      text: `Chèn các điểm vành đai: ${ringList(layers, fakes).length} điểm (gồm ${fakes.length} đồi giả).`,
      rest: realHills, fakes, angle: best.angle, reserved: best.reserved, spine: sk.spine, tour: t4,
    };

    // Pha 5: chèn ngọn đồi thật, rồi khử giao cắt
    const t5 = U.uncross(P, insertList(D, t4, inT, realHills));
    yield {
      ...base, phase: 5, title: 'Chèn ngọn đồi',
      text: `Chèn ${realHills.length} ngọn đồi thật rồi khử giao cắt. Độ dài: ${core.tourLength(D, t5).toFixed(2)}.`,
      rest: realHills, fakes, tour: t5,
    };

    // Pha 6: ILS (giống ils.js)
    let bestT = LS.orOpt(D, LS.twoOpt(D, t5.slice()));
    let bestL = core.tourLength(D, bestT);
    yield {
      ...base, phase: 6, title: 'ILS: tối ưu cục bộ ban đầu',
      text: `2-opt rồi Or-opt. Độ dài: ${bestL.toFixed(2)}.`,
      rest: realHills, fakes, tour: bestT, length: bestL, iter: 0,
    };
    const r = rng(seed);
    for (let it = 1; it <= iters; it++) {
      let a, b, c;
      do {
        a = 1 + Math.floor(r() * (n - 1));
        b = 1 + Math.floor(r() * (n - 1));
        c = 1 + Math.floor(r() * (n - 1));
      } while (a === b || b === c || a === c);
      const [i, j, k] = [a, b, c].sort((x, y) => x - y);
      const cand = bestT.slice(0, i).concat(bestT.slice(j, k), bestT.slice(i, j), bestT.slice(k));
      const cl = LS.orOpt(D, LS.twoOpt(D, cand));
      const L = core.tourLength(D, cl);
      const accepted = L < bestL - 1e-12;
      if (accepted) { bestT = cl; bestL = L; }
      yield {
        ...base, phase: 6, title: 'ILS: lặp',
        text: `Vòng ${it}/${iters}: cắt tại ${i}, ${j}, ${k}. Ứng viên ${L.toFixed(2)} ${accepted ? '→ nhận' : '→ bỏ'} (tốt nhất ${bestL.toFixed(2)}).`,
        rest: realHills, fakes, tour: bestT, length: bestL, iter: it, candLength: L, accepted,
      };
    }

    yield {
      ...base, phase: 7, title: 'Hoàn tất',
      text: `Độ dài cuối cùng: ${bestL.toFixed(2)}.`,
      rest: realHills, fakes, tour: bestT, length: bestL,
    };
  }

  const api = { animate, peel, uncrossPeel, metric, checkHills, beltEdgeList, beltOrder, rng, findPeak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.animSteps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

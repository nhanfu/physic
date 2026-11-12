// Pipeline mạng 6 bước (theo mô tả của người dùng), dùng khoảng cách đường đi trên mạng.
//   1. khử giao cắt toàn mạng (thêm nút tại điểm cắt; nút mới là giao lộ, không phải điểm phải thăm)
//   2. phân loại vành đai/đồi; chu trình ngắn nhất cho vành đai ngoài cùng
//   3. tìm đồi giả ở lớp trong (đồi nối < 3 vành đai, hoặc đi qua không tiết kiệm quãng đường)
//   4. lặp bước 2 trên các đồi trong, cho đến khi không còn điểm chưa phân loại
//   5. đường liên thông ngắn nhất từ vành đai ngoài đến đồi trong cùng (đường về)
//   6. nối các chu trình từ ngoài vào trong; điểm của đường về được giữ lại để đi về
(function (root) {
  'use strict';
  let core, U, LS, S;
  if (typeof module !== 'undefined' && module.exports) {
    core = require('../core.js'); U = require('../uncross.js'); LS = require('../localsearch.js'); S = require('./steps.js');
  } else {
    core = root.core; U = root.uncross; LS = root.localSearch; S = root.animSteps;
  }
  const eu = (P, a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);

  // Giao điểm hai đoạn (không tính đầu mút dùng chung)
  function intersection(p1, p2, p3, p4) {
    const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-12) return null;
    const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
    const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
    if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }

  // Bước 1: khử giao cắt mạng bằng cách tách cạnh tại điểm giao (nút giao lộ mới).
  function uncrossNetwork(P0, E0) {
    let P = P0.map(p => p.slice()), E = E0.map(e => e.slice());
    const junctions = [];
    for (let guard = 0; guard < 200; guard++) {
      let found = null;
      outer: for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
        const [a, b] = E[i], [c, d] = E[j];
        if (a === c || a === d || b === c || b === d) continue;
        const x = intersection(P[a], P[b], P[c], P[d]);
        if (x) { found = { i, j, x }; break outer; }
      }
      if (!found) break;
      const { i, j, x } = found;
      P.push(x); const g = P.length - 1; junctions.push(g);
      const [a, b] = E[i], [c, d] = E[j];
      E[i] = [a, g]; E.push([g, b]);
      E[j] = [c, g]; E.push([g, d]);
    }
    return { P, E, junctions };
  }

  // Ma trận đường đi ngắn nhất và nút kế tiếp để dựng lại đường đi
  function paths(P, E) {
    const n = P.length;
    const D = Array.from({ length: n }, () => new Array(n).fill(Infinity));
    const nx = Array.from({ length: n }, () => new Array(n).fill(-1));
    for (let i = 0; i < n; i++) D[i][i] = 0;
    for (const [a, b] of E) {
      const w = eu(P, a, b);
      if (w < D[a][b]) { D[a][b] = D[b][a] = w; nx[a][b] = b; nx[b][a] = a; }
    }
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      if (D[i][k] === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const v = D[i][k] + D[k][j];
        if (v < D[i][j] - 1e-12) { D[i][j] = v; nx[i][j] = nx[i][k]; }
      }
    }
    const path = (a, b) => { const out = [a]; let c = a; while (c !== b) { c = nx[c][b]; if (c < 0) return null; out.push(c); } return out; };
    return { D, path };
  }

  // Phân lớp (bao lồi lặp) trên tập điểm con; lớp nào có ít hơn minBelt điểm thì là đồi.
  function layersOf(P, idxs, minBelt) {
    const pl = S.peel(P, idxs);
    const belts = [pl.layers[0]].concat(pl.layers.slice(1).filter(L => L.length >= minBelt));
    const small = pl.layers.slice(1).filter(L => L.length < minBelt).flat();
    return { belts, hills: pl.rest.concat(small) };
  }

  function* run(P0, E0, opts) {
    opts = opts || {};
    const minBelt = opts.minBelt ?? 5;
    const iters = opts.iters ?? 150;
    const seed = opts.seed ?? 1;
    const n0 = P0.length;

    // Bước 1
    const un = uncrossNetwork(P0, E0);
    let P = un.P, E = un.E;
    const stops = [];
    for (let i = 0; i < n0; i++) stops.push(i);
    const { D, path } = paths(P, E);
    const peak = S.findPeak(P0);
    const idxAll = stops.filter(i => i !== peak);
    const first = layersOf(P0, idxAll, minBelt);
    const beltsEdgesOf = (belts) => {
      const lab = new Map(); belts.forEach((B, k) => B.forEach(v => lab.set(v, k)));
      return E.filter(([a, b]) => lab.has(a) && lab.has(b) && lab.get(a) === lab.get(b));
    };
    yield { phase: 1, title: 'Khử giao cắt mạng', text: `Nút giao lộ mới: ${un.junctions.length}. Điểm phải thăm: ${n0}.`, P, edges: E, junctions: un.junctions, peak, layers: first.belts, rest: first.hills, fakes: [], tour: null, beltEdges: beltsEdgesOf(first.belts) };

    // Bước 2: chu trình ngắn nhất cho vành đai ngoài cùng
    const belts = [];
    const outerOrder = S.beltOrder ? S.beltOrder(P0, D, first.belts[0]) : first.belts[0];
    belts.push(outerOrder);
    yield { phase: 2, title: 'Chu trình vành đai ngoài', text: `Chu trình ngắn nhất qua ${outerOrder.length} điểm vành đai ngoài.`, P, edges: E, peak, layers: [outerOrder], rest: first.hills, fakes: [], tour: outerOrder.slice(), beltEdges: beltsEdgesOf([outerOrder]) };

    // Bước 3: đồi giả ở lớp trong (đồi đối chiếu với các vành đai hiện có)
    let hills = first.hills.slice();
    const innerBelts = first.belts.slice(1);
    for (const B of innerBelts) belts.push(S.beltOrder ? S.beltOrder(P0, D, B) : B);
    const through = new Set(un.junctions);
    const check = (hillList) => S.checkHills(P, E, belts.map(B => B), hillList, through);
    const c3 = check(hills);
    const fakes3 = c3.fake;
    const realHills = c3.real;
    yield { phase: 3, title: 'Đồi giả ở lớp trong', text: c3.info.map(x => `${x.h}: ${x.verdict}`).join('; ') || 'Không có đồi.', P, edges: E, peak, layers: belts, rest: realHills, fakes: fakes3, tour: null, beltEdges: beltsEdgesOf(belts), checkInfo: c3.info };
    for (const f of fakes3) belts[belts.length - 1] = belts[belts.length - 1].concat([f]);
    hills = realHills.filter(h => h !== peak);

    // Bước 4: lặp bước 2 cho các đồi trong
    let guard = 0;
    while (hills.length >= 3 && guard++ < 20) {
      const pl = S.peel(P0, hills);
      if (!pl.layers.length) break;
      const nb = S.beltOrder ? S.beltOrder(P0, D, pl.layers[0]) : pl.layers[0];
      belts.push(nb);
      hills = pl.rest;
      const c4 = check(hills);
      for (const f of c4.fake) belts[belts.length - 1] = belts[belts.length - 1].concat([f]);
      hills = c4.real;
    }
    yield { phase: 4, title: 'Lặp phân loại trong', text: `${belts.length} vành đai; còn ${hills.length} đồi chưa phân loại.`, P, edges: E, peak, layers: belts, rest: hills, fakes: [], tour: null, beltEdges: beltsEdgesOf(belts) };

    // Bước 5: đường liên thông ngắn nhất từ vành đai ngoài đến đồi trong cùng (peak)
    const target = peak;
    let s0 = belts[0][0], bestD = Infinity;
    for (const v of belts[0]) if (D[target][v] < bestD) { bestD = D[target][v]; s0 = v; }
    const pth = path(s0, target) || [s0, target];
    const reservedStops = pth.filter(v => v < n0 && v !== target);
    const rset = new Set(reservedStops);
    yield { phase: 5, title: 'Đường về', text: `Từ điểm ${s0} trên vành ngoài đến đồi ${target}: ${pth.length - 1} đoạn; giữ lại ${reservedStops.length} điểm để đi về.`, P, edges: E, peak, layers: belts, rest: hills, fakes: [], reserved: reservedStops, spine: pth, tour: null, beltEdges: beltsEdgesOf(belts) };

    // Bước 6: nối chu trình từ ngoài vào trong, bỏ các điểm đã giữ cho đường về; rồi đi về
    let out = [];
    let last = -1;
    for (const B of belts) {
      const cyc = B.filter(v => !rset.has(v));
      if (!cyc.length) continue;
      let start = 0;
      if (last >= 0) for (let t = 0; t < cyc.length; t++) if (D[last][cyc[t]] < D[last][cyc[start]]) start = t;
      const seq = cyc.slice(start).concat(cyc.slice(0, start));
      out.push(...seq);
      last = seq[seq.length - 1];
    }
    out = out.filter(v => v !== target);
    const back = pth.slice().reverse().filter(v => v !== target); // đi về theo đường giữ lại (t đã nằm ở đầu)
    let tour = out.concat([target]).concat(back.filter(v => v !== s0 || true).slice(0));
    // loại lặp: giữ lần đầu
    const seen = new Set(); tour = tour.filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
    const all = stops.filter(v => !tour.includes(v));
    for (const v of all) tour = U.cheapestInsert ? U.cheapestInsert(D, tour, v) : tour.concat([v]);
    tour = U.uncross(P0, tour);
    yield { phase: 6, title: 'Nối chu trình và đi về', text: `Tour ${tour.length} điểm; độ dài ${core.tourLength(D, tour).toFixed(2)}.`, P, edges: E, peak, layers: belts, rest: hills, fakes: [], reserved: reservedStops, spine: pth, tour, length: core.tourLength(D, tour), beltEdges: beltsEdgesOf(belts) };

    // Tối ưu cục bộ + ILS trên ma trận đường đi ngắn nhất
    let bestT = LS.orOpt(D, LS.twoOpt(D, tour.slice())), bestL = core.tourLength(D, bestT);
    const r = S.rng(seed);
    for (let it = 1; it <= iters; it++) {
      const m = bestT.length;
      let a, b, c;
      do { a = 1 + Math.floor(r() * (m - 1)); b = 1 + Math.floor(r() * (m - 1)); c = 1 + Math.floor(r() * (m - 1)); } while (a === b || b === c || a === c);
      const [i, j, k] = [a, b, c].sort((x, y) => x - y);
      const cand = LS.orOpt(D, LS.twoOpt(D, bestT.slice(0, i).concat(bestT.slice(j, k), bestT.slice(i, j), bestT.slice(k))));
      const L = core.tourLength(D, cand);
      if (L < bestL - 1e-12) { bestT = cand; bestL = L; }
    }
    yield { phase: 7, title: 'Hoàn tất', text: `Sau tối ưu cục bộ (ILS ${iters} vòng): ${bestL.toFixed(2)}.`, P, edges: E, peak, layers: belts, rest: hills, fakes: [], reserved: reservedStops, spine: pth, tour: bestT, length: bestL, beltEdges: beltsEdgesOf(belts) };
  }

  const api = { run, uncrossNetwork, paths };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.netPipeline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

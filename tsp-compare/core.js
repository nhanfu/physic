// Lõi bài toán người bán hàng (TSP) trên mặt phẳng, không DOM.
//
// Đầu vào: danh sách điểm [x, y]. Khoảng cách là Euclid. Chu trình là hoán vị các điểm,
// độ dài là tổng khoảng cách các cạnh liền kề, kể cả cạnh quay về điểm đầu.
//
// Các phần:
//   distanceMatrix     - ma trận khoảng cách Euclid
//   tourLength         - độ dài một chu trình (dãy chỉ số)
//   heldKarpTour       - nghiệm tối ưu, quy hoạch động theo tập con, O(2^m · m²), m ≤ 12
//   farthestInsertionTour - heuristic chèn xa nhất, O(m³)
//   compare            - chạy cả hai trên cùng một ma trận, trả về độ dài, lệch và thời gian
//   timeIt             - thời gian trung vị (ms) sau khi khởi động JIT
//   randomPoints       - sinh điểm ngẫu nhiên trong hình chữ nhật

(function (global) {
  'use strict';

  function distanceMatrix(P) {
    return P.map((a) => P.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));
  }

  function tourLength(D, order) {
    const m = order.length;
    if (m < 2) return 0;
    let len = 0;
    for (let p = 0; p < m; p++) len += D[order[p]][order[(p + 1) % m]];
    return len;
  }

  // Held–Karp: nghiệm tối ưu đúng. dp[S][j] = đường ngắn nhất đi qua tập S, bắt đầu tại 0,
  // kết thúc tại j. Truy vết thứ tự nhờ bảng cha. Trả về {order (bắt đầu từ 0), length}.
  function heldKarpTour(D) {
    const m = D.length;
    if (m === 0) return { order: [], length: 0 };
    if (m === 1) return { order: [0], length: 0 };
    if (m === 2) return { order: [0, 1], length: 2 * D[0][1] };
    const FULL = 1 << m;
    const dp = Array.from({ length: FULL }, () => new Float64Array(m).fill(Infinity));
    const par = Array.from({ length: FULL }, () => new Int8Array(m).fill(-1));
    dp[1][0] = 0;
    for (let S = 1; S < FULL; S++) {
      if (!(S & 1)) continue;
      for (let j = 0; j < m; j++) {
        if (dp[S][j] === Infinity || !(S & (1 << j))) continue;
        for (let k = 0; k < m; k++) {
          if (S & (1 << k)) continue;
          const T = S | (1 << k);
          const v = dp[S][j] + D[j][k];
          if (v < dp[T][k]) { dp[T][k] = v; par[T][k] = j; }
        }
      }
    }
    let best = Infinity, bj = -1;
    for (let j = 1; j < m; j++) {
      const v = dp[FULL - 1][j] + D[j][0];
      if (v < best) { best = v; bj = j; }
    }
    const order = [];
    let S = FULL - 1, j = bj;
    while (j !== -1) {
      order.push(j);
      const pj = par[S][j];
      S ^= 1 << j;
      j = pj;
    }
    order.reverse();
    return { order, length: best };
  }

  // Chèn xa nhất: bắt đầu từ cặp xa nhau nhất; mỗi bước chọn điểm có khoảng cách tới tập đã
  // chọn lớn nhất, rồi chèn vào cạnh làm tăng độ dài ít nhất. Trả về {order, length}.
  function farthestInsertionTour(D) {
    const m = D.length;
    if (m === 0) return { order: [], length: 0 };
    if (m === 1) return { order: [0], length: 0 };
    let a = 0, b = 1;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) if (D[i][j] > D[a][b]) { a = i; b = j; }
    let tour = [a, b];
    const inTour = new Uint8Array(m);
    inTour[a] = 1;
    inTour[b] = 1;
    while (tour.length < m) {
      let k = -1, bestD = -Infinity;
      for (let c = 0; c < m; c++) {
        if (inTour[c]) continue;
        let md = Infinity;
        for (const t of tour) md = Math.min(md, D[c][t]);
        if (md > bestD) { bestD = md; k = c; }
      }
      let pos = 0, inc = Infinity;
      for (let p = 0; p < tour.length; p++) {
        const i = tour[p], j = tour[(p + 1) % tour.length];
        const c = D[i][k] + D[k][j] - D[i][j];
        if (c < inc) { inc = c; pos = p + 1; }
      }
      tour = tour.slice(0, pos).concat([k], tour.slice(pos));
      inTour[k] = 1;
    }
    return { order: tour, length: tourLength(D, tour) };
  }

  function compare(P, opts = {}) {
    const D = distanceMatrix(P);
    const reps = opts.reps ?? (P.length <= 10 ? 30 : 10);
    const fi = farthestInsertionTour(D);
    const fiMs = timeIt(() => farthestInsertionTour(D), reps);
    const res = {
      n: P.length,
      fi: { order: fi.order, length: fi.length, ms: fiMs },
      hk: null,
      gap: null,
    };
    if (P.length >= 3 && P.length <= 12) {
      const hk = heldKarpTour(D);
      const hkMs = timeIt(() => heldKarpTour(D), reps);
      res.hk = { order: hk.order, length: hk.length, ms: hkMs };
      res.gap = (fi.length / hk.length - 1) * 100;
    }
    return res;
  }

  // Thời gian trung vị (ms) của fn, sau một lần khởi động JIT.
  function timeIt(fn, reps) {
    fn();
    const xs = [];
    for (let i = 0; i < reps; i++) {
      const t0 = now();
      fn();
      xs.push(now() - t0);
    }
    xs.sort((x, y) => x - y);
    return Math.max(xs[Math.floor(xs.length / 2)], 1e-3);
  }

  function now() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    const [s, ns] = process.hrtime();
    return s * 1e3 + ns / 1e6;
  }

  function randomPoints(n, w, h, rand = Math.random) {
    return Array.from({ length: n }, () => [rand() * w, rand() * h]);
  }

  const api = { distanceMatrix, tourLength, heldKarpTour, farthestInsertionTour, compare, timeIt, randomPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

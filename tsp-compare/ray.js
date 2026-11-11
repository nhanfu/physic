// Khung theo tia: bao lồi ngoài + chuỗi chừa lại từ đỉnh cao nhất ra ngoài theo một tia,
// các điểm còn lại được chèn rẻ nhất (lớp ngoài trước), rồi khử giao cắt.
//
// Các phần:
//   peel          - bóc các lớp bao lồi lặp
//   skeletonTour  - dựng tour từ khung cho một bộ điểm chừa lại
//   rayTour       - thử nhiều góc tia, giữ tour ngắn nhất
//
// Kết quả thực nghiệm: xem tsp-compare/PLAN-uncrossing.md (mục "Khung theo tia").

(function (global) {
  'use strict';

  let U, core_;
  if (typeof module !== 'undefined' && module.exports) {
    U = require('./uncross.js');
    core_ = require('./core.js');
  } else {
    U = global.uncross;
    core_ = global.core;
  }

  const dist = (P, a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);

  function peel(P, idxs) {
    let rem = idxs.slice();
    const out = [];
    while (rem.length >= 3) {
      const h = U.hullIdx(rem.map(i => P[i])).map(k => rem[k]);
      if (h.length < 3) break;
      out.push(h);
      const hs = new Set(h);
      rem = rem.filter(i => !hs.has(i));
    }
    return { layers: out, rest: rem };
  }

  // Khoảng cách từ v đến tia (gốc o, hướng đơn vị u); điểm phía sau gốc trả về Infinity.
  function rayDist(P, v, o, u) {
    const dx = P[v][0] - o[0], dy = P[v][1] - o[1];
    if (dx * u[0] + dy * u[1] < 0) return Infinity;
    return Math.abs(dx * u[1] - dy * u[0]);
  }

  function skeletonTour(P, D, peak, layers, rest, reserved) {
    let tour = layers[0].slice();
    const inT = new Set(tour);
    const spine = [peak];
    for (let k = layers.length - 1; k >= 1; k--) spine.push(reserved[k]);
    spine.push(reserved[0]);
    for (const v of spine) {
      if (inT.has(v)) continue;
      tour = U.cheapestInsert(D, tour, v);
      inT.add(v);
    }
    for (let k = 1; k < layers.length; k++) {
      for (const v of layers[k]) {
        if (inT.has(v)) continue;
        tour = U.cheapestInsert(D, tour, v);
        inT.add(v);
      }
    }
    for (const v of rest) {
      if (!inT.has(v)) { tour = U.cheapestInsert(D, tour, v); inT.add(v); }
    }
    return U.uncross(P, tour);
  }

  function rayTour(P, D, angles = 36) {
    const n = P.length;
    const hull = U.hullIdx(P);
    let peak = 0, bestH = -1;
    for (let i = 0; i < n; i++) {
      let h = 0;
      for (const v of hull) h = Math.max(h, dist(P, v, i));
      if (h > bestH) { bestH = h; peak = i; }
    }
    const { layers, rest } = peel(P, P.map((_, i) => i).filter(i => i !== peak));
    if (!layers.length || layers[0].length < 3) return U.hullInsertionTour(P, D);
    const K = layers.length, o = P[peak];
    let best = null, bestLen = Infinity;
    for (let a = 0; a < angles; a++) {
      const th = 2 * Math.PI * a / angles, u = [Math.cos(th), Math.sin(th)];
      const reserved = [];
      let ok = true;
      for (let k = 0; k < K; k++) {
        let bv = -1, bd = Infinity;
        for (const v of layers[k]) {
          const d = rayDist(P, v, o, u);
          if (d < bd) { bd = d; bv = v; }
        }
        if (bv < 0) { ok = false; break; }
        reserved.push(bv);
      }
      if (!ok) continue;
      const tour = skeletonTour(P, D, peak, layers, rest, reserved);
      const L = core_.tourLength(D, tour);
      if (L < bestLen) { bestLen = L; best = tour; }
    }
    return best || U.hullInsertionTour(P, D);
  }

  const api = { peel, skeletonTour, rayTour };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.raySkeleton = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

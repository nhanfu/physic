// Khử giao cắt và heuristic "bao lồi + chèn rẻ nhất" cho TSP trên mặt phẳng, không DOM.
//
// Đầu vào: danh sách điểm [x, y] và ma trận khoảng cách D (từ core.distanceMatrix).
//
// Các phần:
//   segCross          - hai đoạn thẳng có cắt nhau không (kể cả chạm và chồng lên nhau)
//   countCrossings    - số cặp cạnh không kề nhau của một tour bị giao cắt
//   hullIdx           - chỉ số đỉnh bao lồi theo chiều ngược kim đồng hồ (monotone chain)
//   uncross           - 2-opt theo tiêu chí giao cắt: lặp đảo đoạn đến khi không còn cặp giao nhau
//   cheapestInsert    - chèn một điểm vào vị trí làm tăng độ dài ít nhất
//   hullInsertionTour - lấy bao lồi làm khung, chèn các điểm còn lại theo thứ tự chỉ số, rồi khử giao cắt
//
// Ghi chú: hullInsertionTour là phiên bản "vành đai" tốt nhất trong các thử nghiệm (xem
// tsp-compare/PLAN-uncrossing.md). Nó chỉ dùng vành đai ngoài; các vành đai bên trong và độ cao
// chưa được đưa vào vì chưa cho kết quả tốt hơn.

(function (global) {
  'use strict';

  const EPS = 1e-12;

  function orient(a, b, c) {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(v) < EPS ? 0 : (v > 0 ? 1 : -1);
  }

  function onSeg(a, b, c) {
    return Math.min(a[0], b[0]) - EPS <= c[0] && c[0] <= Math.max(a[0], b[0]) + EPS &&
           Math.min(a[1], b[1]) - EPS <= c[1] && c[1] <= Math.max(a[1], b[1]) + EPS;
  }

  function segCross(p1, p2, p3, p4) {
    const d1 = orient(p3, p4, p1), d2 = orient(p3, p4, p2);
    const d3 = orient(p1, p2, p3), d4 = orient(p1, p2, p4);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    if (d1 === 0 && onSeg(p3, p4, p1)) return true;
    if (d2 === 0 && onSeg(p3, p4, p2)) return true;
    if (d3 === 0 && onSeg(p1, p2, p3)) return true;
    if (d4 === 0 && onSeg(p1, p2, p4)) return true;
    return false;
  }

  function countCrossings(P, order) {
    const m = order.length;
    let c = 0;
    for (let i = 0; i < m; i++) {
      for (let j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;
        if (segCross(P[order[i]], P[order[(i + 1) % m]], P[order[j]], P[order[(j + 1) % m]])) c++;
      }
    }
    return c;
  }

  function hullIdx(P) {
    const idx = P.map((_, i) => i).sort((a, b) => P[a][0] - P[b][0] || P[a][1] - P[b][1]);
    const cr = (o, a, b) => (P[a][0] - P[o][0]) * (P[b][1] - P[o][1]) - (P[a][1] - P[o][1]) * (P[b][0] - P[o][0]);
    const lo = [], up = [];
    for (const i of idx) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop();
      lo.push(i);
    }
    for (const i of idx.slice().reverse()) {
      while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop();
      up.push(i);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // Tối đa maxIter vòng lặp để tránh treo khi số thực gây đảo vòng.
  function uncross(P, order, maxIter = 100000) {
    const t = order.slice();
    const m = t.length;
    let changed = true, guard = 0;
    while (changed && guard++ < maxIter) {
      changed = false;
      outer: for (let i = 0; i < m; i++) {
        for (let j = i + 2; j < m; j++) {
          if (i === 0 && j === m - 1) continue;
          if (segCross(P[t[i]], P[t[(i + 1) % m]], P[t[j]], P[t[(j + 1) % m]])) {
            for (let a = i + 1, b = j; a < b; a++, b--) [t[a], t[b]] = [t[b], t[a]];
            changed = true;
            break outer;
          }
        }
      }
    }
    return t;
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

  function hullInsertionTour(P, D) {
    const n = P.length;
    let tour = hullIdx(P);
    if (tour.length < 3) return uncross(P, P.map((_, i) => i)); // mọi điểm thẳng hàng
    const inTour = new Set(tour);
    for (let k = 0; k < n; k++) {
      if (inTour.has(k)) continue;
      tour = cheapestInsert(D, tour, k);
      inTour.add(k);
    }
    return uncross(P, tour);
  }

  const api = { segCross, countCrossings, hullIdx, uncross, cheapestInsert, hullInsertionTour };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.uncross = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

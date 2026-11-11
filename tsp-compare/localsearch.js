// Tối ưu cục bộ cho TSP trên ma trận khoảng cách D, không DOM.
//
// Các phần:
//   twoOpt - đảo đoạn khi làm giảm độ dài, lặp đến khi không còn cải thiện
//   orOpt  - chuyển đoạn liên tiếp dài 1..3 sang vị trí khác (hai chiều), lặp đến khi không còn cải thiện
//
// Cả hai hàm sửa trực tiếp mảng tour đầu vào và trả về chính mảng đó.

(function (global) {
  'use strict';

  const EPS = 1e-12;

  function twoOpt(D, t) {
    const n = t.length;
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const a = t[i], b = t[i + 1], c = t[j], d = t[(j + 1) % n];
          if (D[a][c] + D[b][d] < D[a][b] + D[c][d] - EPS) {
            for (let x = i + 1, y = j; x < y; x++, y--) [t[x], t[y]] = [t[y], t[x]];
            improved = true;
          }
        }
      }
    }
    return t;
  }

  function orOpt(D, t) {
    const n = t.length;
    let improved = true;
    while (improved) {
      improved = false;
      for (let seg = 1; seg <= 3 && seg < n - 2; seg++) {
        for (let i = 0; i < n; i++) {
          const at = k => t[(i + k) % n];
          const prev = at(n - 1), first = at(0), last = at(seg - 1), next = at(seg);
          const removeGain = D[prev][first] + D[last][next] - D[prev][next];
          const rest = [];
          for (let k = 0; k < n - seg; k++) rest.push(at(seg + k));
          const segment = [];
          for (let k = 0; k < seg; k++) segment.push(at(k));
          let bestGain = EPS, bestPos = -1, bestRev = false;
          for (let p = 0; p < rest.length; p++) {
            const a = rest[p], b = rest[(p + 1) % rest.length];
            const add1 = D[a][first] + D[last][b] - D[a][b];
            const add2 = D[a][last] + D[first][b] - D[a][b];
            if (removeGain - add1 > bestGain) { bestGain = removeGain - add1; bestPos = p; bestRev = false; }
            if (removeGain - add2 > bestGain) { bestGain = removeGain - add2; bestPos = p; bestRev = true; }
          }
          if (bestPos >= 0) {
            const seg2 = bestRev ? segment.slice().reverse() : segment;
            const nt = rest.slice(0, bestPos + 1).concat(seg2, rest.slice(bestPos + 1));
            for (let k = 0; k < n; k++) t[k] = nt[k];
            improved = true;
          }
        }
      }
    }
    return t;
  }

  const api = { twoOpt, orOpt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.localSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

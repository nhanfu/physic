// Tìm kiếm cục bộ lặp (ILS) cho TSP: phép đổi kép (double bridge) rồi tối ưu cục bộ bằng 2-opt và Or-opt,
// giữ kết quả nếu tốt hơn.
//
// Các phần:
//   localSearch - 2-opt rồi Or-opt
//   ils         - lặp `iters` lần nhiễu + tối ưu cục bộ từ tour đầu vào
//
// rng: hàm trả về số thực trong [0, 1). Truyền một PRNG có hạt giống để kết quả tái lập.

(function (global) {
  'use strict';

  let LS, core_;
  if (typeof module !== 'undefined' && module.exports) {
    LS = require('./localsearch.js');
    core_ = require('./core.js');
  } else {
    LS = global.localSearch;
    core_ = global.core;
  }

  function localSearch(D, t) {
    return LS.orOpt(D, LS.twoOpt(D, t));
  }

  function ils(D, start, iters = 150, rng = Math.random) {
    let best = localSearch(D, start.slice());
    let bestLen = core_.tourLength(D, best);
    const n = best.length;
    if (n < 8) return best;
    for (let it = 0; it < iters; it++) {
      let a, b, c;
      do {
        a = 1 + Math.floor(rng() * (n - 1));
        b = 1 + Math.floor(rng() * (n - 1));
        c = 1 + Math.floor(rng() * (n - 1));
      } while (a === b || b === c || a === c);
      const [i, j, k] = [a, b, c].sort((x, y) => x - y);
      // A B C D → A C B D
      const cand = best.slice(0, i).concat(best.slice(j, k), best.slice(i, j), best.slice(k));
      const cl = localSearch(D, cand);
      const L = core_.tourLength(D, cl);
      if (L < bestLen - 1e-12) { best = cl; bestLen = L; }
    }
    return best;
  }

  const api = { localSearch, ils };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

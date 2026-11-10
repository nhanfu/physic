// Bộ test case cho bài toán TSP trên mặt phẳng. Dùng chung cho kiểm thử (node) và giao diện.
// Mỗi case: {id, name, points: [[x, y], ...], expected?: độ dài tối ưu đã biết}.
// Tọa độ nằm trong [0, 100]². Các case ngẫu nhiên dùng hạt giống cố định để tái lập.

(function (global) {
  'use strict';

  function lcg(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  }

  function regularPolygon(n, cx, cy, r, phase = 0) {
    return Array.from({ length: n }, (_, k) => {
      const t = phase + (2 * Math.PI * k) / n;
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    });
  }

  function grid(cols, rows, step, x0 = 10, y0 = 10) {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * step, y0 + r * step]);
    return out;
  }

  function uniform(n, seed, lo = 5, hi = 95) {
    const rand = lcg(seed);
    return Array.from({ length: n }, () => [lo + rand() * (hi - lo), lo + rand() * (hi - lo)]);
  }

  // các cụm quanh tâm, bán kính r
  function clusters(centers, perCluster, r, seed) {
    const rand = lcg(seed);
    const out = [];
    for (const [cx, cy] of centers) {
      for (let i = 0; i < perCluster; i++) {
        const t = rand() * 2 * Math.PI, d = rand() * r;
        out.push([cx + d * Math.cos(t), cy + d * Math.sin(t)]);
      }
    }
    return out;
  }

  const CASES = [
    { id: 'square', name: 'Hình vuông (4 điểm)', points: [[10, 10], [60, 10], [60, 60], [10, 60]], expected: 200 },
    { id: 'line', name: 'Thẳng hàng, khoảng cách không đều', points: [[5, 50], [12, 50], [30, 50], [41, 50], [80, 50]], expected: 150 },
    {
      id: 'polygon8', name: 'Đa giác đều 8 đỉnh (lồi)', points: regularPolygon(8, 50, 50, 40),
      expected: 8 * 2 * 40 * Math.sin(Math.PI / 8), // chu vi đa giác lồi
    },
    {
      id: 'polygon12', name: 'Đa giác đều 12 đỉnh (lồi)', points: regularPolygon(12, 50, 50, 40, 0.3),
      expected: 12 * 2 * 40 * Math.sin(Math.PI / 12),
    },
    { id: 'grid3x4', name: 'Lưới 3×4 (12 điểm, bước 10)', points: grid(3, 4, 10), expected: 120 },
    { id: 'grid3x3', name: 'Lưới 3×3 (9 điểm, số lẻ)', points: grid(3, 3, 10) },
    {
      id: 'polygonInner', name: 'Đa giác 9 đỉnh + một điểm trong tâm lệch',
      points: [...regularPolygon(9, 50, 50, 40), [55, 48]],
    },
    {
      id: 'twoClusters', name: 'Hai cụm xa nhau (6 + 6)',
      points: clusters([[15, 15], [85, 85]], 6, 6, 3),
    },
    {
      id: 'threeClusters', name: 'Ba cụm (4 + 4 + 4)',
      points: clusters([[15, 20], [85, 25], [50, 85]], 4, 5, 8),
    },
    {
      id: 'star', name: 'Ngôi sao (tâm và 6 đầu cánh)',
      points: [[50, 50], ...regularPolygon(6, 50, 50, 42, Math.PI / 6).map(([x, y], k) => (k % 2 ? [x, y] : [50 + (x - 50) * 0.5, 50 + (y - 50) * 0.5]))],
    },
    {
      id: 'nearDuplicate', name: 'Gần trùng nhau (cặp cách 0.001)',
      points: [[10, 10], [10.001, 10], [70, 20], [70.001, 20.001], [40, 80]],
    },
    { id: 'uniform8', name: 'Ngẫu nhiên đều, 8 điểm', points: uniform(8, 101) },
    { id: 'uniform10', name: 'Ngẫu nhiên đều, 10 điểm', points: uniform(10, 202) },
    { id: 'uniform12', name: 'Ngẫu nhiên đều, 12 điểm (giới hạn Held–Karp)', points: uniform(12, 303) },
    {
      id: 'clustered12', name: 'Ngẫu nhiên có cụm, 12 điểm',
      points: clusters([[25, 25], [75, 40], [40, 80]], 4, 8, 404),
    },
    { id: 'uniform20', name: 'Ngẫu nhiên đều, 20 điểm (chỉ xấp xỉ)', points: uniform(20, 505) },
    { id: 'grid8x5', name: 'Lưới 8×5 (40 điểm, chỉ xấp xỉ)', points: grid(8, 5, 10) },
  ];

  const api = { CASES, lcg, regularPolygon, grid, uniform, clusters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.tspCases = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

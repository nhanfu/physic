// Kiểm thử lõi lưới sợi 3D có trọng lực. Chạy: node test/core.test.js
const assert = require('assert');
const core = require('../core.js');

function solve(net, tol = 1e-9) {
  const act = core.activeSet(net);
  const s = new core.Solver(net, act, { tol, maxSweeps: 50000 });
  let guard = 0;
  while (!s.done && guard++ < 500) s.step(2000);
  return { act, solver: s, diag: core.diagnostics(net, act) };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

test('một ghim, một node treo: node nằm thẳng dưới ghim ở y = L + g/κ', () => {
  const kappa = 1000, g = 1, L = 1;
  const net = core.createNet([[0, 0, 0], [0.1, 0.5, 0]], [true, false], [[0, 1]], [L], kappa, g);
  const { solver } = solve(net);
  assert.ok(solver.converged, 'phải hội tụ');
  assert.ok(Math.abs(net.X[1]) < 1e-6 && Math.abs(net.Z[1]) < 1e-6, `x=${net.X[1]} z=${net.Z[1]}`);
  const expected = L + g / kappa;
  assert.ok(Math.abs(net.Y[1] - expected) < 1e-6, `y=${net.Y[1]} ≠ ${expected}`);
});

test('hai ghim trên trần ±1, node ở giữa: khớp cân bằng lực theo phương y', () => {
  const kappa = 1000, g = 1, L = 1.2;
  const net = core.createNet(
    [[-1, 0, 0], [1, 0, 0], [0, 0.5, 0]],
    [true, true, false],
    [[0, 2], [1, 2]],
    [L, L],
    kappa, g
  );
  const { solver } = solve(net);
  assert.ok(solver.converged);
  // nghiệm giải tích: 2κ(d − L)·(y/d) = g với d = √(1 + y²)
  const f = (y) => { const d = Math.hypot(1, y); return 2 * kappa * (d - L) * (y / d) - g; };
  let lo = 0, hi = 3;
  for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  assert.ok(Math.abs(net.X[2]) < 1e-6, `x=${net.X[2]}`);
  assert.ok(Math.abs(net.Y[2] - lo) < 1e-5, `y=${net.Y[2]} ≠ ${lo}`);
});

test('lưới phẳng 6×6 treo bốn góc: hội tụ, lực dư ~0, năng lượng giảm', () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const sh = core.buildSheet(6, 6, 50, rand);
  const pins = sh.P.map(() => false);
  for (const i of [0, 5, 30, 35]) pins[i] = true;
  const net = core.createNet(sh.P, pins, sh.edges, sh.L, 1000, 1);
  const act0 = core.activeSet(net);
  const E0 = core.energy(net, act0);
  const { solver, diag } = solve(net, 1e-8);
  console.log(`   lưới 6×6: ${solver.sweeps} vòng, sợi ${diag.ropes}, căng ${diag.taut}, độ giãn tối đa ${diag.maxStretch.toExponential(2)}, E ${E0.toFixed(3)} → ${diag.energy.toFixed(3)}, lực dư ${diag.maxRes.toExponential(2)}`);
  assert.ok(solver.converged, 'phải hội tụ');
  assert.ok(diag.energy <= E0 + 1e-9, 'năng lượng không được tăng');
  assert.ok(diag.maxRes < 1e-3, `lực dư ${diag.maxRes}`);
  // lưới nằm dưới trần: không node nào lên trên y = 0
  for (let i = 0; i < net.N; i++) assert.ok(net.Y[i] > -1e-9, `node ${i} lên trên trần`);
});

test('lưới 12×7, 160 sợi, 8 ghim: mỗi ghim có ≥ 3 sợi, cân bằng hội tụ', () => {
  let seed = 5;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const per = [];
  const cols = 12, rows = 7;
  for (let k = 0; k < cols; k++) per.push(k);
  for (let k = 1; k < rows; k++) per.push(k * cols + cols - 1);
  for (let k = cols - 2; k >= 0; k--) per.push((rows - 1) * cols + k);
  for (let k = rows - 2; k >= 1; k--) per.push(k * cols);
  const pinIdx = [];
  for (let j = 0; j < 8; j++) pinIdx.push(per[Math.floor((j * per.length) / 8)]);
  const sh = core.buildSheet(cols, rows, 160, rand, 0.8, 1.2, pinIdx);
  const pinSet = new Set(pinIdx);
  const pins = sh.P.map((_, i) => pinSet.has(i));
  const P = sh.P.map((p, i) => (pins[i] ? [p[0] * 1.5, 0, p[2] * 1.5] : p));
  const net = core.createNet(P, pins, sh.edges, sh.L, 50, 1);
  for (const i of pinIdx) {
    assert.ok(net.adj[i].length >= 3, `ghim ${i} chỉ có ${net.adj[i].length} sợi`);
  }
  const { solver } = solve(net, 1e-7);
  assert.ok(solver.converged, 'phải hội tụ');
});

test('cụm không có ghim bị loại khỏi cân bằng (sẽ rơi vô hạn)', () => {
  const net = core.createNet(
    [[0, 0, 0], [1, 0, 0], [5, 0, 5], [6, 0, 5], [5, 0, 6]],
    [true, false, false, false, false],
    [[0, 1], [2, 3], [3, 4], [4, 2]],
    [1, 1, 1, 1, 1]
  );
  const act = core.activeSet(net);
  for (const i of [2, 3, 4]) assert.strictEqual(act.alive[i], 0, `node ${i}`);
  assert.strictEqual(act.alive[1], 1);
});

test('khoảng cách tới hạn khi kéo căng = độ dài đường ngắn nhất theo chiều dài sợi', () => {
  // ghim A, B. Đường 1: A–n1–B, mỗi sợi L = 0.5 → dài 1.0. Đường 2: A–n2–n3–B, L = 0.6 → 1.8.
  // Khi kéo căng hết mức, khoảng cách A–B bằng đường ngắn nhất = 1.0 (bất đẳng thức tam giác).
  const P = [[-0.5, 0, 0], [0.5, 0, 0], [0, 0, 0], [-0.2, 0, 0.5], [0.2, 0, 0.5]];
  const pins = [true, true, false, false, false];
  const edges = [[0, 2], [2, 1], [0, 3], [3, 4], [4, 1]];
  const L = [0.5, 0.5, 0.6, 0.6, 0.6];
  const net = core.createNet(P, pins, edges, L, 1000, 0);
  const act = core.activeSet(net);
  const shortest = core.dijkstra(net, act, 0).dist[1];
  assert.ok(Math.abs(shortest - 1.0) < 1e-12, `đường ngắn nhất ${shortest}`);
});

test('chu trình: bốn góc hình vuông cạnh 1 → chu trình 4', () => {
  // đồ thị đầy đủ giữa 4 ghim, mỗi sợi L = khoảng cách (metric Euclid)
  const P = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];
  const edges = [], L = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    edges.push([a, b]);
    L.push(Math.hypot(P[a][0] - P[b][0], P[a][2] - P[b][2]));
  }
  const net = core.createNet(P, [true, true, true, true], edges, L, 1000, 0);
  const act = core.activeSet(net);
  const D = core.pinDistances(net, act, [0, 1, 2, 3]);
  const t = core.farthestInsertionTour(D);
  assert.ok(Math.abs(t.length - 4) < 1e-9, `độ dài ${t.length}`);
});

test('chu trình trên đường thẳng: 0,2,4,6 → tour = 2·6 = 12', () => {
  // đồ thị đường 0–1–…–6, L = 1; ghim ở 0,2,4,6 (metric đường đi)
  const n = 7;
  const P = Array.from({ length: n }, (_, i) => [i, 0, 0]);
  const edges = [], L = [];
  for (let i = 0; i + 1 < n; i++) { edges.push([i, i + 1]); L.push(1); }
  const pins = P.map((_, i) => i % 2 === 0 && i <= 6);
  const net = core.createNet(P, pins, edges, L, 1000, 0);
  const act = core.activeSet(net);
  const pinIdx = [0, 2, 4, 6];
  const t = core.farthestInsertionTour(core.pinDistances(net, act, pinIdx));
  assert.ok(Math.abs(t.length - 12) < 1e-9, `độ dài ${t.length}`);
});

test('chu trình xấp xỉ: 7 ghim ngẫu nhiên, so với brute-force tối ưu (≤ 2×)', () => {
  let seed = 9;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const m = 7;
  const P = Array.from({ length: m }, () => [rand() * 10, 0, rand() * 10]);
  const edges = [], L = [];
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
    edges.push([a, b]);
    L.push(Math.hypot(P[a][0] - P[b][0], P[a][2] - P[b][2]));
  }
  const net = core.createNet(P, P.map(() => true), edges, L, 1000, 0);
  const act = core.activeSet(net);
  const D = core.pinDistances(net, act, [...Array(m).keys()]);
  const heur = core.farthestInsertionTour(D).length;
  // brute force: cố định điểm 0, thử mọi hoán vị còn lại
  let opt = Infinity;
  const perm = (arr, k) => {
    if (k === arr.length) {
      let len = 0;
      const tour = [0, ...arr];
      for (let i = 0; i < tour.length; i++) len += D[tour[i]][tour[(i + 1) % tour.length]];
      opt = Math.min(opt, len);
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm([1, 2, 3, 4, 5, 6], 0);
  console.log(`   chèn xa nhất ${heur.toFixed(4)}, tối ưu ${opt.toFixed(4)}, tỉ lệ ${(heur / opt).toFixed(4)}`);
  assert.ok(heur >= opt - 1e-9, 'không thể ngắn hơn tối ưu');
  assert.ok(heur <= 2 * opt + 1e-9, `tỉ lệ ${heur / opt}`);
});

test('node thừa: nhánh treo không nằm trên đường giữa các ghim → bị loại', () => {
  // đường 0–1–2–3 (ghim 0 và 3), nhánh 1–4 (node 4 là lá, không có ghim)
  const P = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [1, 0, 1]];
  const edges = [[0, 1], [1, 2], [2, 3], [1, 4]];
  const net = core.createNet(P, [true, false, false, true, false], edges, [1, 1, 1, 1], 1000, 0);
  const act = core.activeSet(net);
  const used = core.usedNodes(net, act, [0, 3]);
  assert.strictEqual(used[4], 0, 'node 4 phải là thừa');
  assert.strictEqual(used[1], 1);
  assert.strictEqual(used[2], 1);
});

console.log(`\n${passed} test(s) passed`);

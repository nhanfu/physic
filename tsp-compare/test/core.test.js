// Kiểm thử lõi TSP. Chạy: node test/core.test.js
const assert = require('assert');
const core = require('../core.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

// brute force: cố định điểm 0, thử mọi hoán vị còn lại
function bruteForce(D) {
  const m = D.length;
  let best = Infinity;
  const rest = [...Array(m - 1).keys()].map((i) => i + 1);
  const perm = (arr, k) => {
    if (k === arr.length) {
      best = Math.min(best, core.tourLength(D, [0, ...arr]));
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm(rest, 0);
  return best;
}

function isPermutation(order, m) {
  return order.length === m && new Set(order).size === m && order.every((v) => v >= 0 && v < m);
}

test('bốn góc hình vuông cạnh 1: tối ưu = 4', () => {
  const D = core.distanceMatrix([[0, 0], [1, 0], [1, 1], [0, 1]]);
  assert.ok(Math.abs(core.heldKarpTour(D).length - 4) < 1e-9);
  assert.ok(Math.abs(core.farthestInsertionTour(D).length - 4) < 1e-9);
});

test('điểm thẳng hàng 0,2,4,6: tối ưu = 12', () => {
  const D = core.distanceMatrix([[0, 0], [2, 0], [4, 0], [6, 0]]);
  assert.ok(Math.abs(core.heldKarpTour(D).length - 12) < 1e-9);
});

test('Held–Karp = brute-force trên 7 điểm ngẫu nhiên, thứ tự là hoán vị hợp lệ', () => {
  let seed = 21;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  for (let trial = 0; trial < 5; trial++) {
    const P = core.randomPoints(7, 10, 10, rand);
    const D = core.distanceMatrix(P);
    const hk = core.heldKarpTour(D);
    assert.ok(isPermutation(hk.order, 7));
    assert.ok(Math.abs(core.tourLength(D, hk.order) - hk.length) < 1e-9, 'độ dài trả về phải khớp thứ tự');
    assert.ok(Math.abs(hk.length - bruteForce(D)) < 1e-9, `HK ${hk.length} ≠ brute`);
  }
});

test('chèn xa nhất: hoán vị hợp lệ, không ngắn hơn tối ưu, không quá 2 lần tối ưu', () => {
  let seed = 33;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  for (let trial = 0; trial < 10; trial++) {
    const P = core.randomPoints(8, 10, 10, rand);
    const D = core.distanceMatrix(P);
    const fi = core.farthestInsertionTour(D);
    const opt = core.heldKarpTour(D).length;
    assert.ok(isPermutation(fi.order, 8));
    assert.ok(fi.length >= opt - 1e-9);
    assert.ok(fi.length <= 2 * opt + 1e-9);
  }
});

test('compare: có Held–Karp với 3–12 điểm, không có với 13 điểm', () => {
  let seed = 5;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const small = core.compare(core.randomPoints(6, 10, 10, rand), { reps: 3 });
  assert.ok(small.hk && small.gap !== null && small.gap >= -1e-9);
  const big = core.compare(core.randomPoints(13, 10, 10, rand), { reps: 3 });
  assert.strictEqual(big.hk, null);
  assert.strictEqual(big.gap, null);
});

// ---- toàn bộ test case ----
const cases = require('../cases.js').CASES;

function twoOptOptimal(D, order) {
  // điều kiện cần của tối ưu: không có phép 2-opt nào làm chu trình ngắn hơn
  const m = order.length;
  for (let i = 0; i < m - 1; i++) {
    for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue;
      const a = order[i], b = order[i + 1], c = order[j], d = order[(j + 1) % m];
      if (D[a][c] + D[b][d] < D[a][b] + D[c][d] - 1e-9) return false;
    }
  }
  return true;
}

for (const cs of cases) {
  test(`case "${cs.id}": ${cs.name}`, () => {
    const P = cs.points;
    const n = P.length;
    const D = core.distanceMatrix(P);
    const fi = core.farthestInsertionTour(D);
    assert.ok(isPermutation(fi.order, n), 'chèn xa nhất phải trả về hoán vị hợp lệ');
    assert.ok(Math.abs(core.tourLength(D, fi.order) - fi.length) < 1e-6);
    if (n > 12) return; // chỉ kiểm tra xấp xỉ
    const hk = core.heldKarpTour(D);
    assert.ok(isPermutation(hk.order, n));
    assert.ok(Math.abs(core.tourLength(D, hk.order) - hk.length) < 1e-6);
    assert.ok(twoOptOptimal(D, hk.order), 'Held–Karp phải không thể cải thiện bằng 2-opt');
    assert.ok(fi.length >= hk.length - 1e-6, 'chèn xa nhất không được ngắn hơn tối ưu');
    assert.ok(fi.length <= 2 * hk.length + 1e-6, 'chèn xa nhất không được quá 2 lần tối ưu');
    if (n <= 9) assert.ok(Math.abs(hk.length - bruteForce(D)) < 1e-6, 'phải khớp brute-force');
    if (cs.expected !== undefined) {
      assert.ok(Math.abs(hk.length - cs.expected) < 1e-6 * Math.max(1, cs.expected), `HK ${hk.length} ≠ ${cs.expected}`);
    }
  });
}

console.log(`\n${passed} test(s) passed`);

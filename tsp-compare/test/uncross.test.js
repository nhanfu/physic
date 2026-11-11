// Kiểm thử khử giao cắt và heuristic bao lồi + chèn. Chạy: node test/uncross.test.js
const assert = require('assert');
const core = require('../core.js');
const U = require('../uncross.js');
const { CASES } = require('../cases.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

function isPermutation(order, m) {
  if (order.length !== m) return false;
  const seen = new Array(m).fill(false);
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= m || seen[i]) return false;
    seen[i] = true;
  }
  return true;
}

// Sinh n điểm ngẫu nhiên với hạt giống cố định (mulberry32), không dùng LCG cũ.
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
function randomPoints(n, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, () => [r() * 100, r() * 100]);
}

test('segCross: cắt chéo, không cắt, chạm đầu mút, chồng lên nhau', () => {
  assert.ok(U.segCross([0, 0], [10, 10], [0, 10], [10, 0]), 'hai đường chéo phải cắt nhau');
  assert.ok(!U.segCross([0, 0], [1, 0], [0, 1], [1, 1]), 'hai đoạn song song không cắt');
  assert.ok(U.segCross([0, 0], [5, 0], [5, 0], [9, 3]), 'chạm tại đầu mút phải tính là cắt');
  assert.ok(U.segCross([0, 0], [10, 0], [5, 0], [15, 0]), 'chồng lên nhau trên một đường phải tính là cắt');
  assert.ok(!U.segCross([0, 0], [1, 0], [2, 0], [3, 0]), 'hai đoạn thẳng hàng rời nhau không cắt');
});

test('hullIdx: bao lồi của hình vuông chứa đúng 4 đỉnh', () => {
  const P = [[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]];
  const h = U.hullIdx(P);
  assert.strictEqual(h.length, 4);
  assert.ok(!h.includes(4), 'điểm trong tâm không được nằm trên bao lồi');
});

test('uncross: đầu ra là hoán vị, không giao cắt, độ dài không tăng', () => {
  for (let s = 1; s <= 30; s++) {
    const n = 6 + (s % 10);
    const P = randomPoints(n, s * 97);
    const D = core.distanceMatrix(P);
    const start = Array.from({ length: n }, (_, i) => i);
    const out = U.uncross(P, start);
    assert.ok(isPermutation(out, n), 'phải là hoán vị');
    assert.strictEqual(U.countCrossings(P, out), 0, 'không được còn giao cắt');
    assert.ok(core.tourLength(D, out) <= core.tourLength(D, start) + 1e-9, 'độ dài không được tăng');
  }
});

test('hullInsertionTour: hoán vị hợp lệ, không giao cắt, không ngắn hơn tối ưu (n ≤ 9)', () => {
  for (let s = 1; s <= 40; s++) {
    const n = 5 + (s % 5);
    const P = randomPoints(n, s * 131);
    const D = core.distanceMatrix(P);
    const order = U.hullInsertionTour(P, D);
    assert.ok(isPermutation(order, n), 'phải là hoán vị');
    assert.strictEqual(U.countCrossings(P, order), 0, 'không được còn giao cắt');
    const hk = core.heldKarpTour(D);
    assert.ok(core.tourLength(D, order) >= hk.length - 1e-9, 'không được ngắn hơn tối ưu');
  }
});

test('hullInsertionTour: các test case có sẵn (trừ thẳng hàng) đều là hoán vị hợp lệ', () => {
  for (const cs of CASES) {
    const P = cs.points;
    const n = P.length;
    const D = core.distanceMatrix(P);
    const order = U.hullInsertionTour(P, D);
    assert.ok(isPermutation(order, n), `${cs.id}: phải là hoán vị`);
    // Trường hợp thẳng hàng: mọi tour đều có cạnh chồng nhau, nên bỏ qua kiểm tra giao cắt.
    if (cs.id !== 'line') assert.strictEqual(U.countCrossings(P, order), 0, `${cs.id}: còn giao cắt`);
  }
});

test('hullInsertionTour: điểm thẳng hàng hoàn toàn không gây lỗi', () => {
  const P = [[0, 0], [1, 0], [2, 0], [3, 0]];
  const D = core.distanceMatrix(P);
  assert.ok(isPermutation(U.hullInsertionTour(P, D), 4));
});

test('twoOpt: hoán vị hợp lệ, độ dài không tăng, không còn nước 2-opt cải thiện', () => {
  const LS = require('../localsearch.js');
  for (let s = 1; s <= 30; s++) {
    const n = 6 + (s % 10);
    const P = randomPoints(n, s * 211);
    const D = core.distanceMatrix(P);
    const start = Array.from({ length: n }, (_, i) => i);
    const before = core.tourLength(D, start);
    const out = LS.twoOpt(D, start.slice());
    assert.ok(isPermutation(out, n));
    assert.ok(core.tourLength(D, out) <= before + 1e-9);
    for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = out[i], b = out[i + 1], c = out[j], d = out[(j + 1) % n];
      assert.ok(D[a][c] + D[b][d] >= D[a][b] + D[c][d] - 1e-9, '2-opt còn cải thiện được');
    }
  }
});

test('orOpt: hoán vị hợp lệ, độ dài không tăng', () => {
  const LS = require('../localsearch.js');
  for (let s = 1; s <= 30; s++) {
    const n = 6 + (s % 10);
    const P = randomPoints(n, s * 311);
    const D = core.distanceMatrix(P);
    const start = Array.from({ length: n }, (_, i) => i);
    const before = core.tourLength(D, start);
    const out = LS.orOpt(D, start.slice());
    assert.ok(isPermutation(out, n));
    assert.ok(core.tourLength(D, out) <= before + 1e-9);
  }
});

test('hullInsertion + 2-opt + Or-opt: hợp lệ và không ngắn hơn tối ưu (n ≤ 9)', () => {
  const LS = require('../localsearch.js');
  for (let s = 1; s <= 30; s++) {
    const n = 5 + (s % 5);
    const P = randomPoints(n, s * 401);
    const D = core.distanceMatrix(P);
    const order = LS.orOpt(D, LS.twoOpt(D, U.hullInsertionTour(P, D)));
    assert.ok(isPermutation(order, n));
    assert.ok(core.tourLength(D, order) >= core.heldKarpTour(D).length - 1e-9);
  }
});

console.log(`
${passed} test(s) passed`);

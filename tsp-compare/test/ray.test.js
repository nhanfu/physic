// Kiểm thử khung theo tia. Chạy: node test/ray.test.js
const assert = require('assert');
const core = require('../core.js');
const U = require('../uncross.js');
const R = require('../ray.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

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
function isPermutation(order, m) {
  if (order.length !== m) return false;
  const seen = new Array(m).fill(false);
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= m || seen[i]) return false;
    seen[i] = true;
  }
  return true;
}

test('rayTour: hoán vị hợp lệ, không giao cắt, không ngắn hơn tối ưu (n ≤ 9)', () => {
  for (let s = 1; s <= 30; s++) {
    const n = 5 + (s % 5);
    const r = rng(s * 53);
    const P = Array.from({ length: n }, () => [r() * 100, r() * 100]);
    const D = core.distanceMatrix(P);
    const order = R.rayTour(P, D);
    assert.ok(isPermutation(order, n), 'phải là hoán vị');
    assert.strictEqual(U.countCrossings(P, order), 0, 'không được còn giao cắt');
    assert.ok(core.tourLength(D, order) >= core.heldKarpTour(D).length - 1e-9);
  }
});

test('rayTour: hoán vị hợp lệ với n lớn hơn', () => {
  for (let s = 1; s <= 5; s++) {
    const n = 40 + 10 * s;
    const r = rng(s * 71);
    const P = Array.from({ length: n }, () => [r() * 100, r() * 100]);
    const D = core.distanceMatrix(P);
    assert.ok(isPermutation(R.rayTour(P, D), n));
  }
});

console.log(`\n${passed} test(s) passed`);

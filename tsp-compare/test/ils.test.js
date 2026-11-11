// Kiểm thử ILS. Chạy: node test/ils.test.js
const assert = require('assert');
const core = require('../core.js');
const ILS = require('../ils.js');
const RAY = require('../ray.js');

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

test('ils: hoán vị hợp lệ và không dài hơn tour đầu vào', () => {
  for (let s = 1; s <= 10; s++) {
    const n = 10 + s * 2;
    const r = rng(s * 17);
    const P = Array.from({ length: n }, () => [r() * 100, r() * 100]);
    const D = core.distanceMatrix(P);
    const start = RAY.rayTour(P, D);
    const out = ILS.ils(D, start, 30, rng(s));
    assert.ok(isPermutation(out, n), 'phải là hoán vị');
    assert.ok(core.tourLength(D, out) <= core.tourLength(D, start) + 1e-9, 'không được dài hơn đầu vào');
  }
});

test('ils: không ngắn hơn tối ưu (n ≤ 9)', () => {
  for (let s = 1; s <= 20; s++) {
    const n = 5 + (s % 5);
    const r = rng(s * 29);
    const P = Array.from({ length: n }, () => [r() * 100, r() * 100]);
    const D = core.distanceMatrix(P);
    const out = ILS.ils(D, RAY.rayTour(P, D), 50, rng(s));
    assert.ok(isPermutation(out, n));
    assert.ok(core.tourLength(D, out) >= core.heldKarpTour(D).length - 1e-9);
  }
});

test('ils: đạt tối ưu với n nhỏ (n ≤ 12, 20 bộ)', () => {
  let hit = 0;
  for (let s = 1; s <= 20; s++) {
    const n = 8 + (s % 5);
    const r = rng(s * 41);
    const P = Array.from({ length: n }, () => [r() * 100, r() * 100]);
    const D = core.distanceMatrix(P);
    const out = ILS.ils(D, RAY.rayTour(P, D), 150, rng(s));
    if (core.tourLength(D, out) <= core.heldKarpTour(D).length + 1e-9) hit++;
  }
  assert.ok(hit >= 18, `chỉ tối ưu ${hit}/20 bộ`);
});

test('ils: tái lập với cùng hạt giống', () => {
  const r = rng(5);
  const P = Array.from({ length: 25 }, () => [r() * 100, r() * 100]);
  const D = core.distanceMatrix(P);
  const a = ILS.ils(D, RAY.rayTour(P, D), 40, rng(123));
  const b = ILS.ils(D, RAY.rayTour(P, D), 40, rng(123));
  assert.deepStrictEqual(a, b);
});

console.log(`\n${passed} test(s) passed`);

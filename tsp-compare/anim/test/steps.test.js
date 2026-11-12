// Kiểm thử bước animation. Chạy: node anim/test/steps.test.js
const assert = require('assert');
const core = require('../../core.js');
const RAY = require('../../ray.js');
const ILS = require('../../ils.js');
const S = require('../steps.js');
const { CASES } = require('../cases.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }
function isPermutation(order, m) {
  if (order.length !== m) return false;
  const seen = new Set(order);
  return seen.size === m && order.every(i => Number.isInteger(i) && i >= 0 && i < m);
}

test('mỗi test case chạy đủ 7 pha theo đúng thứ tự', () => {
  for (const c of CASES) {
    const phases = [];
    for (const st of S.animate(c.points, { iters: 5, seed: 1 })) phases.push(st.phase);
    const distinct = phases.filter((p, i) => i === 0 || p !== phases[i - 1]);
    assert.deepStrictEqual(distinct, [1, 2, 3, 4, 5, 6, 7], c.id);
  }
});

test('kết quả cuối khớp với ray + ILS khi không có mạng (cùng tham số, cùng hạt giống)', () => {
  for (const c of CASES) {
    if (c.edges) continue;
    const P = c.points, n = P.length, D = core.distanceMatrix(P);
    let last = null;
    for (const st of S.animate(P, { iters: 40, seed: 7 })) last = st;
    assert.ok(isPermutation(last.tour, n), c.id + ': phải là hoán vị');
    const ref = ILS.ils(D, RAY.rayTour(P, D), 40, S.rng(7));
    assert.ok(Math.abs(core.tourLength(D, last.tour) - core.tourLength(D, ref)) < 1e-9, c.id + ': khác ILS/ray');
  }
});

test('mạng: kiểm tra đồi giả có đủ thông tin và tour hợp lệ', () => {
  const c = CASES.find(x => x.edges);
  assert.ok(c, 'phải có test case mạng');
  let last = null, check = null;
  for (const st of S.animate(c.points, { edges: c.edges, minBelt: c.minBelt, iters: 10, seed: 1 })) {
    if (st.phase === 2) check = st;
    last = st;
  }
  assert.ok(check.checkInfo.length > 0, 'phải có đồi được kiểm tra');
  assert.ok(isPermutation(last.tour, c.points.length));
});

test('tour ở pha 5 trở đi là hoán vị đầy đủ (pha 3–4 chỉ là khung/bán phần)', () => {
  for (const c of CASES) {
    const n = c.points.length;
    for (const st of S.animate(c.points, { iters: 3, seed: 2 })) {
      if (st.tour && st.phase >= 5) assert.ok(isPermutation(st.tour, n), c.id + ' pha ' + st.phase);
    }
  }
});

console.log(`\n${passed} test(s) passed`);

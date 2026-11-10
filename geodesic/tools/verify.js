// Kiểm chứng: mọi lời giải tham khảo phải qua hết test, mọi code khởi đầu phải trượt,
// và bộ mô phỏng phải khớp lý thuyết.   Chạy:  node tools/verify.js
'use strict';
const path = require('path');
const course = require(path.join(__dirname, '../exercises/exercises.js'));
const runner = require(path.join(__dirname, '../exercises/runner.js'));
const P = require(path.join(__dirname, '../simulation/physics.js'));

let failures = 0;
const quiet = { log() {}, warn() {}, error() {} };

course.EXERCISES.forEach((ex, i) => {
  if (!ex.tests.length) {
    // Sân chơi: code mẫu phải chạy được với plot giả
    const plot = new Proxy({}, { get: (_, k) => (k === 'colors' || k === 'palette' ? new Proxy({}, { get: () => '#fff' }) : () => {}) });
    try { runner.compile(ex.starter, [], runner.buildLib(course, i), quiet, plot); console.log('✓ ' + ex.id + ' (sân chơi chạy được)'); }
    catch (e) { failures++; console.log('✗ ' + ex.id + ' sân chơi lỗi: ' + e.message); }
    return;
  }
  const lib = runner.buildLib(course, i);
  const t0 = Date.now();
  const sol = runner.runTests(ex, ex.solution, lib, quiet);
  const bad = sol.compileError ? [{ name: 'compile', message: sol.compileError }] : sol.results.filter((r) => !r.pass);
  const start = runner.runTests(ex, ex.starter, lib, quiet);
  const starterPasses = !start.compileError && start.results.every((r) => r.pass);
  if (start.compileError) { failures++; console.log('✗ ' + ex.id + ': code khởi đầu lỗi cú pháp: ' + start.compileError); }
  if (starterPasses) { failures++; console.log('✗ ' + ex.id + ': code khởi đầu lại qua hết test'); }
  if (bad.length) {
    failures++;
    console.log('✗ ' + ex.id);
    bad.forEach((r) => console.log('    ' + r.name + ' — ' + r.message));
  } else {
    console.log('✓ ' + ex.id + ' (' + sol.results.length + ' test, ' + (Date.now() - t0) + ' ms)');
  }
});

// Bộ mô phỏng
function simCheck(label, M, e, tol) {
  const s = new P.OrbitSim({ M, a: 1, e });
  let n = 0;
  while (s.orbits < 6 && n++ < 1e6) s.step();
  const ratio = s.measuredPrecession() / P.precessionTheory(M, 1, e);
  const ok = Math.abs(ratio - 1) < tol && Math.abs(s.normError()) < 1e-10;
  if (!ok) failures++;
  console.log((ok ? '✓ ' : '✗ ') + 'sim ' + label + ': đo/lý thuyết = ' + ratio.toFixed(5) + ', |g(u,u)+1| = ' + Math.abs(s.normError()).toExponential(1));
  return s;
}
const earth = simCheck('Trái Đất thật', P.M_SUN, P.EARTH.e, 0.005);
const lag = earth.gr[6] * P.AU_OVER_C / (earth.gr[0] / earth.period);
console.log((Math.abs(lag - 0.4672) < 0.002 ? '✓ ' : (failures++, '✗ ')) + 'sim độ trễ đồng hồ: ' + lag.toFixed(4) + ' s/vòng');
simCheck('phóng đại ×10⁵', P.M_SUN * 1e5, 0.3, 0.01);

console.log(failures ? '\n' + failures + ' lỗi' : '\nTất cả đều ổn.');
process.exit(failures ? 1 : 0);

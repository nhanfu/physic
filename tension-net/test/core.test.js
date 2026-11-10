// Kiểm thử lõi mạng sợi chỉ. Chạy: node test/core.test.js
const assert = require('assert');
const core = require('../core.js');

function solve(net) {
  const act = core.activeSet(net);
  const s = new core.Solver(net, act, { tol: 1e-10 });
  let guard = 0;
  while (!s.done && guard++ < 200) s.step(2000);
  return { act, solver: s, diag: core.diagnostics(net, act) };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

test('chuỗi 10 sợi L=0.5, hai đầu ghim cách 10: các sợi căng đều, nút cách đều', () => {
  // Đều nhau theo đối xứng: mỗi sợi kéo dài đến d = 1 (dư 0.5), nên nút i ở x = i
  const n = 11;
  const X0 = [], Y0 = [], pins = [], edges = [], L = [];
  for (let i = 0; i < n; i++) {
    X0.push(i === 10 ? 10 : i * 0.9);
    Y0.push(i % 2 ? 0.3 : 0);
    pins.push(i === 0 || i === n - 1);
    if (i > 0) {
      edges.push([i - 1, i]);
      L.push(0.5);
    }
  }
  const net = core.createNet(X0, Y0, pins, edges, L);
  const { solver, diag } = solve(net);
  assert.ok(solver.converged, 'phải hội tụ');
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(net.X[i] - i) < 1e-3, `x[${i}]=${net.X[i]}`);
    assert.ok(Math.abs(net.Y[i]) < 1e-3, `y[${i}]=${net.Y[i]}`);
  }
  assert.ok(Math.abs(diag.energy - 10 * 0.5 * 0.25) < 1e-3, `E=${diag.energy}`);
});

test('sợi chùng không tạo lực: hai ghim cách 1, chuỗi 2 sợi L=1 → năng lượng 0', () => {
  const net = core.createNet([0, 0.5, 1], [0, 0.3, 0], [true, false, true], [[0, 1], [1, 2]], [1, 1]);
  const { diag } = solve(net);
  assert.ok(diag.energy < 1e-12, `E=${diag.energy}`);
  assert.strictEqual(diag.taut, 0);
});

test('ba sợi đối xứng quanh tâm: tâm đứng yên ở gốc, mỗi sợi dư 0.5', () => {
  // ghim ở bán kính 1.5, sợi L = 1 → mỗi sợi dư 0.5; tâm ở gốc theo đối xứng
  const R = 1.5;
  const X0 = [R, -R / 2, -R / 2, 0.3], Y0 = [0, R * Math.sqrt(3) / 2, -R * Math.sqrt(3) / 2, 0.1];
  const net = core.createNet(X0, Y0, [true, true, true, false], [[0, 3], [1, 3], [2, 3]], [1, 1, 1]);
  const { diag, solver } = solve(net);
  assert.ok(solver.converged);
  assert.ok(Math.abs(net.X[3]) < 1e-4 && Math.abs(net.Y[3]) < 1e-4, `tâm (${net.X[3]}, ${net.Y[3]})`);
  assert.ok(Math.abs(diag.energy - 3 * 0.5 * 0.25) < 1e-6, `E=${diag.energy}`);
});

test('bóc lá: nhánh treo bị loại, đường nối ghim giữ nguyên', () => {
  const X0 = [0, 1, 2, 3, 1, 1.5], Y0 = [0, 0, 0, 0, 1, 1];
  const pins = [true, false, false, true, false, false];
  const edges = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]];
  const net = core.createNet(X0, Y0, pins, edges, [1, 1, 1, 1, 1]);
  const act = core.activeSet(net);
  assert.strictEqual(act.alive[4], 0);
  assert.strictEqual(act.alive[5], 0);
  assert.strictEqual(act.alive[1], 1);
  assert.strictEqual(act.alive[2], 1);
  assert.strictEqual(act.edgeOn[3], 0);
  assert.strictEqual(act.edgeOn[4], 0);
});

test('cụm không đủ 2 ghim bị loại', () => {
  const X0 = [0, 1, 5, 6, 5.5], Y0 = [0, 0, 0, 0, 1];
  const net = core.createNet(X0, Y0, [true, false, false, false, false], [[0, 1], [2, 3], [3, 4], [4, 2]], [1, 1, 1, 1]);
  const act = core.activeSet(net);
  for (const i of [1, 2, 3, 4]) assert.strictEqual(act.alive[i], 0, `node ${i}`);
  assert.strictEqual(act.edgeOn.reduce((a, b) => a + b, 0), 0);
});

test('lưới 40 node, 4 ghim ở góc, kéo giãn: hội tụ, lực dư ~0, đo thời gian', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const lat = core.buildLattice(40, 52, rand);
  const pins = new Array(40).fill(false);
  for (const i of [0, 6, 35, 39]) pins[i] = true;
  // kéo ghim ra xa (nhân tọa độ ghim với 2): sợi căng thật sự
  const X0 = lat.X0.slice(), Y0 = lat.Y0.slice();
  for (const i of [0, 6, 35, 39]) { X0[i] *= 2; Y0[i] *= 2; }
  const net = core.createNet(X0, Y0, pins, lat.edges, lat.lengths);
  const t0 = Date.now();
  const { diag, solver } = solve(net);
  const ms = Date.now() - t0;
  console.log(`   lưới 40 node: ${solver.sweeps} vòng, ${ms} ms, sợi ${diag.ropes}, sợi căng ${diag.taut}, nút tự do ${diag.freeNodes}, E=${diag.energy.toExponential(3)}, lực dư ${diag.maxRes.toExponential(2)}`);
  assert.ok(solver.converged, 'phải hội tụ');
  assert.ok(diag.maxRes < 1e-5, `lực dư ${diag.maxRes}`);
});

test('năng lượng không tăng qua các vòng (lồi, Gauss–Seidel)', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const lat = core.buildLattice(25, 35, rand);
  const pins = new Array(25).fill(false);
  for (const i of [0, 4, 20, 24]) pins[i] = true;
  const X0 = lat.X0.map((v, i) => (pins[i] ? v * 1.8 : v));
  const net = core.createNet(X0, lat.Y0, pins, lat.edges, lat.lengths);
  const act = core.activeSet(net);
  let prev = core.energy(net, act);
  for (let s = 0; s < 300; s++) {
    core.sweep(net, act);
    const e = core.energy(net, act);
    assert.ok(e <= prev + 1e-12, `E tăng tại vòng ${s}: ${prev} → ${e}`);
    prev = e;
  }
});

console.log(`\n${passed} test(s) passed`);

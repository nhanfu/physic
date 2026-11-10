// Giao diện: đặt điểm, vẽ hai chu trình (Held–Karp và chèn xa nhất), bảng so sánh và đo thời gian.
// Toàn bộ thuật toán nằm trong core.js.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const nEl = document.getElementById('n');
const infoEl = document.getElementById('info');
const panelEl = document.getElementById('panel');

const WORLD = 100;           // điểm nằm trong hình vuông [0, WORLD]²
const MAX_POINTS = 60;
const PICK_PX = 12;          // bán kính chọn điểm (px)

let points = [];             // [x, y] trong hệ thế giới
let solution = null;         // {hk, fi, gap, D}
let timing = null;           // kết quả đo thời gian gần nhất (nếu có)
let view = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
let currentCase = null;      // test case đang chọn (nếu có), dùng để hiện độ dài kỳ vọng

// danh sách test case trong ô chọn
const caseSel = document.getElementById('case');
const CASES = tspCases.CASES;
caseSel.innerHTML = '<option value="">— chọn test case —</option>' +
  CASES.map((c) => `<option value="${c.id}">${c.name} (${c.points.length})</option>`).join('');
caseSel.addEventListener('change', () => {
  const c = CASES.find((x) => x.id === caseSel.value);
  if (!c) return;
  currentCase = c;
  setPoints(c.points.map((p) => [p[0], p[1]]));
});

function resize() {
  const dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.floor(view.w * dpr);
  canvas.height = Math.floor(view.h * dpr);
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const side = Math.min(view.w, view.h) * 0.8;
  view.scale = side / WORLD;
  view.ox = (view.w - side) / 2;
  view.oy = (view.h - side) / 2;
  draw();
}

const sx = (x) => view.ox + x * view.scale;
const sy = (y) => view.oy + (WORLD - y) * view.scale;   // trục y hướng lên
const wx = (px) => (px - view.ox) / view.scale;
const wy = (py) => WORLD - (py - view.oy) / view.scale;

function solve() {
  if (points.length < 3) {
    solution = null;
    return;
  }
  const D = core.distanceMatrix(points);
  const fi = core.farthestInsertionTour(D);
  let hk = null, gap = null;
  if (points.length <= 12) {
    hk = core.heldKarpTour(D);
    gap = (fi.length / hk.length - 1) * 100;
  }
  solution = { D, fi, hk, gap };
}

function setPoints(list) {
  points = list;
  // điểm đã đổi (kéo, thêm, xóa) thì không còn là test case đã chọn
  if (currentCase && JSON.stringify(currentCase.points) !== JSON.stringify(list)) currentCase = null;
  timing = null;
  solve();
  draw();
  updateInfo();
  renderPanel();
}

function drawTour(order, color, dashed) {
  if (!order || order.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = dashed ? 2 : 3.5;
  ctx.setLineDash(dashed ? [8, 6] : []);
  ctx.beginPath();
  for (let p = 0; p <= order.length; p++) {
    const q = points[order[p % order.length]];
    const X = sx(q[0]), Y = sy(q[1]);
    if (p === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  if (solution) {
    // chèn xa nhất vẽ trước (nét đứt), Held–Karp vẽ sau để nằm trên
    drawTour(solution.fi.order, '#9fe8ff', true);
    if (solution.hk) drawTour(solution.hk.order, '#ffd79f', false);
  }
  points.forEach((p, i) => {
    const X = sx(p[0]), Y = sy(p[1]);
    ctx.fillStyle = '#cfd8e3';
    ctx.beginPath();
    ctx.arc(X, Y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b95a5';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(String(i + 1), X + 7, Y - 6);
  });
}

function updateInfo() {
  if (points.length < 3) {
    infoEl.textContent = `có ${points.length} điểm, cần ít nhất 3 để tạo chu trình`;
    return;
  }
  if (!solution) return;
  const hk = solution.hk
    ? `Held–Karp ${solution.hk.length.toFixed(3)}`
    : 'Held–Karp: không áp dụng (>12 điểm)';
  const gap = solution.gap === null ? '' : ` · chèn xa nhất lệch +${solution.gap.toFixed(2)}%`;
  const exp = currentCase && currentCase.expected !== undefined && JSON.stringify(currentCase.points) === JSON.stringify(points)
    ? ` · kỳ vọng ${currentCase.expected.toFixed(3)}` : '';
  infoEl.textContent = `${points.length} điểm · ${hk} · chèn xa nhất ${solution.fi.length.toFixed(3)}${gap}${exp}`;
}

function fmtOrder(order) {
  return order.map((i) => i + 1).join(' → ') + ` → ${order[0] + 1}`;
}

function renderPanel() {
  if (!solution) { panelEl.innerHTML = ''; return; }
  const rows = [];
  if (solution.hk) {
    rows.push(`<tr><td>Held–Karp (tối ưu)</td><td>${solution.hk.length.toFixed(3)}</td><td>0.00%</td>` +
      `<td>${timing ? timing.hkMs.toFixed(4) + ' ms' : '—'}</td></tr>` +
      `<tr><td colspan="4" class="ord">${fmtOrder(solution.hk.order)}</td></tr>`);
  }
  rows.push(`<tr><td>chèn xa nhất</td><td>${solution.fi.length.toFixed(3)}</td>` +
    `<td>${solution.gap === null ? '—' : '+' + solution.gap.toFixed(2) + '%'}</td>` +
    `<td>${timing ? timing.fiMs.toFixed(4) + ' ms' : '—'}</td></tr>` +
    `<tr><td colspan="4" class="ord">${fmtOrder(solution.fi.order)}</td></tr>`);
  panelEl.innerHTML =
    `<div class="head">so sánh chu trình (${points.length} điểm)</div>` +
    `<table class="cmp"><tr><th>thuật toán</th><th>độ dài</th><th>lệch</th><th>thời gian</th></tr>${rows.join('')}</table>`;
}

// đo thời gian từng thuật toán trên các điểm hiện tại
function measureNow() {
  if (!solution) return;
  const reps = points.length <= 10 ? 30 : 10;
  const fiMs = core.timeIt(() => core.farthestInsertionTour(solution.D), reps);
  const hkMs = solution.hk ? core.timeIt(() => core.heldKarpTour(solution.D), reps) : null;
  timing = { fiMs, hkMs };
  renderPanel();
}

// bảng thời gian theo số điểm m = 4..12 trên điểm ngẫu nhiên
function timingBench() {
  const rows = [];
  for (let m = 4; m <= 12; m++) {
    const P = core.randomPoints(m, WORLD, WORLD);
    const D = core.distanceMatrix(P);
    const f = core.timeIt(() => core.farthestInsertionTour(D), 20);
    const h = core.timeIt(() => core.heldKarpTour(D), 20);
    rows.push(`<tr><td>${m}</td><td>${f.toFixed(4)} ms</td><td>${h.toFixed(4)} ms</td><td>${(h / f).toFixed(1)}×</td></tr>`);
  }
  panelEl.innerHTML =
    `<div class="head">thời gian theo số điểm (trung vị 20 lần, sau khởi động)</div>` +
    `<table class="cmp"><tr><th>điểm</th><th>chèn xa nhất</th><th>Held–Karp</th><th>HK / FI</th></tr>` +
    rows.join('') + `</table>`;
}

// ---- chuột ----
let drag = null; // {index, moved}

function pickIndex(px, py) {
  let best = -1, bestD = PICK_PX;
  points.forEach((p, i) => {
    const d = Math.hypot(px - sx(p[0]), py - sy(p[1]));
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function localPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  const p = localPoint(ev);
  const i = pickIndex(p.x, p.y);
  drag = i >= 0 ? { index: i, moved: false } : { index: -1, moved: false, addAt: [wx(p.x), wy(p.y)] };
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag || drag.index < 0) return;
  const p = localPoint(ev);
  drag.moved = true;
  const q = [Math.min(WORLD, Math.max(0, wx(p.x))), Math.min(WORLD, Math.max(0, wy(p.y)))];
  points[drag.index] = q;
  solve();
  draw();
  updateInfo();
  renderPanel();
});

canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.index < 0 && !drag.moved && points.length < MAX_POINTS) {
    setPoints([...points, drag.addAt]);
  } else if (drag.index >= 0) {
    setPoints(points.slice()); // cập nhật bảng sau khi kéo xong
  }
  drag = null;
});

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  const p = localPoint(ev);
  const i = pickIndex(p.x, p.y);
  if (i >= 0 && points.length > 1) setPoints(points.filter((_, k) => k !== i));
});

// ---- nút ----
document.getElementById('rand').addEventListener('click', () => {
  const n = Math.min(MAX_POINTS, Math.max(3, parseInt(nEl.value, 10) || 8));
  setPoints(core.randomPoints(n, WORLD, WORLD).map(([x, y]) => [5 + x * 0.9, 5 + y * 0.9]));
});
document.getElementById('clear').addEventListener('click', () => setPoints([]));
document.getElementById('cmp').addEventListener('click', () => { measureNow(); updateInfo(); });
document.getElementById('timing').addEventListener('click', () => timingBench());

window.addEventListener('resize', resize);
resize();
setPoints(core.randomPoints(8, WORLD, WORLD).map(([x, y]) => [5 + x * 0.9, 5 + y * 0.9]));

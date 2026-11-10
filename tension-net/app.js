// Giao diện: vẽ mạng sợi, kéo ghim, zoom/pan. Toàn bộ vật lý nằm trong core.js.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const infoEl = document.getElementById('info');
const nEl = document.getElementById('n');
const mEl = document.getElementById('m');
const pEl = document.getElementById('p');

let net = null;   // đồ thị hiện tại (vị trí, ghim, sợi, chiều dài)
let act = null;   // phần tham gia cân bằng (bóc lá, cụm thiếu ghim)
let solver = null;
let homeX = [], homeY = [];

// khung nhìn
const view = { w: 0, h: 0, cx: 0, cy: 0, ppm: 60, zoom: 1, panX: 0, panY: 0, fit: 60 };

function sx(x) { return view.w / 2 + view.panX + view.ppm * (x - view.cx); }
function sy(y) { return view.h / 2 + view.panY + view.ppm * (y - view.cy); }
function wx(px) { return view.cx + (px - view.w / 2 - view.panX) / view.ppm; }
function wy(py) { return view.cy + (py - view.h / 2 - view.panY) / view.ppm; }

function fitView() {
  if (!net) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < net.N; i++) {
    minX = Math.min(minX, homeX[i]); maxX = Math.max(maxX, homeX[i]);
    minY = Math.min(minY, homeY[i]); maxY = Math.max(maxY, homeY[i]);
  }
  view.cx = (minX + maxX) / 2;
  view.cy = (minY + maxY) / 2;
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  view.fit = Math.min((view.w * 0.8) / bw, (view.h * 0.75) / bh);
  view.ppm = view.fit * view.zoom;
}

function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  fitView();
}

function zoomAt(cx, cy, factor) {
  const nz = Math.min(8, Math.max(0.25, view.zoom * factor));
  const f = nz / view.zoom;
  if (f === 1) return;
  const wxc = wx(cx), wyc = wy(cy);
  view.zoom = nz;
  view.ppm = view.fit * nz;
  // giữ điểm dưới con trỏ đứng yên
  view.panX = cx - view.w / 2 - view.ppm * (wxc - view.cx);
  view.panY = cy - view.h / 2 - view.ppm * (wyc - view.cy);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.floor(view.w * dpr);
  canvas.height = Math.floor(view.h * dpr);
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitView();
}

// dựng lưới mới: các ghim đặt ở bốn góc (gần đúng) rồi kéo giãn ra
function generate() {
  const n = parseInt(nEl.value, 10) || 40;
  const m = parseInt(mEl.value, 10) || 52;
  const pNum = Math.max(2, Math.min(n, parseInt(pEl.value, 10) || 4));
  const lat = core.buildLattice(n, m);
  const cols = lat.cols;
  const rows = Math.ceil(lat.X0.length / cols);
  // ghim: các góc, rồi các điểm còn lại trên biên trên/dưới
  const cand = [0, cols - 1, (rows - 1) * cols, lat.X0.length - 1];
  const pinIdx = [];
  for (const c of cand) if (c >= 0 && c < n && !pinIdx.includes(c) && pinIdx.length < pNum) pinIdx.push(c);
  for (let i = 0; pinIdx.length < pNum && i < n; i++) if (!pinIdx.includes(i)) pinIdx.push(i);
  const pins = new Array(n).fill(false);
  for (const i of pinIdx) pins[i] = true;
  // kéo ghim ra xa so với lưới ban đầu để sợi căng
  const X0 = lat.X0.slice(), Y0 = lat.Y0.slice();
  for (const i of pinIdx) { X0[i] *= 1.6; Y0[i] *= 1.6; }
  homeX = X0.slice();
  homeY = Y0.slice();
  net = core.createNet(X0, Y0, pins, lat.edges, lat.lengths);
  rebuild(2e-3);
  resetView();
}

// tính lại phần tham gia cân bằng và chạy bộ giải
function rebuild() {
  act = core.activeSet(net);
  solver = new core.Solver(net, act, { tol: 1e-9 });
}

function pinCount() {
  let c = 0;
  for (let i = 0; i < net.N; i++) if (net.pin[i]) c++;
  return c;
}

// node gần nhất trong bán kính chọn (px)
function pick(px, py) {
  let best = -1, bestD = 16;
  for (let i = net.N - 1; i >= 0; i--) {
    const d = Math.hypot(px - sx(net.X[i]), py - sy(net.Y[i]));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ---- chuột ----
let drag = null; // {kind:'node', i, moved, sx0, sy0} | {kind:'pan', x, y}

function localPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!net) return;
  const p = localPoint(ev);
  const i = pick(p.x, p.y);
  if (i >= 0) {
    drag = { kind: 'node', i, moved: false, sx0: p.x, sy0: p.y };
  } else {
    drag = { kind: 'pan', x: p.x, y: p.y };
  }
  canvas.setPointerCapture(ev.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const p = localPoint(ev);
  if (drag.kind === 'pan') {
    view.panX += p.x - drag.x;
    view.panY += p.y - drag.y;
    drag.x = p.x;
    drag.y = p.y;
    return;
  }
  if (!drag.moved && Math.hypot(p.x - drag.sx0, p.y - drag.sy0) < 4) return;
  if (!drag.moved) {
    drag.moved = true;
    if (!net.pin[drag.i]) {
      // kéo nút tự do thì ghim nó tại vị trí thả
      net.pin[drag.i] = 1;
      rebuild();
    }
  }
  net.X[drag.i] = wx(p.x);
  net.Y[drag.i] = wy(p.y);
  homeX[drag.i] = net.X[drag.i];
  homeY[drag.i] = net.Y[drag.i];
  solver = new core.Solver(net, act, { tol: 1e-9 });
});

function endDrag() {
  if (!drag) return;
  if (drag.kind === 'node' && !drag.moved) {
    // click: đảo trạng thái ghim
    net.pin[drag.i] = net.pin[drag.i] ? 0 : 1;
    rebuild();
  }
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const p = localPoint(ev);
  zoomAt(p.x, p.y, Math.exp(-ev.deltaY * 0.0015));
}, { passive: false });

canvas.addEventListener('dblclick', () => resetView());

// kéo giãn: nhân các ghim quanh tâm lưới với hệ số 1.2
document.getElementById('pull').addEventListener('click', () => {
  if (!net) return;
  let cx = 0, cy = 0, c = 0;
  for (let i = 0; i < net.N; i++) if (net.pin[i]) { cx += net.X[i]; cy += net.Y[i]; c++; }
  cx /= c; cy /= c;
  for (let i = 0; i < net.N; i++) if (net.pin[i]) {
    net.X[i] = cx + (net.X[i] - cx) * 1.2;
    net.Y[i] = cy + (net.Y[i] - cy) * 1.2;
  }
  rebuild();
});

document.getElementById('gen').addEventListener('click', generate);
document.getElementById('view').addEventListener('click', resetView);

// ---- vẽ ----
function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  if (!net) return;
  const { X, Y, N, edges, L, pin } = net;

  // sợi: căng (sáng), chùng (xám), loại khỏi cân bằng (rất nhạt)
  edges.forEach(([a, b], k) => {
    const d = Math.hypot(X[b] - X[a], Y[b] - Y[a]);
    let color, width;
    if (!act.edgeOn[k]) { color = '#1f262e'; width = 1; }
    else if (d > L[k] + 1e-9) { color = '#9fe8ff'; width = 2.5; }
    else { color = '#4a5563'; width = 1.2; }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(sx(X[a]), sy(Y[a]));
    ctx.lineTo(sx(X[b]), sy(Y[b]));
    ctx.stroke();
  });

  // nút
  for (let i = 0; i < N; i++) {
    const x = sx(X[i]), y = sy(Y[i]);
    if (pin[i]) {
      ctx.fillStyle = '#ffd79f';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (act.alive[i]) {
      ctx.fillStyle = '#cfd8e3';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#2a313b';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function updateInfo() {
  if (!net) return;
  const d = core.diagnostics(net, act);
  const status = solver.done ? (solver.converged ? 'cân bằng' : 'dừng (chưa hội tụ)') : 'đang tính';
  infoEl.textContent =
    `ghim ${pinCount()} · sợi căng ${d.taut}/${d.ropes} · nút tự do ${d.freeNodes} · ` +
    `tổng chiều dài sợi căng ${d.total.toFixed(3)} · E = ${d.energy.toExponential(3)} · lực dư ${d.maxRes.toExponential(1)} · ${status}`;
}

let frameNo = 0;
function frame() {
  if (net && solver && !solver.done) solver.step(300);
  draw();
  if (++frameNo % 10 === 0) updateInfo();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
generate();
requestAnimationFrame(frame);

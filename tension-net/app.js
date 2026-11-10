// Giao diện 3D: xoay/zoom, ghim trên mặt phẳng trần, làm mờ node ở nửa dưới, tô màu sợi căng.
// Toàn bộ vật lý nằm trong core.js.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const infoEl = document.getElementById('info');
const colsEl = document.getElementById('cols');
const rowsEl = document.getElementById('rows');
const mEl = document.getElementById('m');
const pEl = document.getElementById('p');

const KAPPA = 50;  // độ cứng sợi (g/κ quyết định độ võng của lưới)
const G = 1;        // trọng lực
const FADE_FRAC = 0.5; // node có y > FADE_FRAC · y_max (nửa dưới) được làm mờ khi cân bằng

let net = null, act = null, solver = null;
let tourState = null; // {order, used, edges, length}: chu trình đang hiển thị
let tourAnim = null;  // {stages, i, nextT}: hoạt ảnh các bước chèn xa nhất
let hoverSeg = null;  // đoạn chu trình đang được rê chuột vào
let renderedTour = null;
let phaseMsg = null;   // thông báo giai đoạn khi chưa có chu trình để hiển thị
let renderedPhase = null;
let settleStart = 0;   // thời điểm bắt đầu cân bằng hiện tại
let settleMs = null;   // thời gian cân bằng lần gần nhất (ms)
let autoTourPending = false; // tự chạy hoạt ảnh khi lưới vừa cân bằng xong
const STAGE_MS = 1200;
const ANIMATE = false; // tắt hoạt ảnh các bước: chỉ hiện kết quả cuối (để so sánh thời gian)
let cols = 0, rows = 0;
let cx = 0, cz = 0; // tâm tham chiếu của lưới ban đầu (trong mặt phẳng)

// góc nhìn: xoay quanh trục y (yaw) và trục x (pitch); zoom; ppm = điểm ảnh trên đơn vị
const view = { w: 0, h: 0, yaw: 0.6, pitch: 0.9, zoom: 1, ppm: 40, fit: 40 };
let M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function updateMatrix() {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  // Ry(yaw)
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  // Rx(pitch)
  const Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  M = [0, 1, 2].map((r) => [0, 1, 2].map((c) => Rx[r][0] * Ry[0][c] + Rx[r][1] * Ry[1][c] + Rx[r][2] * Ry[2][c]));
}

// chiếu trực giao: màn hình = tâm + ppm·(M·(p − c)) (y hướng xuống, khớp trục màn hình)
function proj(x, y, z) {
  const dx = x - cx, dy = y, dz = z - cz;
  return [
    view.w / 2 + view.ppm * (M[0][0] * dx + M[0][1] * dy + M[0][2] * dz),
    view.h / 2 + view.ppm * (M[1][0] * dx + M[1][1] * dy + M[1][2] * dz),
  ];
}

// giao tia màn hình (u, v) với mặt phẳng y = y0 → (x, z)
function unprojectPlane(u, v, y0) {
  const r0 = (u - view.w / 2) / view.ppm;
  const r1 = (v - view.h / 2) / view.ppm;
  const dy = y0;
  const A = r0 - M[0][1] * dy;
  const B = r1 - M[1][1] * dy;
  const a = M[0][0], b = M[0][2], c = M[1][0], d = M[1][2];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return [cx, cz];
  const dx = (A * d - b * B) / det;
  const dz = (a * B - c * A) / det;
  return [cx + dx, cz + dz];
}

function fitView() {
  view.fit = 0.42 * Math.min(view.w, view.h) / (Math.max(cols, rows) / 2 + 1);
  view.ppm = view.fit * view.zoom;
}

function resetView() {
  view.yaw = 0.6;
  view.pitch = 0.9;
  view.zoom = 1;
  fitView();
  updateMatrix();
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

// chu vi lưới theo thứ tự vòng quanh (trên, phải, dưới, trái)
function perimeter(c, r) {
  const out = [];
  for (let k = 0; k < c; k++) out.push(k);
  for (let k = 1; k < r; k++) out.push(k * c + (c - 1));
  for (let k = c - 2; k >= 0; k--) out.push((r - 1) * c + k);
  for (let k = r - 2; k >= 1; k--) out.push(k * c);
  return out;
}

function generate() {
  cols = Math.max(2, parseInt(colsEl.value, 10) || 12);
  rows = Math.max(2, parseInt(rowsEl.value, 10) || 7);
  const m = parseInt(mEl.value, 10) || 160;
  const pNum = Math.max(2, parseInt(pEl.value, 10) || 8);
  const n = cols * rows;
  // ghim: rải đều dọc chu vi lưới (kể cả bốn góc)
  const per = perimeter(cols, rows);
  const k = Math.min(pNum, per.length);
  const pinIdx = [];
  for (let j = 0; j < k; j++) pinIdx.push(per[Math.floor((j * per.length) / k)]);
  // chiều dài sợi ≥ khoảng cách ban đầu: lưới khởi đầu không bị giãn
  const sh = core.buildSheet(cols, rows, m, Math.random, 1.0, 1.2, pinIdx);
  const pinSet = new Set(pinIdx);
  const pins = sh.P.map((_, i) => pinSet.has(i));
  // kéo các ghim ra xa để sợi căng
  net = core.createNet(sh.P, pins, sh.edges, sh.L, KAPPA, G);
  cx = 0;
  cz = 0;
  rebuild();
  resetView();
}

function rebuild() {
  settleStart = performance.now();
  settleMs = null;
  tourState = null;
  tourAnim = null;
  autoTourPending = true;
  // node thừa (ngoài chu trình) bị loại trước khi cân bằng
  act = core.cyclePrune(net, core.activeSet(net));
  solver = new core.Solver(net, act, { tol: 1e-7, maxSweeps: 50000 });
}

function pinCount() {
  let c = 0;
  for (let i = 0; i < net.N; i++) if (net.pin[i]) c++;
  return c;
}

function pick(px, py) {
  let best = -1, bestD = 14;
  for (let i = net.N - 1; i >= 0; i--) {
    if (!act.alive[i] && !net.pin[i]) continue;
    const [sxp, syp] = proj(net.X[i], net.Y[i], net.Z[i]);
    const d = Math.hypot(px - sxp, py - syp);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// ---- chuột ----
let drag = null;

function localPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!net) return;
  const p = localPoint(ev);
  const i = pick(p.x, p.y);
  drag = i >= 0
    ? { kind: 'node', i, moved: false, sx0: p.x, sy0: p.y }
    : { kind: 'rotate', x: p.x, y: p.y };
  canvas.setPointerCapture(ev.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const p = localPoint(ev);
  if (drag.kind === 'rotate') {
    view.yaw += (p.x - drag.x) * 0.008;
    view.pitch = Math.min(1.55, Math.max(0.05, view.pitch + (p.y - drag.y) * 0.008));
    drag.x = p.x;
    drag.y = p.y;
    updateMatrix();
    return;
  }
  if (!drag.moved && Math.hypot(p.x - drag.sx0, p.y - drag.sy0) < 4) return;
  const i = drag.i;
  if (!drag.moved) {
    drag.moved = true;
    if (!net.pin[i]) { net.pin[i] = 1; rebuild(); }
    tourAnim = null;
    tourState = null;
    autoTourPending = true;
  }
  // node được ghim kéo trên mặt phẳng y = y_i của nó
  const [nx, nz] = unprojectPlane(p.x, p.y, net.Y[i]);
  net.X[i] = nx;
  net.Z[i] = nz;
  solver = new core.Solver(net, act, { tol: 1e-7, maxSweeps: 50000 });
});

function endDrag() {
  if (!drag) return;
  if (drag.kind === 'node' && !drag.moved) {
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
  view.zoom = Math.min(6, Math.max(0.3, view.zoom * Math.exp(-ev.deltaY * 0.0015)));
  view.ppm = view.fit * view.zoom;
}, { passive: false });

canvas.addEventListener('dblclick', () => resetView());

document.getElementById('gen').addEventListener('click', generate);

// các đoạn của chu trình: với mỗi cặp ghim liền kề, đường ngắn nhất (theo sợi) giữa chúng
function tourSegments(order, trees) {
  const segs = [];
  const m = order.length;
  for (let p = 0; p < m; p++) {
    const s0 = order[p], t0 = order[(p + 1) % m];
    const nodes = core.pathNodes(trees, s0, t0);
    const edges = new Set();
    let len = 0;
    for (let q = 1; q < nodes.length; q++) {
      const x = nodes[q - 1], y = nodes[q];
      for (const [v, k] of act.nbE[y]) if (v === x) { edges.add(k); len += net.L[k]; break; }
    }
    segs.push({ from: s0, to: t0, nodes, nodeSet: new Set(nodes), edges, length: len });
  }
  return segs;
}

// thời gian một hàm: khởi động JIT một lần rồi lấy trung vị của reps lần chạy (ms)
function timeIt(fn, reps) {
  fn();
  const xs = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    xs.push(performance.now() - t0);
  }
  return Math.max(medianOf(xs), 1e-3); // tránh 0 khi đồng hồ làm tròn
}

// so sánh Held–Karp (tối ưu, m ≤ 12) với chèn xa nhất trên cùng ma trận D
function compareTours(D) {
  const reps = D.length <= 10 ? 30 : 10;
  const fi = core.farthestInsertionTour(D);
  const fiMs = timeIt(() => core.farthestInsertionTour(D), reps);
  if (D.length < 3 || D.length > 12) return { hk: null, fi: { length: fi.length, order: fi.order, ms: fiMs }, gap: null };
  const hk = core.heldKarpTour(D);
  const hkMs = timeIt(() => core.heldKarpTour(D), reps);
  return {
    hk: { length: hk.length, order: hk.order, ms: hkMs },
    fi: { length: fi.length, order: fi.order, ms: fiMs },
    gap: (fi.length / hk.length - 1) * 100,
  };
}

// dựng các bước của chu trình: mỗi bước là chu trình trên các ghim đã chèn tới lúc đó
function buildTourStages() {
  const pinIdx = [];
  for (let i = 0; i < net.N; i++) if (net.pin[i]) pinIdx.push(i);
  if (pinIdx.length < 3) return null;
  const trees = core.shortestTrees(net, act, pinIdx);
  const D = core.pinDistancesT(trees, pinIdx);
  const best = core.bestTour(D);
  const cycleLen = (snap) => {
    let len = 0;
    for (let p = 0; p < snap.length; p++) len += D[snap[p]][snap[(p + 1) % snap.length]];
    return len;
  };
  const makeStage = (snap, extra) => {
    const order = snap.map((k) => pinIdx[k]);
    const segments = tourSegments(order, trees);
    const edges = new Set();
    const nodes = new Set();
    segments.forEach((sg) => {
      sg.edges.forEach((k) => edges.add(k));
      sg.nodeSet.forEach((n) => nodes.add(n));
    });
    return {
      order,
      used: core.usedNodesT(net, trees, order),
      segments,
      edges,
      nodes,
      length: cycleLen(snap),
      ...extra,
    };
  };
  // giai đoạn 1: chèn xa nhất chạy từng bước, đến khi hoàn tất
  const t = core.farthestInsertionTour(D);
  const snapsA = t.snapshots.slice(1);
  const stages = snapsA.map((snap, i) => makeStage(snap, {
    title: i === snapsA.length - 1 ? 'chèn xa nhất · hoàn tất' : `chèn xa nhất · bước ${i + 1}/${snapsA.length}`,
    final: false,
  }));
  // so sánh (chỉ tính khi có Held–Karp)
  const cmp = compareTours(D);
  const toIds = (o) => (o ? o.map((k) => pinIdx[k] + 1) : null);
  const cmpView = {
    hk: cmp.hk ? { ...cmp.hk, ids: toIds(cmp.hk.order) } : null,
    fi: { ...cmp.fi, ids: toIds(cmp.fi.order) },
    gap: cmp.gap,
  };
  if (best.exact) {
    // giai đoạn 2: Held–Karp chạy sau khi chèn xa nhất đã xong, rồi hiện kết quả tối ưu
    stages.push({ pending: true, title: 'Held–Karp đang chạy…' });
    const pct = best.heuristicLength > 0 ? (best.heuristicLength / best.length - 1) * 100 : 0;
    const label = pct < 1e-9
      ? 'Held–Karp: tối ưu, trùng chèn xa nhất'
      : `Held–Karp: tối ưu, chèn xa nhất lệch +${pct.toFixed(2)}%`;
    stages.push(makeStage(best.order, { title: 'Held–Karp · tối ưu', final: true, label, cmp: cmpView }));
  } else {
    const last = stages[stages.length - 1];
    last.final = true;
    last.label = 'xấp xỉ (chèn xa nhất; m > 12 nên không tính tối ưu)';
    last.cmp = cmpView;
  }
  return stages;
}

function startTourAnim(now) {
  const stages = buildTourStages();
  if (!stages) { autoTourPending = false; return; }
  autoTourPending = false;
  if (!ANIMATE) {
    // không hoạt ảnh: hiện ngay kết quả cuối
    tourAnim = null;
    phaseMsg = null;
    tourState = stages[stages.length - 1];
    return;
  }
  tourAnim = { stages, i: 0, nextT: now };
}

// danh sách các đoạn của chu trình hiện tại; rê chuột vào mục nào thì đoạn đó được làm sáng
function cmpTable(cmp) {
  if (!cmp) return '';
  const row = (name, r, extra) => `<tr><td>${name}</td><td>${r.length.toFixed(3)}</td><td>${extra}</td>` +
    `<td>${r.ms.toFixed(4)} ms</td></tr><tr><td colspan="4" class="ord">${r.ids.join(' → ')}</td></tr>`;
  const hk = cmp.hk
    ? row('Held–Karp (tối ưu)', cmp.hk, '0.00%')
    : '<tr><td colspan="4">Held–Karp chỉ dùng khi có 3–12 ghim</td></tr>';
  const fi = row('chèn xa nhất', cmp.fi, cmp.gap === null ? '—' : `+${cmp.gap.toFixed(2)}%`);
  return `<table class="cmp"><tr><th>thuật toán</th><th>độ dài</th><th>lệch</th><th>thời gian (trung vị)</th></tr>${hk}${fi}</table>`;
}

function renderTourList() {
  const box = document.getElementById('tourlist');
  if (!tourState) {
    box.innerHTML = phaseMsg ? `<div class="head">${phaseMsg}</div>` : '';
    hoverSeg = null;
    return;
  }
  const rows = tourState.segments.map((sg, i) => {
    const seq = sg.nodes.map((n) => n + 1).join(' → ');
    return `<div class="seg" data-i="${i}"><b>${i + 1}. ghim ${sg.from + 1} → ghim ${sg.to + 1}</b> · ` +
      `${sg.edges.size} sợi · ${sg.length.toFixed(3)}<br><span class="nodes">${seq}</span></div>`;
  });
  const done = tourState.final && !tourAnim
    ? `<div class="done">✓ thuật toán hoàn tất: ${tourState.order.length} ghim, ${tourState.segments.length} đoạn, tổng dài ${tourState.length.toFixed(3)}<br>${tourState.label}</div>` +
      cmpTable(tourState.cmp)
    : '';
  box.innerHTML = `<div class="head">${tourState.title} · chu trình ${tourState.order.map((n) => n + 1).join(' → ')} → ${tourState.order[0] + 1} · ` +
    `dài ${tourState.length.toFixed(3)}</div>` + rows.join('') + done;
  hoverSeg = null;
}

document.getElementById('tourlist').addEventListener('mouseover', (ev) => {
  const el = ev.target.closest('.seg');
  hoverSeg = el ? +el.dataset.i : null;
});
document.getElementById('tourlist').addEventListener('mouseleave', () => { hoverSeg = null; });

document.getElementById('tour').addEventListener('click', () => {
  if (!net || !solver.done) return;
  startTourAnim(performance.now());
});


document.getElementById('view').addEventListener('click', resetView);

// ---- vẽ ----
function lerpColor(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, k) => Math.round(v + (pb[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function fadedSet() {
  // node tự do ở nửa dưới (y > FADE_FRAC · y_max) sau khi cân bằng xong
  const faded = new Uint8Array(net.N);
  if (!solver.done) return faded;
  let ymax = 0;
  for (let i = 0; i < net.N; i++) if (!net.pin[i] && act.alive[i]) ymax = Math.max(ymax, net.Y[i]);
  for (let i = 0; i < net.N; i++) {
    if (!net.pin[i] && act.alive[i] && net.Y[i] > FADE_FRAC * ymax) faded[i] = 1;
  }
  return faded;
}

function drawPlane(y, label, color) {
  const hx = cols / 2 + 0.5, hz = rows / 2 + 0.5;
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => proj(x + cx, y, z + cz));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  corners.forEach(([u, v], k) => (k ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(label, corners[0][0] + 4, corners[0][1] - 4);
}

let lastStats = null;

function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  if (!net) return;
  const { X, Y, Z, N, edges, L, pin } = net;
  const faded = fadedSet();

  drawPlane(0, 'trần (y = 0)', '#2c3a4a');
  drawPlane(Math.max(1, ...Array.from(Y)), 'sàn (lưới rơi xuống)', '#2a2a33');

  // sợi
  let smax = 1e-9;
  if (lastStats) smax = Math.max(lastStats.maxStretch, 1e-9);
  edges.forEach(([a, b], k) => {
    if (!act.edgeOn[k]) return;
    const d = Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]);
    const s = d - L[k];
    const onTour = tourState && tourState.edges.has(k);
    const hs = hoverSeg !== null && tourState ? tourState.segments[hoverSeg] : null;
    const dim = faded[a] || faded[b] || (tourState && !(tourState.used[a] && tourState.used[b]));
    ctx.globalAlpha = dim ? 0.15 : (hs && onTour && !hs.edges.has(k) ? 0.35 : 1);
    if (onTour && hs && hs.edges.has(k)) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
    } else if (onTour) {
      ctx.strokeStyle = '#ffd79f';
      ctx.lineWidth = 4;
    } else if (s > 1e-9) {
      const t = Math.min(1, s / smax);
      ctx.strokeStyle = lerpColor('#9fe8ff', '#ff5a3c', t);
      ctx.lineWidth = 1.5 + 2.5 * t;
    } else {
      ctx.strokeStyle = '#3a4450';
      ctx.lineWidth = 1;
    }
    const [u1, v1] = proj(X[a], Y[a], Z[a]);
    const [u2, v2] = proj(X[b], Y[b], Z[b]);
    ctx.beginPath();
    ctx.moveTo(u1, v1);
    ctx.lineTo(u2, v2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // node
  for (let i = 0; i < N; i++) {
    if (!pin[i] && !act.alive[i]) continue;
    const [u, v] = proj(X[i], Y[i], Z[i]);
    const hideTour = tourState && !tourState.used[i] && !pin[i];
    const onTour = tourState && tourState.nodes.has(i);
    ctx.globalAlpha = faded[i] || hideTour ? 0.2 : 1;
    if (pin[i]) {
      const hsP = hoverSeg !== null && tourState ? tourState.segments[hoverSeg] : null;
      ctx.fillStyle = hsP && hsP.nodeSet.has(i) ? '#ffffff' : '#ffd79f';
      ctx.beginPath();
      ctx.arc(u, v, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (onTour) {
      const hsN = hoverSeg !== null && tourState ? tourState.segments[hoverSeg] : null;
      ctx.fillStyle = hsN && hsN.nodeSet.has(i) ? '#ffffff' : '#ffd79f';
      ctx.beginPath();
      ctx.arc(u, v, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#cfd8e3';
      ctx.beginPath();
      ctx.arc(u, v, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function updateInfo() {
  if (!net) return;
  const d = core.diagnostics(net, act);
  lastStats = d;
  const faded = fadedSet();
  let nFaded = 0;
  for (let i = 0; i < net.N; i++) nFaded += faded[i];
  const status = solver.done ? (solver.converged ? 'cân bằng' : 'dừng (chưa hội tụ)') : 'đang tính';
  const timeTxt = settleMs !== null ? ` · cân bằng trong ${settleMs.toFixed(1)} ms` : '';
  const tourTxt = tourState
    ? ` · chu trình ${tourState.order.join('→')}→${tourState.order[0]}, dài ${tourState.length.toFixed(4)}`
    : '';
  infoEl.textContent =
    `ghim ${pinCount()} · sợi căng ${d.taut}/${d.ropes} · độ giãn tối đa ${d.maxStretch.toExponential(2)} · ` +
    `làm mờ ${nFaded} node · E = ${d.energy.toFixed(3)} · lực dư ${d.maxRes.toExponential(1)} · ${status}` + timeTxt + tourTxt;
}

// so sánh trên nhiều lưới ngẫu nhiên: khoảng cách chỉ phụ thuộc L nên không cần cân bằng lực
function compareBatch(trials) {
  const pNum = Math.max(2, parseInt(pEl.value, 10) || 8);
  const c = Math.max(2, parseInt(colsEl.value, 10) || 12);
  const r = Math.max(2, parseInt(rowsEl.value, 10) || 7);
  const m = parseInt(mEl.value, 10) || 160;
  const per = perimeter(c, r);
  const k = Math.min(pNum, per.length);
  const pinIdx = [];
  for (let j = 0; j < k; j++) pinIdx.push(per[Math.floor((j * per.length) / k)]);
  let optimal = 0, worst = 0, sumGap = 0, sumHk = 0, sumFi = 0, n = 0;
  for (let t = 0; t < trials; t++) {
    const sh = core.buildSheet(c, r, m, Math.random, 1.0, 1.2, pinIdx);
    const pinSet = new Set(pinIdx);
    const pins = sh.P.map((_, i) => pinSet.has(i));
    const g = core.createNet(sh.P, pins, sh.edges, sh.L, KAPPA, G);
    const act0 = core.activeSet(g);
    const D = core.pinDistancesT(core.shortestTrees(g, act0, pinIdx), pinIdx);
    const cmp = compareTours(D);
    n++;
    if (cmp.gap === null) continue;
    sumGap += cmp.gap;
    worst = Math.max(worst, cmp.gap);
    if (cmp.gap < 1e-9) optimal++;
    sumHk += cmp.hk.ms;
    sumFi += cmp.fi.ms;
  }
  const box = document.getElementById('cmpbox');
  box.innerHTML = `<div class="head">so sánh ${n} lưới (${k} ghim)</div>` +
    `<table class="cmp"><tr><th>chỉ số</th><th>giá trị</th></tr>` +
    `<tr><td>chèn xa nhất = tối ưu</td><td>${optimal}/${n}</td></tr>` +
    `<tr><td>lệch trung bình</td><td>+${(sumGap / n).toFixed(3)}%</td></tr>` +
    `<tr><td>lệch tệ nhất</td><td>+${worst.toFixed(3)}%</td></tr>` +
    `<tr><td>thời gian Held–Karp TB</td><td>${(sumHk / n).toFixed(2)} ms</td></tr>` +
    `<tr><td>thời gian chèn xa nhất TB</td><td>${(sumFi / n).toFixed(3)} ms</td></tr></table>`;
}
document.getElementById('cmp').addEventListener('click', () => compareBatch(30));

// đo thời gian từng thuật toán theo số ghim m = 4..12 (trung vị các lần lặp, khoảng cách Euclid ngẫu nhiên)
function medianOf(xs) {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function timingBench(reps) {
  const rows = [];
  for (let m = 4; m <= 12; m++) {
    const P = Array.from({ length: m }, () => [Math.random() * 10, Math.random() * 10]);
    const D = P.map((p) => P.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
    const f = timeIt(() => core.farthestInsertionTour(D), reps);
    const h = timeIt(() => core.heldKarpTour(D), reps);
    rows.push(`<tr><td>${m}</td><td>${f.toFixed(3)} ms</td><td>${h.toFixed(3)} ms</td><td>${(h / f).toFixed(1)}×</td></tr>`);
  }
  const cur = tourState && tourState.cmp && tourState.cmp.hk
    ? `<div class="head">lưới hiện tại: cân bằng ${settleMs !== null ? settleMs.toFixed(1) + ' ms' : '—'} · ` +
      `chèn xa nhất ${tourState.cmp.fi.ms.toFixed(3)} ms · Held–Karp ${tourState.cmp.hk.ms.toFixed(3)} ms</div>`
    : '';
  document.getElementById('cmpbox').innerHTML = cur +
    `<div class="head">thời gian chạy theo số ghim (trung vị ${reps} lần, sau khởi động)</div>` +
    `<table class="cmp"><tr><th>ghim</th><th>chèn xa nhất</th><th>Held–Karp</th><th>HK / FI</th></tr>` +
    rows.join('') + `</table>`;
}
document.getElementById('timing').addEventListener('click', () => timingBench(20));

const SWEEPS_PER_FRAME = 40;
let frameNo = 0;
function frame(now) {
  if (net && solver && !solver.done) {
    solver.step(SWEEPS_PER_FRAME);
    if (solver.done && settleMs === null) settleMs = performance.now() - settleStart;
  }
  if (net && solver && solver.done && autoTourPending && pinCount() >= 3) startTourAnim(now);
  if (tourAnim && now >= tourAnim.nextT) {
    const st = tourAnim.stages[tourAnim.i];
    if (st.pending) {
      tourState = null;
      phaseMsg = st.title;
    } else {
      tourState = st;
      phaseMsg = null;
    }
    tourAnim.i++;
    if (tourAnim.i >= tourAnim.stages.length) tourAnim = null;
    else tourAnim.nextT = now + STAGE_MS;
  }
  if (tourState !== renderedTour || phaseMsg !== renderedPhase) {
    renderedTour = tourState;
    renderedPhase = phaseMsg;
    renderTourList();
  }
  draw();
  if (++frameNo % 10 === 0) updateInfo();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
generate();
requestAnimationFrame(frame);

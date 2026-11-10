const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const energyEl = document.getElementById("energy");
const frictionEl = document.getElementById("friction");
const frictionValEl = document.getElementById("friction-val");
const linksValEl = document.getElementById("links-val");
const lessBtn = document.getElementById("less");
const moreBtn = document.getElementById("more");
const linkModeBtn = document.getElementById("linkmode");
const linkHintEl = document.getElementById("link-hint");
const netBtn = document.getElementById("net");
const chainBtn = document.getElementById("chain");
const netNEl = document.getElementById("net-n");
const netEEl = document.getElementById("net-e");

const G = 9.81;
const DT = 0.001;
const ITER = 20; // số vòng lặp chiếu ràng buộc mỗi bước con
const TRAIL_MAX = 500;
const PICK_RADIUS = 28;
const MAX_NET_NODES = 100;

// Mô hình: mỗi node là một quả nặng (khối lượng 1) với vị trí (X, Y) tính bằng mét,
// trục y hướng xuống. Các rod là ràng buộc khoảng cách cứng: |p_a - p_b| = L.
// EDGES[k] = {a, b, L}; chỉ số -1 là điểm treo cố định tại (0, 0).
// Node ghim (PIN) đứng yên tại (PX, PY).
let N = 0;
let X = [], Y = [], VX = [], VY = [];
let HX = [], HY = []; // vị trí ban đầu, dùng cho R
let PIN = [], PX = [], PY = [];
let EDGES = [];
let paused = false;
let friction = 0; // ma sát nhớt: gia tốc = -friction · v
let dragging = -1;
let dragX = 0, dragY = 0;
let linkMode = false;
let linkSrc = -1;
let message = "";
let trail = [];
let view = { pivotX: 0, pivotY: 0, ppm: 100, w: 0, h: 0 };

function setStructure(home, edges, pinned) {
  N = home.length;
  HX = home.map((p) => p.x);
  HY = home.map((p) => p.y);
  X = HX.slice();
  Y = HY.slice();
  VX = new Array(N).fill(0);
  VY = new Array(N).fill(0);
  PIN = pinned.slice();
  PX = HX.slice();
  PY = HY.slice();
  EDGES = edges.map((e) => ({ a: e.a, b: e.b, L: e.L }));
  dragging = -1;
  linkSrc = -1;
  trail = [];
  updateScale();
  updateLinkControls();
}

function chainStructure() {
  setStructure(
    [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
    [{ a: -1, b: 0, L: 1 }, { a: 0, b: 1, L: 1 }, { a: 1, b: 2, L: 1 }],
    [false, false, false]
  );
}

// Lưới ngẫu nhiên gồm nNodes node xếp theo lưới gần vuông (lấp đầy từng hàng, cách nhau 1 m).
// Có nEdges rod: luôn chứa một cây khung ngẫu nhiên (đảm bảo liên thông), phần còn lại
// được chọn ngẫu nhiên trong các cạnh lưới. nEdges bị kẹp vào [nNodes - 1, số cạnh lưới].
// Hàng trên cùng được ghim.
function netStructure(nNodes, nEdges) {
  nNodes = Math.max(2, Math.min(MAX_NET_NODES, Math.floor(nNodes) || 2));
  const cols = Math.ceil(Math.sqrt(nNodes));
  const home = [];
  for (let k = 0; k < nNodes; k++) {
    home.push({ x: (k % cols) - (cols - 1) / 2, y: Math.floor(k / cols) });
  }
  const cand = [];
  for (let k = 0; k < nNodes; k++) {
    if ((k % cols) + 1 < cols && k + 1 < nNodes) cand.push([k, k + 1]);
    if (k + cols < nNodes) cand.push([k, k + cols]);
  }
  nEdges = Math.max(nNodes - 1, Math.min(cand.length, Math.floor(nEdges) || 0));

  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  // cây khung ngẫu nhiên (Kruskal)
  const uf = Array.from({ length: nNodes }, (_, i) => i);
  const find = (x) => (uf[x] === x ? x : (uf[x] = find(uf[x])));
  const tree = [];
  const rest = [];
  for (const [a, b] of cand) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) {
      uf[ra] = rb;
      tree.push([a, b]);
    } else {
      rest.push([a, b]);
    }
  }
  const chosen = tree.concat(rest.slice(0, nEdges - tree.length));
  const edges = chosen.map(([a, b]) => ({ a, b, L: 1 }));
  const pinned = home.map((_, i) => i < cols);
  setStructure(home, edges, pinned);

  netNEl.value = String(nNodes);
  netEEl.min = String(nNodes - 1);
  netEEl.max = String(cand.length);
  netEEl.value = String(nEdges);
  return { nodes: nNodes, edges: nEdges, maxEdges: cand.length };
}

// ---- Vật lý ----

function fixedPos(i) {
  return dragging === i ? { x: dragX, y: dragY } : { x: PX[i], y: PY[i] };
}

function isFixed(i) {
  return PIN[i] || i === dragging;
}

// Chiếu các ràng buộc khoảng cách lên vị trí xs, ys (sửa tại chỗ).
function project(xs, ys) {
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < N; i++) {
      if (isFixed(i)) {
        const f = fixedPos(i);
        xs[i] = f.x;
        ys[i] = f.y;
      }
    }
    for (const e of EDGES) {
      const ia = e.a, ib = e.b;
      const fa = ia < 0 || isFixed(ia);
      const fb = ib < 0 || isFixed(ib);
      if (fa && fb) continue;
      const ax = ia < 0 ? 0 : xs[ia], ay = ia < 0 ? 0 : ys[ia];
      const bx = ib < 0 ? 0 : xs[ib], by = ib < 0 ? 0 : ys[ib];
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1e-12;
      const C = len - e.L;
      const nx = dx / len, ny = dy / len;
      const wa = fa ? 0 : 1, wb = fb ? 0 : 1;
      const w = wa + wb;
      if (wa) {
        xs[ia] += (wa / w) * C * nx;
        ys[ia] += (wa / w) * C * ny;
      }
      if (wb) {
        xs[ib] -= (wb / w) * C * nx;
        ys[ib] -= (wb / w) * C * ny;
      }
    }
  }
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      const f = fixedPos(i);
      xs[i] = f.x;
      ys[i] = f.y;
    }
  }
}

function substep(dt) {
  const damp = 1 / (1 + friction * dt);
  const px = new Array(N), py = new Array(N);
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      const f = fixedPos(i);
      px[i] = f.x;
      py[i] = f.y;
      VX[i] = 0;
      VY[i] = 0;
      continue;
    }
    VY[i] += G * dt;
    VX[i] *= damp;
    VY[i] *= damp;
    px[i] = X[i] + VX[i] * dt;
    py[i] = Y[i] + VY[i] * dt;
  }
  project(px, py);
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      VX[i] = 0;
      VY[i] = 0;
    } else {
      VX[i] = (px[i] - X[i]) / dt;
      VY[i] = (py[i] - Y[i]) / dt;
    }
    X[i] = px[i];
    Y[i] = py[i];
  }
}

function energy() {
  let e = 0;
  for (let i = 0; i < N; i++) {
    e += 0.5 * (VX[i] * VX[i] + VY[i] * VY[i]) - G * Y[i];
  }
  return e;
}

function reset() {
  for (let i = 0; i < N; i++) {
    X[i] = HX[i];
    Y[i] = HY[i];
    VX[i] = 0;
    VY[i] = 0;
    PX[i] = HX[i];
    PY[i] = HY[i];
  }
  trail = [];
}

// ---- Hình vẽ ----

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.w = w;
  view.h = h;
  view.pivotX = w / 2;
  view.pivotY = h * 0.18;
  updateScale();
}

function updateScale() {
  let maxAbsX = 1;
  let maxY = 1;
  for (let i = 0; i < N; i++) {
    maxAbsX = Math.max(maxAbsX, Math.abs(HX[i]) + 0.5);
    maxY = Math.max(maxY, HY[i]);
  }
  view.ppm = Math.min((view.w * 0.45) / maxAbsX, (view.h * 0.72) / (maxY + 1));
}

function sx(x) { return view.pivotX + view.ppm * x; }
function sy(y) { return view.pivotY + view.ppm * y; }
function wx(px) { return (px - view.pivotX) / view.ppm; }
function wy(py) { return (py - view.pivotY) / view.ppm; }

function drawTrail() {
  if (trail.length < 2) return;
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = i / trail.length;
    ctx.strokeStyle = `rgba(90, 200, 255, ${a * 0.55})`;
    ctx.lineWidth = 0.5 + a * 2;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

const BOB_COLORS = [
  ["#eaf2ff", "#7f8ea3"],
  ["#9fe8ff", "#2b7fa8"],
  ["#ffd79f", "#c07a2b"],
];

function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  drawTrail();

  // rod
  ctx.strokeStyle = "#cfd8e3";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (const e of EDGES) {
    const ax = e.a < 0 ? 0 : X[e.a], ay = e.a < 0 ? 0 : Y[e.a];
    const bx = e.b < 0 ? 0 : X[e.b], by = e.b < 0 ? 0 : Y[e.b];
    ctx.beginPath();
    ctx.moveTo(sx(ax), sy(ay));
    ctx.lineTo(sx(bx), sy(by));
    ctx.stroke();
  }

  // quả nặng
  for (let i = 0; i < N; i++) {
    const p = { x: sx(X[i]), y: sy(Y[i]) };
    const r = 10;
    const c = BOB_COLORS[i % BOB_COLORS.length];
    const grd = ctx.createRadialGradient(
      p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r
    );
    grd.addColorStop(0, c[0]);
    grd.addColorStop(1, c[1]);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (PIN[i]) {
      ctx.strokeStyle = "#8b95a5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (i === linkSrc) {
      ctx.strokeStyle = "#ffd79f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#39414d";
  ctx.beginPath();
  ctx.arc(view.pivotX, view.pivotY, 4, 0, Math.PI * 2);
  ctx.fill();

  energyEl.textContent = `E = ${energy().toFixed(3)} J   ·   ${
    paused ? "paused" : "running"
  }`;
}

// ---- Vòng lặp chính ----

let last = performance.now();
let acc = 0;

function frame(now) {
  let dtReal = (now - last) / 1000;
  last = now;
  if (dtReal > 0.05) dtReal = 0.05;

  if (!paused && dragging < 0) {
    acc += dtReal;
    let steps = 0;
    while (acc >= DT && steps < 3000) {
      substep(DT);
      acc -= DT;
      steps++;
    }
  } else {
    acc = 0;
  }

  if (N > 0) {
    const tipX = sx(X[N - 1]), tipY = sy(Y[N - 1]);
    const tail = trail[trail.length - 1];
    if (!tail || Math.hypot(tail.x - tipX, tail.y - tipY) > 0.6) {
      trail.push({ x: tipX, y: tipY });
      if (trail.length > TRAIL_MAX) trail.shift();
    }
  }

  draw();
  requestAnimationFrame(frame);
}

// ---- Số node: thêm/bớt ở cuối ----

function addNode() {
  const last = N - 1;
  const hx = last >= 0 ? HX[last] : 0;
  const hy = last >= 0 ? HY[last] + 1 : 1;
  HX.push(hx); HY.push(hy);
  X.push(hx); Y.push(hy);
  VX.push(0); VY.push(0);
  PIN.push(false); PX.push(hx); PY.push(hy);
  EDGES.push({ a: last, b: N, L: 1 }); // last = -1 nghĩa là treo từ điểm treo
  N++;
  trail = [];
  updateScale();
  updateLinkControls();
}

function removeNode() {
  if (N <= 1) return;
  N--;
  HX.pop(); HY.pop(); X.pop(); Y.pop(); VX.pop(); VY.pop();
  PIN.pop(); PX.pop(); PY.pop();
  EDGES = EDGES.filter((e) => e.a < N && e.b < N);
  if (dragging >= N) dragging = -1;
  if (linkSrc >= N) linkSrc = -1;
  trail = [];
  updateScale();
  updateLinkControls();
}

// ---- Chế độ nối / ghim ----

function pick(p) {
  let best = -1;
  let bestDist = PICK_RADIUS;
  // duyệt từ node vẽ sau (nằm trên) để khi hai node chồng nhau chọn node trên cùng
  for (let i = N - 1; i >= 0; i--) {
    const d = Math.hypot(p.x - sx(X[i]), p.y - sy(Y[i]));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function nodeLabel(i) {
  return i < 0 ? "điểm treo" : `node ${i + 1}`;
}

function distBetween(a, b) {
  const ax = a < 0 ? 0 : X[a], ay = a < 0 ? 0 : Y[a];
  const bx = b < 0 ? 0 : X[b], by = b < 0 ? 0 : Y[b];
  return Math.hypot(bx - ax, by - ay);
}

function edgeIndex(a, b) {
  return EDGES.findIndex(
    (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)
  );
}

// Bật/tắt rod giữa a và b. Chiều dài rod lấy bằng khoảng cách hiện tại nên không giật.
function toggleEdge(a, b) {
  const k = edgeIndex(a, b);
  if (k >= 0) {
    EDGES.splice(k, 1);
    message = `đã gỡ rod ${nodeLabel(a)} – ${nodeLabel(b)}`;
  } else {
    const L = Math.max(0.05, distBetween(a, b));
    EDGES.push({ a, b, L });
    message = `đã nối ${nodeLabel(a)} – ${nodeLabel(b)}`;
  }
  trail = [];
  updateLinkControls();
}

function toggleLinkMode() {
  linkMode = !linkMode;
  linkSrc = -1;
  dragging = -1;
  message = "";
  updateLinkControls();
}

function handleLinkClick(p) {
  const hit = pick(p);
  if (hit < 0) {
    if (linkSrc >= 0) {
      const a = linkSrc;
      linkSrc = -1;
      toggleEdge(a, -1);
    }
  } else if (linkSrc < 0) {
    linkSrc = hit;
  } else if (hit === linkSrc) {
    linkSrc = -1;
  } else {
    const a = linkSrc;
    linkSrc = -1;
    toggleEdge(a, hit);
  }
  updateLinkControls();
}

function togglePin() {
  if (linkSrc < 0) return;
  const i = linkSrc;
  PIN[i] = !PIN[i];
  if (PIN[i]) {
    PX[i] = X[i];
    PY[i] = Y[i];
  }
  VX[i] = 0;
  VY[i] = 0;
  message = PIN[i] ? `đã ghim node ${i + 1}` : `đã bỏ ghim node ${i + 1}`;
  updateLinkControls();
}

function updateLinkControls() {
  linksValEl.textContent = String(N);
  lessBtn.disabled = N <= 1;
  linkModeBtn.textContent = linkMode ? "Thoát chế độ nối" : "Chế độ nối";
  linkModeBtn.classList.toggle("on", linkMode);
  if (linkMode) {
    linkHintEl.textContent = linkSrc < 0
      ? "Chọn một node, rồi click node khác để nối/gỡ rod. Click vùng trống để nối/gỡ với điểm treo. Phím P để ghim/bỏ ghim."
      : `Đã chọn node ${linkSrc + 1}. Click node khác để nối/gỡ rod, click vùng trống để nối/gỡ với điểm treo, phím P để ghim/bỏ ghim.`;
  } else {
    linkHintEl.textContent = message;
  }
}

// ---- Tương tác chuột ----

function localPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

canvas.addEventListener("pointerdown", (ev) => {
  const p = localPoint(ev);
  if (linkMode) {
    handleLinkClick(p);
    return;
  }
  const hit = pick(p);
  if (hit < 0) return;
  dragging = hit;
  dragX = wx(p.x);
  dragY = wy(p.y);
  canvas.classList.add("dragging");
  canvas.setPointerCapture(ev.pointerId);
  paused = true;
});

canvas.addEventListener("pointermove", (ev) => {
  if (dragging < 0) return;
  const p = localPoint(ev);
  dragX = wx(p.x);
  dragY = wy(p.y);
  // các node khác được đẩy theo ràng buộc quanh node đang kéo
  const xs = X.slice(), ys = Y.slice();
  project(xs, ys);
  X = xs;
  Y = ys;
  for (let i = 0; i < N; i++) { VX[i] = 0; VY[i] = 0; }
  trail = [];
  draw();
});

function endDrag(ev) {
  if (dragging < 0) return;
  if (PIN[dragging]) {
    PX[dragging] = X[dragging];
    PY[dragging] = Y[dragging];
  }
  dragging = -1;
  for (let i = 0; i < N; i++) { VX[i] = 0; VY[i] = 0; }
  paused = false;
  acc = 0;
  last = performance.now();
  canvas.classList.remove("dragging");
  if (ev && ev.pointerId !== undefined) {
    try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

window.addEventListener("keydown", (ev) => {
  if (ev.code === "Space") {
    ev.preventDefault();
    paused = !paused;
    last = performance.now();
    acc = 0;
  } else if (ev.key === "r" || ev.key === "R") {
    reset();
  } else if (ev.key === "+" || ev.key === "=") {
    addNode();
  } else if (ev.key === "-" || ev.key === "_") {
    removeNode();
  } else if (ev.key === "p" || ev.key === "P") {
    if (linkMode) togglePin();
  } else if (ev.key === "Escape" && linkMode) {
    linkSrc = -1;
    updateLinkControls();
  }
});

frictionEl.addEventListener("input", () => {
  friction = parseFloat(frictionEl.value);
  frictionValEl.textContent = friction.toFixed(2);
});
friction = parseFloat(frictionEl.value) || 0;
frictionValEl.textContent = friction.toFixed(2);

lessBtn.addEventListener("click", removeNode);
moreBtn.addEventListener("click", addNode);
linkModeBtn.addEventListener("click", toggleLinkMode);
netBtn.addEventListener("click", () =>
  netStructure(parseInt(netNEl.value, 10), parseInt(netEEl.value, 10))
);
chainBtn.addEventListener("click", chainStructure);

window.addEventListener("resize", resize);

chainStructure();
resize();
requestAnimationFrame(frame);

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
const pinModeBtn = document.getElementById("pinmode");
const clearPinsBtn = document.getElementById("clearpins");
const netNEl = document.getElementById("net-n");
const netEEl = document.getElementById("net-e");
const netPEl = document.getElementById("net-p");
const settleBtn = document.getElementById("settle");
const arrangeBtn = document.getElementById("arrange");
const pathInfoEl = document.getElementById("path-info");

const G = 9.81;
// Bước thời gian của Verlet + SHAKE: ổn định trên lưới 20–50 node trong 30 s (đã kiểm tra).
const DT = 0.001;
const DRAG_K = 100; // độ cứng lò xo khi kéo node
const DRAG_FRICTION = 20; // ma sát tối thiểu khi đang kéo (≈ 2√DRAG_K: tắt dao động của lò xo)
const TRAIL_MAX = 500;
const PICK_RADIUS = 28;
const MAX_NET_NODES = 200;

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
let frictionBase = 0; // ma sát nhớt: gia tốc = -friction · v
let dragging = -1;
let dragX = 0, dragY = 0;
let linkMode = false;
let pinMode = false;
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

// Lưới ngẫu nhiên gồm nNodes node xếp theo lưới gần vuông (cách nhau 1 m).
// Rod nối các node lân cận theo 8 hướng (cả chéo, dài √2). Luôn có một cây khung ngẫu
// nhiên (đảm bảo liên thông), các rod còn lại được chọn ngẫu nhiên cho đủ nEdges.
// nPins node được ghim ngẫu nhiên sao cho không có hai node ghim nào liền kề.
function netStructure(nNodes, nEdges, nPins) {
  nNodes = Math.max(2, Math.min(MAX_NET_NODES, Math.floor(nNodes) || 2));
  const cols = Math.ceil(Math.sqrt(nNodes));
  const home = [];
  for (let k = 0; k < nNodes; k++) {
    home.push({ x: (k % cols) - (cols - 1) / 2, y: Math.floor(k / cols) });
  }
  const adj = Array.from({ length: nNodes }, () => []);
  const cand = [];
  for (let a = 0; a < nNodes; a++) {
    const ra = Math.floor(a / cols), ca = a % cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rb = ra + dr, cb = ca + dc;
        if (rb < 0 || cb < 0 || cb >= cols) continue;
        const b = rb * cols + cb;
        if (b <= a || b >= nNodes) continue;
        cand.push([a, b]);
        adj[a].push(b);
        adj[b].push(a);
      }
    }
  }
  const len = ([a, b]) => Math.hypot(home[b].x - home[a].x, home[b].y - home[a].y);
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
  const edges = chosen.map(([a, b]) => ({ a, b, L: len([a, b]) }));

  // ghim ngẫu nhiên, không chọn node liền kề với node đã ghim
  const want = Math.max(0, Math.min(nNodes, Math.floor(nPins) || 0));
  const order = Array.from({ length: nNodes }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pinned = new Array(nNodes).fill(false);
  const blocked = new Array(nNodes).fill(false);
  let pinCount = 0;
  for (const i of order) {
    if (pinCount >= want) break;
    if (blocked[i]) continue;
    pinned[i] = true;
    pinCount++;
    blocked[i] = true;
    for (const j of adj[i]) blocked[j] = true;
  }

  setStructure(home, edges, pinned);

  netNEl.value = String(nNodes);
  netEEl.min = String(nNodes - 1);
  netEEl.max = String(cand.length);
  netEEl.value = String(nEdges);
  netPEl.max = String(nNodes);
  netPEl.value = String(pinCount);
  return { nodes: nNodes, edges: nEdges, maxEdges: cand.length, pins: pinCount };
}

// ---- Vật lý ----

function fixedPos(i) {
  return { x: PX[i], y: PY[i] };
}

// Node ghim đứng yên; node đang kéo (kể cả node ghim) được điều khiển bằng lò xo.
function isFixed(i) {
  return PIN[i] && i !== dragging;
}

// Cơ học Lagrange với ràng buộc rod. Mỗi node tự do có khối lượng 1 và ràng buộc
//   C_k = ½(|p_b − p_a|² − L_k²) = 0,   nhân tử Lagrange λ_k.
// Tích phân bằng Verlet vận tốc (đối xứng, giữ năng lượng tốt). Ở mỗi bước, nhân tử
// được giải chính xác từ (J Jᵀ) μ = −C theo kiểu SHAKE để vị trí thỏa ràng buộc, sau đó
// vận tốc được chiếu lên không gian tiếp tuyến (RATTLE): J v = 0.
const SHAKE_ITER = 8;
const REG = 1e-7; // chính quy hóa tương đối cho hệ nhân tử

// Các ràng buộc có ít nhất một đầu tự do (ràng buộc giữa hai node cố định là hằng số).
function activeEdges() {
  const out = [];
  for (let k = 0; k < EDGES.length; k++) {
    const e = EDGES[k];
    if ((e.b >= 0 && !isFixed(e.b)) || (e.a >= 0 && !isFixed(e.a))) out.push(k);
  }
  return out;
}

// Vector d = p_b − p_a của từng ràng buộc hoạt động.
function edgeVectors(xs, ys, active) {
  const dx = new Array(active.length), dy = new Array(active.length);
  active.forEach((k, p) => {
    const e = EDGES[k];
    dx[p] = (e.b < 0 ? 0 : xs[e.b]) - (e.a < 0 ? 0 : xs[e.a]);
    dy[p] = (e.b < 0 ? 0 : ys[e.b]) - (e.a < 0 ? 0 : ys[e.a]);
  });
  return { dx, dy };
}

// Giải nhân tử μ từ (J Jᵀ) μ = rhs bằng gradient liên hợp, không lập ma trận đầy đủ.
// J là gradient ràng buộc theo vị trí node tự do: +d cho đầu b, −d cho đầu a.
function multipliers(active, dx, dy, rhs) {
  const M = active.length;
  if (M === 0) return [];
  const eN = new Array(M), eS = new Array(M);
  for (let p = 0; p < M; p++) {
    const e = EDGES[active[p]];
    const ns = [], ss = [];
    if (e.b >= 0 && !isFixed(e.b)) { ns.push(e.b); ss.push(1); }
    if (e.a >= 0 && !isFixed(e.a)) { ns.push(e.a); ss.push(-1); }
    eN[p] = ns;
    eS[p] = ss;
  }
  const nominal = new Float64Array(M); // đường chéo danh nghĩa của J Jᵀ
  for (let p = 0; p < M; p++) nominal[p] = eN[p].length * (dx[p] * dx[p] + dy[p] * dy[p]);
  const sumX = new Float64Array(N), sumY = new Float64Array(N);
  // out = (J Jᵀ) v
  const apply = (v, out) => {
    sumX.fill(0);
    sumY.fill(0);
    for (let p = 0; p < M; p++) {
      for (let u = 0; u < eN[p].length; u++) {
        const n = eN[p][u], s = eS[p][u] * v[p];
        sumX[n] += s * dx[p];
        sumY[n] += s * dy[p];
      }
    }
    for (let p = 0; p < M; p++) {
      let o = 0;
      for (let u = 0; u < eN[p].length; u++) {
        const n = eN[p][u];
        o += eS[p][u] * (dx[p] * sumX[n] + dy[p] * sumY[n]);
      }
      out[p] = o + (REG * nominal[p] + 1e-12) * v[p];
    }
  };
  const diag = new Float64Array(M);
  let bnorm = 0;
  for (let p = 0; p < M; p++) {
    // chính quy hóa Tikhonov: ma trận J Jᵀ gần suy biến khi lưới có ô tam giác
    diag[p] = nominal[p] * (1 + REG) + 1e-12;
    bnorm = Math.max(bnorm, Math.abs(rhs[p]));
  }
  const x = new Float64Array(M);
  if (bnorm === 0) return Array.from(x);
  const r = Float64Array.from(rhs);
  const z = new Float64Array(M);
  const q = new Float64Array(M);
  for (let p = 0; p < M; p++) z[p] = r[p] / diag[p];
  const pv = Float64Array.from(z);
  let rz = 0;
  for (let p = 0; p < M; p++) rz += r[p] * z[p];
  const maxIt = Math.max(50, 4 * M);
  for (let it = 0; it < maxIt && rz > 0; it++) {
    apply(pv, q);
    let pq = 0;
    for (let p = 0; p < M; p++) pq += pv[p] * q[p];
    if (pq === 0) break;
    const alpha = rz / pq;
    let rmax = 0;
    for (let p = 0; p < M; p++) {
      x[p] += alpha * pv[p];
      r[p] -= alpha * q[p];
      rmax = Math.max(rmax, Math.abs(r[p]));
    }
    if (rmax < 1e-11 * bnorm) break;
    for (let p = 0; p < M; p++) z[p] = r[p] / diag[p];
    let rzNew = 0;
    for (let p = 0; p < M; p++) rzNew += r[p] * z[p];
    const beta = rzNew / rz;
    rz = rzNew;
    for (let p = 0; p < M; p++) pv[p] = z[p] + beta * pv[p];
  }
  return Array.from(x);
}

// Sợi chỉ: chỉ chống kéo giãn, không chống nén. Ràng buộc C_k = ½(|d|² − L²) ≤ 0 là
// bất đẳng thức; chỉ các sợi đang căng (C > 0) mới được kéo về đúng chiều dài. Sợi chùng
// không tác dụng lực. Nhân tử μ ≤ 0 tương ứng với lực kéo vào trong (lực căng hợp lệ).
const STRING_TOL = 1e-9; // dung sai: sợi căng trong sai số làm tròn không bị hiệu chỉnh

// SHAKE cho các sợi căng: Δp = Jᵀμ, (J Jᵀ)μ = −C, bỏ qua sợi nào cần đẩy (μ > 0).
function shake(xs, ys, active, iters = SHAKE_ITER) {
  for (let it = 0; it < iters; it++) {
    const { dx, dy } = edgeVectors(xs, ys, active);
    const C = active.map(
      (k, p) => 0.5 * (dx[p] * dx[p] + dy[p] * dy[p] - EDGES[k].L * EDGES[k].L)
    );
    let sel = [];
    for (let p = 0; p < active.length; p++) if (C[p] > STRING_TOL) sel.push(p);
    if (sel.length === 0) break;
    const mu = multipliers(
      sel.map((p) => active[p]),
      sel.map((p) => dx[p]),
      sel.map((p) => dy[p]),
      sel.map((p) => -C[p])
    );
    sel.forEach((p, q) => {
      if (mu[q] > 0) return;
      const e = EDGES[active[p]];
      if (e.b >= 0 && !isFixed(e.b)) {
        xs[e.b] += mu[q] * dx[p];
        ys[e.b] += mu[q] * dy[p];
      }
      if (e.a >= 0 && !isFixed(e.a)) {
        xs[e.a] -= mu[q] * dx[p];
        ys[e.a] -= mu[q] * dy[p];
      }
    });
  }
}

// RATTLE cho sợi căng: sợi đang căng mà đầu hai nút đang tách ra thì chiếu vận tốc
// (J v = 0) bằng lực kéo vào; sợi chùng thì không chiếu.
function projectVelocities(active) {
  const { dx, dy } = edgeVectors(X, Y, active);
  const dvn = active.map((k, p) => {
    const e = EDGES[k];
    const dvx = (e.b < 0 ? 0 : VX[e.b]) - (e.a < 0 ? 0 : VX[e.a]);
    const dvy = (e.b < 0 ? 0 : VY[e.b]) - (e.a < 0 ? 0 : VY[e.a]);
    return dx[p] * dvx + dy[p] * dvy;
  });
  let sel = [];
  for (let p = 0; p < active.length; p++) {
    const e = EDGES[active[p]];
    const C = 0.5 * (dx[p] * dx[p] + dy[p] * dy[p] - e.L * e.L);
    if (C >= -1e-9 && dvn[p] > 0) sel.push(p);
  }
  for (let round = 0; round < 4 && sel.length > 0; round++) {
    const nu = multipliers(
      sel.map((p) => active[p]),
      sel.map((p) => dx[p]),
      sel.map((p) => dy[p]),
      sel.map((p) => -dvn[p])
    );
    const keep = sel.filter((p, q) => nu[q] <= 0);
    if (keep.length === sel.length) {
      sel.forEach((p, q) => {
        const e = EDGES[active[p]];
        if (e.b >= 0 && !isFixed(e.b)) {
          VX[e.b] += nu[q] * dx[p];
          VY[e.b] += nu[q] * dy[p];
        }
        if (e.a >= 0 && !isFixed(e.a)) {
          VX[e.a] -= nu[q] * dx[p];
          VY[e.a] -= nu[q] * dy[p];
        }
      });
      break;
    }
    sel = keep;
  }
}

// Một bước Verlet vận tốc với ràng buộc. Ma sát: gia tốc −friction·v.
function substep(dt) {
  const h = dt;
  // khi đang kéo, ma sát tối thiểu DRAG_FRICTION để lưới ổn định nhanh (rod vẫn cứng)
  const friction = dragging >= 0 ? Math.max(frictionBase, DRAG_FRICTION) : frictionBase;
  const active = activeEdges();
  const xs = new Array(N), ys = new Array(N);
  const fx = new Array(N).fill(0), fy = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      const f = fixedPos(i);
      xs[i] = f.x;
      ys[i] = f.y;
      continue;
    }
    // lực lò xo kéo node đang kéo về con trỏ
    const kx = i === dragging ? DRAG_K * (dragX - X[i]) : 0;
    const ky = i === dragging ? DRAG_K * (dragY - Y[i]) : 0;
    // nửa bước vận tốc, rồi dự đoán vị trí
    const vhx = VX[i] + (h / 2) * (-friction * VX[i] + kx);
    const vhy = VY[i] + (h / 2) * (G - friction * VY[i] + ky);
    xs[i] = X[i] + h * vhx;
    ys[i] = Y[i] + h * vhy;
    fx[i] = kx;
    fy[i] = ky;
  }
  shake(xs, ys, active);
  // nửa bước vận tốc còn lại (ẩn theo ma sát): v = (u + (h/2)(G + f)) / (1 + c h/2)
  const damp = 1 + (friction * h) / 2;
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      VX[i] = 0;
      VY[i] = 0;
      continue;
    }
    const ux = (xs[i] - X[i]) / h;
    const uy = (ys[i] - Y[i]) / h;
    VX[i] = (ux + (h / 2) * fx[i]) / damp;
    VY[i] = (uy + (h / 2) * (G + fy[i])) / damp;
  }
  X = xs;
  Y = ys;
  projectVelocities(active);
  for (let i = 0; i < N; i++) {
    if (isFixed(i)) {
      VX[i] = 0;
      VY[i] = 0;
    }
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

// Đường rod ngắn nhất (ít rod nhất) giữa hai node liền kề trong danh sách,
// tìm bằng BFS trên đồ thị rod. Trả về mảng chỉ số cạnh hoặc null nếu không nối được.
function bfsEdgePath(s, t, adj) {
  const prevN = new Array(N).fill(-1), prevE = new Array(N).fill(-1);
  const seen = new Array(N).fill(false);
  const queue = [s];
  seen[s] = true;
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    if (u === t) break;
    for (const [v, k] of adj[u]) {
      if (!seen[v]) {
        seen[v] = true;
        prevN[v] = u;
        prevE[v] = k;
        queue.push(v);
      }
    }
  }
  if (!seen[t]) return null;
  const out = [];
  for (let c = t; c !== s; c = prevN[c]) out.push(prevE[c]);
  return out;
}

// Đường đi ngắn nhất qua tất cả điểm ghim theo thứ tự chỉ số: nối lần lượt từng cặp
// điểm ghim liền kề bằng đường ít rod nhất.
function shortestPinPath() {
  const pins = [];
  for (let i = 0; i < N; i++) if (PIN[i]) pins.push(i);
  if (pins.length < 2) return { edges: new Set(), msg: "cần ít nhất 2 điểm ghim" };
  const adj = Array.from({ length: N }, () => []);
  EDGES.forEach((e, k) => {
    if (e.a >= 0 && e.b >= 0) {
      adj[e.a].push([e.b, k]);
      adj[e.b].push([e.a, k]);
    }
  });
  const edges = new Set();
  const counts = [];
  for (let i = 0; i + 1 < pins.length; i++) {
    const seg = bfsEdgePath(pins[i], pins[i + 1], adj);
    if (!seg) {
      return { edges, msg: `node ${pins[i] + 1} và ${pins[i + 1] + 1} không nối được bằng rod` };
    }
    seg.forEach((k) => edges.add(k));
    counts.push(seg.length);
  }
  let total = 0;
  edges.forEach((k) => (total += EDGES[k].L));
  return {
    edges,
    msg: `đường ngắn nhất qua ${pins.length} điểm ghim: ${counts.join(" + ")} = ${edges.size} rod, tổng chiều dài ${total.toFixed(2)} m`,
  };
}

// Kéo các điểm ghim thành một hàng ngang (y = 0), cách đều nhau. Các ghim được di chuyển
// dần qua nhiều bước, mỗi bước SHAKE lại để các node còn lại giữ đúng chiều dài rod.
// Nếu không khả thi thì khôi phục trạng thái cũ.
function arrangePins() {
  const pins = [];
  for (let i = 0; i < N; i++) if (PIN[i]) pins.push(i);
  const k = pins.length;
  if (k === 0) {
    message = "chưa có điểm ghim để xếp";
    updateLinkControls();
    return;
  }
  const savePX = PX.slice(), savePY = PY.slice();
  const STEPS = 60;
  for (let t = 0; t < 8; t++) {
    const spacing = 1.0 / Math.pow(2, t);
    const start = pins.map((i) => ({ i, x0: X[i], y0: Y[i] }));
    const target = pins.map((i, idx) => ({ x: (idx - (k - 1) / 2) * spacing, y: 0 }));
    const xs = X.slice(), ys = Y.slice();
    for (let st = 1; st <= STEPS; st++) {
      const f = st / STEPS;
      start.forEach((p, idx) => {
        const i = p.i;
        PX[i] = p.x0 + (target[idx].x - p.x0) * f;
        PY[i] = p.y0 + (target[idx].y - p.y0) * f;
        xs[i] = PX[i];
        ys[i] = PY[i];
      });
      shake(xs, ys, activeEdges(), 30);
    }
    let viol = 0;
    for (const e of EDGES) {
      const ax = e.a < 0 ? 0 : xs[e.a], ay = e.a < 0 ? 0 : ys[e.a];
      const bx = e.b < 0 ? 0 : xs[e.b], by = e.b < 0 ? 0 : ys[e.b];
      viol = Math.max(viol, Math.hypot(bx - ax, by - ay) - e.L); // sợi chỉ chỉ cấm kéo quá dài
    }
    if (viol < 1e-7) {
      X = xs;
      Y = ys;
      VX.fill(0);
      VY.fill(0);
      trail = [];
      message = `đã xếp ${k} điểm ghim thành hàng, cách nhau ${spacing.toFixed(3)} m`;
      updateLinkControls();
      return;
    }
  }
  PX = savePX;
  PY = savePY;
  message = "không xếp được các điểm ghim thành hàng với rod hiện tại (giữ nguyên trạng thái)";
  updateLinkControls();
}

function draw() {
  ctx.clearRect(0, 0, view.w, view.h);
  drawTrail();

  // rod
  ctx.strokeStyle = "#cfd8e3";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const path = shortestPinPath();
  const onPath = path.edges || new Set();
  pathInfoEl.textContent = path.msg;
  EDGES.forEach((e, k) => {
    const ax = e.a < 0 ? 0 : X[e.a], ay = e.a < 0 ? 0 : Y[e.a];
    const bx = e.b < 0 ? 0 : X[e.b], by = e.b < 0 ? 0 : Y[e.b];
    ctx.beginPath();
    ctx.moveTo(sx(ax), sy(ay));
    ctx.lineTo(sx(bx), sy(by));
    if (onPath.has(k)) {
      ctx.strokeStyle = "#ffd79f";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "#cfd8e3";
      ctx.lineWidth = 2.5;
    } else {
      ctx.stroke();
    }
  });

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
      // vạch ngang phía trên báo hiệu node cố định
      ctx.strokeStyle = "#ffb4b4";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y - r - 6);
      ctx.lineTo(p.x + 9, p.y - r - 6);
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

  if (!paused) {
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
  if (linkMode) pinMode = false;
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

// Ghim/bỏ ghim node i tại vị trí hiện tại.
function togglePinOf(i) {
  if (i < 0 || i >= N) return;
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

function togglePinMode() {
  pinMode = !pinMode;
  if (pinMode) linkMode = false;
  linkSrc = -1;
  dragging = -1;
  message = "";
  updateLinkControls();
}

function clearPins() {
  for (let i = 0; i < N; i++) {
    PIN[i] = false;
  }
  message = "đã bỏ ghim tất cả node";
  updateLinkControls();
}

function updateLinkControls() {
  linksValEl.textContent = String(N);
  lessBtn.disabled = N <= 1;
  linkModeBtn.textContent = linkMode ? "Thoát chế độ nối" : "Chế độ nối";
  linkModeBtn.classList.toggle("on", linkMode);
  pinModeBtn.textContent = pinMode ? "Thoát chế độ ghim" : "Chế độ ghim";
  pinModeBtn.classList.toggle("on", pinMode);
  if (linkMode) {
    linkHintEl.textContent = linkSrc < 0
      ? "Chọn một node, rồi click node khác để nối/gỡ rod. Click vùng trống để nối/gỡ với điểm treo. Phím P để ghim/bỏ ghim."
      : `Đã chọn node ${linkSrc + 1}. Click node khác để nối/gỡ rod, click vùng trống để nối/gỡ với điểm treo, phím P để ghim/bỏ ghim.`;
  } else if (pinMode) {
    linkHintEl.textContent = `Click node để ghim hoặc bỏ ghim. Node ghim có vạch ngang phía trên. ${message}`;
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
  if (pinMode) {
    const hit = pick(p);
    if (hit >= 0) togglePinOf(hit);
    return;
  }
  const hit = pick(p);
  if (hit < 0) return;
  dragging = hit;
  dragX = wx(p.x);
  dragY = wy(p.y);
  canvas.classList.add("dragging");
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (dragging < 0) return;
  const p = localPoint(ev);
  dragX = wx(p.x);
  dragY = wy(p.y);
});

function endDrag(ev) {
  if (dragging < 0) return;
  if (PIN[dragging]) {
    PX[dragging] = X[dragging];
    PY[dragging] = Y[dragging];
  }
  dragging = -1;
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
    if (linkMode) togglePinOf(linkSrc);
  } else if (ev.key === "Escape" && linkMode) {
    linkSrc = -1;
    updateLinkControls();
  }
});

frictionEl.addEventListener("input", () => {
  frictionBase = parseFloat(frictionEl.value);
  frictionValEl.textContent = frictionBase.toFixed(2);
});
frictionBase = parseFloat(frictionEl.value) || 0;
frictionValEl.textContent = frictionBase.toFixed(2);

arrangeBtn.addEventListener("click", arrangePins);
settleBtn.addEventListener("click", () => {
  frictionEl.value = "5";
  frictionBase = 5;
  frictionValEl.textContent = "5.00";
});
lessBtn.addEventListener("click", removeNode);
moreBtn.addEventListener("click", addNode);
linkModeBtn.addEventListener("click", toggleLinkMode);
pinModeBtn.addEventListener("click", togglePinMode);
clearPinsBtn.addEventListener("click", clearPins);
netBtn.addEventListener("click", () =>
  netStructure(parseInt(netNEl.value, 10), parseInt(netEEl.value, 10), parseInt(netPEl.value, 10))
);
chainBtn.addEventListener("click", chainStructure);

window.addEventListener("resize", resize);

chainStructure();
resize();
requestAnimationFrame(frame);

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const energyEl = document.getElementById("energy");
const linksValEl = document.getElementById("links-val");
const lessBtn = document.getElementById("less");
const moreBtn = document.getElementById("more");
const linkModeBtn = document.getElementById("linkmode");
const linkHintEl = document.getElementById("link-hint");
const netBtn = document.getElementById("net");
const pinModeBtn = document.getElementById("pinmode");
const netNEl = document.getElementById("net-n");
const netEEl = document.getElementById("net-e");
const netPEl = document.getElementById("net-p");
const relaxBtn = document.getElementById("relax");
const arrangeBtn = document.getElementById("arrange");
const pathInfoEl = document.getElementById("path-info");

const G = 9.81;
const PICK_RADIUS = 28;
const MAX_NET_NODES = 200;

// Mô hình: mỗi node là một quả nặng (khối lượng 1) với vị trí (X, Y) tính bằng mét,
// trục y hướng xuống. Các rod là ràng buộc khoảng cách: |p_a - p_b| = L (sợi chỉ chỉ chống kéo).
// EDGES[k] = {a, b, L}; chỉ số -1 là điểm treo cố định tại (0, 0).
// Node ghim (PIN) đứng yên tại (PX, PY). Không có động lực học: hệ luôn được đưa về
// trạng thái cân bằng tĩnh (cực tiểu thế năng trọng lực) bằng vòng cân bằng.
let N = 0;
let X = [], Y = [];
let HX = [], HY = []; // vị trí ban đầu (lưới), dùng cho reset
let PIN = [], PX = [], PY = [];
let EDGES = [];
let linkMode = false;
let pinMode = false;
let linkSrc = -1;
let message = "";
// Khung nhìn: ppm = fitPpm · zoom (fitPpm tự co theo lưới); pivot = mốc gốc (0, 0) của lưới
// trên màn hình, mặc định ở giữa-trên và lệch đi bởi panX/panY khi người dùng kéo nền.
let view = { pivotX: 0, pivotY: 0, ppm: 100, fitPpm: 100, zoom: 1, panX: 0, panY: 0, w: 0, h: 0 };
const ZOOM_MIN = 0.25, ZOOM_MAX = 8;

// Tọa độ phần tử i của mảng; chỉ số -1 (điểm treo) luôn ở gốc (0, 0).
const coord = (arr, i) => (i < 0 ? 0 : arr[i]);

// Độ dài thực của rod e trong cấu hình (xs, ys).
function edgeLength(e, xs, ys) {
  return Math.hypot(coord(xs, e.b) - coord(xs, e.a), coord(ys, e.b) - coord(ys, e.a));
}

// Chỉ số các node đang ghim, theo thứ tự tăng dần.
function pinnedIndices() {
  const out = [];
  for (let i = 0; i < N; i++) if (PIN[i]) out.push(i);
  return out;
}

function setStructure(home, edges, pinned) {
  N = home.length;
  HX = home.map((p) => p.x);
  HY = home.map((p) => p.y);
  X = HX.slice();
  Y = HY.slice();
  PIN = pinned.slice();
  PX = HX.slice();
  PY = HY.slice();
  EDGES = edges.map((e) => ({ a: e.a, b: e.b, L: e.L }));
  linkSrc = -1;
  updateScale();
  startRelax("đang cân bằng...");
}

// Bắt đầu (hoặc chạy lại) vòng cân bằng. msg = null thì giữ nguyên thông báo hiện tại.
function startRelax(msg) {
  relaxing = true;
  relaxSweepsDone = 0;
  relaxStep = RELAX_STEP;
  if (msg !== null && msg !== undefined) message = msg;
  updateLinkControls();
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

// ---- Cân bằng tĩnh (ràng buộc sợi chỉ + trọng lực) ----
// Tìm cấu hình có thế năng trọng lực nhỏ nhất thỏa các sợi. Không dùng vận tốc, quán tính
// hay ma sát: mỗi vòng hạ các node tự do theo trọng lực (gradient của U = −G·Σy),
// rồi chiếu các sợi đang căng về đúng chiều dài (SHAKE với nhân tử Lagrange).
// Sợi chỉ chỉ chống kéo: sợi chùng không tác dụng lực. Dừng khi cấu hình không còn thay đổi.

const REG = 1e-7; // chính quy hóa tương đối cho hệ nhân tử
const SHAKE_ITER = 8;
const STRING_TOL = 1e-9; // dung sai: sợi căng trong sai số làm tròn không bị hiệu chỉnh
const RELAX_STEP = 0.0005; // bước hạ ban đầu theo trọng lực (m mỗi vòng)
const RELAX_STEP_MIN = 1e-6;
const RELAX_STEP_MAX = 0.005;
const RELAX_PROJ = 200; // số vòng SHAKE mỗi bước cân bằng
const RELAX_TOL = 1e-9; // ngưỡng: cấu hình không đổi (m) mỗi vòng
const RELAX_STRETCH = 1e-8; // ngưỡng: độ giãn sợi còn lại (m)
const RELAX_SWEEPS_PER_FRAME = 20;
const RELAX_MAX_SWEEPS = 6000; // dừng sau số vòng này nếu chưa hội tụ
let relaxing = true;
let relaxSweepsDone = 0;
let relaxStep = RELAX_STEP;

// Các ràng buộc có ít nhất một đầu tự do (ràng buộc giữa hai node cố định là hằng số).
function activeEdges() {
  const out = [];
  for (let k = 0; k < EDGES.length; k++) {
    const e = EDGES[k];
    if ((e.b >= 0 && !PIN[e.b]) || (e.a >= 0 && !PIN[e.a])) out.push(k);
  }
  return out;
}

// Vector d = p_b − p_a của từng ràng buộc hoạt động.
function edgeVectors(xs, ys, active) {
  const dx = new Array(active.length), dy = new Array(active.length);
  active.forEach((k, p) => {
    const e = EDGES[k];
    dx[p] = coord(xs, e.b) - coord(xs, e.a);
    dy[p] = coord(ys, e.b) - coord(ys, e.a);
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
    if (e.b >= 0 && !PIN[e.b]) { ns.push(e.b); ss.push(1); }
    if (e.a >= 0 && !PIN[e.a]) { ns.push(e.a); ss.push(-1); }
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
      if (e.b >= 0 && !PIN[e.b]) {
        xs[e.b] += mu[q] * dx[p];
        ys[e.b] += mu[q] * dy[p];
      }
      if (e.a >= 0 && !PIN[e.a]) {
        xs[e.a] -= mu[q] * dx[p];
        ys[e.a] -= mu[q] * dy[p];
      }
    });
  }
}

// Thế năng trọng lực hiện tại: U = −G·Σy (y hướng xuống, U nhỏ hơn = thấp hơn).
function potentialU() {
  let u = 0;
  for (let i = 0; i < N; i++) u -= G * Y[i];
  return u;
}

// Một vòng cân bằng: hạ node tự do theo trọng lực, rồi chiếu các sợi căng về đúng chiều dài.
// Bước hạ thích nghi: nếu U không giảm thì bỏ bước và chia đôi bước; nếu giảm thì tăng bước nhẹ.
// Trả về {change, worst}: độ thay đổi lớn nhất của node và độ giãn sợi còn lại.
function relaxSweep() {
  const x0 = X.slice(), y0 = Y.slice();
  const U0 = potentialU();
  const xs = X.slice(), ys = Y.slice();
  for (let i = 0; i < N; i++) {
    if (!PIN[i]) ys[i] += relaxStep * G;
  }
  shake(xs, ys, activeEdges(), RELAX_PROJ);
  X = xs;
  Y = ys;
  if (potentialU() > U0 + 1e-12 && relaxStep > RELAX_STEP_MIN) {
    // bước làm năng lượng tăng: quay lại và thử bước nhỏ hơn
    X = x0;
    Y = y0;
    relaxStep = Math.max(RELAX_STEP_MIN, relaxStep / 2);
    return { change: 1, worst: 1 };
  }
  relaxStep = Math.min(RELAX_STEP_MAX, relaxStep * 1.05);
  let change = 0;
  for (let i = 0; i < N; i++) {
    change = Math.max(change, Math.abs(X[i] - x0[i]), Math.abs(Y[i] - y0[i]));
  }
  let worst = 0;
  for (const e of EDGES) {
    worst = Math.max(worst, edgeLength(e, X, Y) - e.L);
  }
  return { change, worst };
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
  updatePivot();
  updateScale();
}

function updatePivot() {
  view.pivotX = view.w / 2 + view.panX;
  view.pivotY = view.h * 0.18 + view.panY;
}

function updateScale() {
  let maxAbsX = 1;
  let maxY = 1;
  for (let i = 0; i < N; i++) {
    maxAbsX = Math.max(maxAbsX, Math.abs(HX[i]) + 0.5);
    maxY = Math.max(maxY, HY[i]);
  }
  view.fitPpm = Math.min((view.w * 0.45) / maxAbsX, (view.h * 0.72) / (maxY + 1));
  view.ppm = view.fitPpm * view.zoom;
}

// Zoom quanh điểm (cx, cy) trên màn hình: điểm dưới con trỏ giữ nguyên vị trí.
function zoomAt(cx, cy, factor) {
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor));
  const f = newZoom / view.zoom;
  if (f === 1) return;
  // pivot mới = c − (c − pivot cũ)·f  →  panX/panY = pivot mới − mốc mặc định
  view.panX = cx - (cx - view.pivotX) * f - view.w / 2;
  view.panY = cy - (cy - view.pivotY) * f - view.h * 0.18;
  view.zoom = newZoom;
  updatePivot();
  updateScale();
}

function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  updatePivot();
  updateScale();
}

function sx(x) { return view.pivotX + view.ppm * x; }
function sy(y) { return view.pivotY + view.ppm * y; }
function wx(px) { return (px - view.pivotX) / view.ppm; }
function wy(py) { return (py - view.pivotY) / view.ppm; }

const BOB_COLORS = [
  ["#eaf2ff", "#7f8ea3"],
  ["#9fe8ff", "#2b7fa8"],
  ["#ffd79f", "#c07a2b"],
];

// Đường rod ngắn nhất (ít rod nhất) giữa hai node trong đồ thị rod, tìm bằng BFS.
// Trả về mảng chỉ số cạnh hoặc null nếu không nối được.
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

// Đường nối các điểm ghim theo thứ tự chỉ số, chỉ đi qua các sợi căng ở cấu hình cân bằng.
// Đây là đường do trọng lực tạo ra. Mỗi đoạn là đường ít sợi nhất trong các sợi căng (BFS).
function shortestPinPath() {
  const pins = pinnedIndices();
  if (pins.length < 2) return { edges: new Set(), msg: "cần ít nhất 2 điểm ghim" };
  const adj = Array.from({ length: N }, () => []);
  EDGES.forEach((e, k) => {
    // chỉ rod nối hai node thật (không tính điểm treo) và đang căng
    if (e.a < 0 || e.b < 0 || edgeLength(e, X, Y) < e.L - 1e-6) return;
    adj[e.a].push([e.b, k]);
    adj[e.b].push([e.a, k]);
  });
  const edges = new Set();
  const counts = [];
  for (let i = 0; i + 1 < pins.length; i++) {
    const seg = bfsEdgePath(pins[i], pins[i + 1], adj);
    if (!seg) {
      return {
        edges,
        msg: `node ${pins[i] + 1} và ${pins[i + 1] + 1} chưa được nối bằng chuỗi sợi căng (trọng lực chưa kéo căng)`,
      };
    }
    seg.forEach((k) => edges.add(k));
    counts.push(seg.length);
  }
  let total = 0;
  edges.forEach((k) => (total += EDGES[k].L));
  return {
    edges,
    msg: `đường sợi căng do trọng lực qua ${pins.length} điểm ghim: ${counts.join(" + ")} = ${edges.size} sợi, tổng chiều dài ${total.toFixed(2)} m`,
  };
}

// Kéo các điểm ghim thành một hàng ngang (y = 0), cách đều nhau. Các ghim được di chuyển
// dần qua nhiều bước, mỗi bước SHAKE lại để các node còn lại giữ đúng chiều dài rod.
// Nếu không khả thi thì khôi phục trạng thái cũ.
function arrangePins() {
  const pins = pinnedIndices();
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
      viol = Math.max(viol, edgeLength(e, xs, ys) - e.L); // sợi chỉ chỉ cấm kéo quá dài
    }
    if (viol < 1e-7) {
      X = xs;
      Y = ys;
      // các node tự do chưa ở cân bằng sau khi ghim đã dời: hạ lại theo trọng lực
      startRelax(`đã xếp ${k} điểm ghim thành hàng, cách nhau ${spacing.toFixed(3)} m`);
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

  // rod
  ctx.strokeStyle = "#cfd8e3";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const path = shortestPinPath();
  const onPath = path.edges;
  pathInfoEl.textContent = path.msg;
  EDGES.forEach((e, k) => {
    ctx.beginPath();
    ctx.moveTo(sx(coord(X, e.a)), sy(coord(Y, e.a)));
    ctx.lineTo(sx(coord(X, e.b)), sy(coord(Y, e.b)));
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
    const r = Math.min(24, Math.max(5, 10 * view.zoom));
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

  energyEl.textContent = `U = ${potentialU().toFixed(3)} J   ·   ${
    relaxing ? "đang cân bằng" : "cân bằng"
  }`;
}

// ---- Vòng lặp chính ----

function frame() {
  if (relaxing) {
    let r = { change: 1, worst: 1 };
    for (let s = 0; s < RELAX_SWEEPS_PER_FRAME; s++) r = relaxSweep();
    relaxSweepsDone += RELAX_SWEEPS_PER_FRAME;
    if (r.change < RELAX_TOL && r.worst < RELAX_STRETCH) {
      relaxing = false;
      message = "đã cân bằng";
      updateLinkControls();
    } else if (relaxSweepsDone >= RELAX_MAX_SWEEPS) {
      relaxing = false;
      message = "dừng cân bằng (chưa hội tụ); bấm Cân bằng để tiếp tục";
      updateLinkControls();
    }
  }
  draw();
  requestAnimationFrame(frame);
}

// ---- Số node: thêm/bớt ở cuối ----

function addNode() {
  const prev = N - 1;
  const hx = prev >= 0 ? HX[prev] : 0;
  const hy = prev >= 0 ? HY[prev] + 1 : 1;
  HX.push(hx); HY.push(hy);
  X.push(hx); Y.push(hy);
  PIN.push(false); PX.push(hx); PY.push(hy);
  EDGES.push({ a: prev, b: N, L: 1 }); // prev = -1 nghĩa là treo từ điểm treo
  N++;
  updateScale();
  startRelax(null);
  updateLinkControls();
}

function removeNode() {
  if (N <= 1) return;
  N--;
  HX.pop(); HY.pop(); X.pop(); Y.pop();
  PIN.pop(); PX.pop(); PY.pop();
  EDGES = EDGES.filter((e) => e.a < N && e.b < N);
  if (linkSrc >= N) linkSrc = -1;
  updateScale();
  startRelax(null);
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
  return edgeLength({ a, b }, X, Y);
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
  startRelax(null);
  updateLinkControls();
}

function toggleLinkMode() {
  linkMode = !linkMode;
  if (linkMode) pinMode = false;
  linkSrc = -1;
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
  message = PIN[i] ? `đã ghim node ${i + 1}` : `đã bỏ ghim node ${i + 1}`;
  startRelax(null);
  updateLinkControls();
}

function togglePinMode() {
  pinMode = !pinMode;
  if (pinMode) linkMode = false;
  linkSrc = -1;
  message = "";
  updateLinkControls();
}

// Đưa về lưới ban đầu rồi cân bằng lại.
function reset() {
  X = HX.slice();
  Y = HY.slice();
  PX = HX.slice();
  PY = HY.slice();
  startRelax("đã reset về lưới ban đầu");
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

// ---- Tương tác chuột / bàn phím ----

function localPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

// Kéo nền để di chuyển lưới (pan). Ở chế độ nối, mọi click dùng để nối rod.
// Ở chế độ ghim, click vào node sẽ ghim/bỏ ghim, còn click nền thì kéo để di chuyển.
let panning = null; // {id, x, y}: con trỏ đang kéo nền

canvas.addEventListener("pointerdown", (ev) => {
  const p = localPoint(ev);
  if (linkMode) {
    handleLinkClick(p);
    return;
  }
  const hit = pinMode ? pick(p) : -1;
  if (hit >= 0) {
    togglePinOf(hit);
    return;
  }
  panning = { id: ev.pointerId, x: p.x, y: p.y };
  canvas.setPointerCapture(ev.pointerId);
  canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", (ev) => {
  if (!panning || ev.pointerId !== panning.id) return;
  const p = localPoint(ev);
  view.panX += p.x - panning.x;
  view.panY += p.y - panning.y;
  panning.x = p.x;
  panning.y = p.y;
  updatePivot();
});

function endPan(ev) {
  if (!panning || ev.pointerId !== panning.id) return;
  panning = null;
  canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);

// Cuộn chuột để zoom quanh con trỏ.
canvas.addEventListener(
  "wheel",
  (ev) => {
    ev.preventDefault();
    const p = localPoint(ev);
    zoomAt(p.x, p.y, Math.exp(-ev.deltaY * 0.0015));
  },
  { passive: false }
);

// Nhấp đúp vào nền (chế độ thường) để về khung nhìn mặc định.
canvas.addEventListener("dblclick", () => {
  if (!linkMode && !pinMode) resetView();
});

window.addEventListener("keydown", (ev) => {
  if (ev.key === "r" || ev.key === "R") {
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

arrangeBtn.addEventListener("click", arrangePins);
relaxBtn.addEventListener("click", () => startRelax("đang cân bằng..."));
lessBtn.addEventListener("click", removeNode);
moreBtn.addEventListener("click", addNode);
linkModeBtn.addEventListener("click", toggleLinkMode);
pinModeBtn.addEventListener("click", togglePinMode);
netBtn.addEventListener("click", () =>
  netStructure(parseInt(netNEl.value, 10), parseInt(netEEl.value, 10), parseInt(netPEl.value, 10))
);

window.addEventListener("resize", resize);

netStructure(20, 26, 2); // lưới ngẫu nhiên mặc định khi mở trang
resize();
requestAnimationFrame(frame);

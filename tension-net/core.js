// Lõi mô phỏng lưới sợi chỉ 3D, có trọng lực (không DOM).
//
// Trục y hướng xuống (y = 0 là trần, y tăng là xuống dưới). Mỗi sợi k nối hai node, có chiều
// dài nghỉ L_k, chỉ chịu kéo. Năng lượng:
//     E = Σ_k (κ/2) · max(0, |p_b − p_a| − L_k)²  −  g · Σ_i y_i        (i: node tự do)
// κ là độ cứng sợi, g là gia tốc trọng lực. Tỉ số g/κ quyết định độ giãn của sợi lúc cân bằng.
// Hàm lồi, khả vi liên tục. Node ghim cố định (thường nằm trên mặt phẳng trần y = 0).
//
// Các phần:
//   createNet   - dựng đồ thị từ tọa độ, cờ ghim, sợi, chiều dài nghỉ, κ, g
//   activeSet   - node tự do thuộc cụm có ít nhất 1 ghim (cụm khác sẽ rơi vô hạn nên bỏ)
//   sweep       - Gauss–Seidel: mỗi node tự do cực tiểu hóa E theo vị trí của nó (Newton 3×3)
//   Solver      - chạy sweep theo đợt tới khi độ dời nhỏ
//   energy, diagnostics - năng lượng, độ giãn sợi, lực dư
//   buildSheet  - lưới phẳng ngẫu nhiên (ban đầu nằm trên trần), sợi có chiều dài ngẫu nhiên

(function (global) {
  'use strict';

  function createNet(P, pinFlags, edges, L, kappa = 1000, g = 1) {
    const N = P.length;
    const adj = Array.from({ length: N }, () => []);
    edges.forEach(([a, b], k) => {
      adj[a].push([b, k]);
      adj[b].push([a, k]);
    });
    return {
      N,
      X: Float64Array.from(P, (p) => p[0]),
      Y: Float64Array.from(P, (p) => p[1]),
      Z: Float64Array.from(P, (p) => p[2]),
      pin: Uint8Array.from(pinFlags, (v) => (v ? 1 : 0)),
      edges: edges.map(([a, b]) => [a, b]),
      L: Float64Array.from(L),
      kappa,
      g,
      adj,
    };
  }

  // alive[i]: node tham gia (ghim luôn hiển thị; node tự do phải nối với ít nhất 1 ghim)
  // edgeOn[k]: sợi tham gia (cả hai đầu alive)
  // nbE[i]   : [láng giềng j, sợi k] qua các sợi tham gia
  function activeSet(net) {
    const { N, edges, adj, pin } = net;
    const alive = new Uint8Array(N).fill(1);
    const comp = new Int32Array(N).fill(-1);
    const compPins = [];
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue;
      const id = compPins.length;
      const members = [];
      let pinsHere = 0;
      const q = [s];
      comp[s] = id;
      while (q.length) {
        const u = q.pop();
        members.push(u);
        if (pin[u]) pinsHere++;
        for (const [v] of adj[u]) if (comp[v] < 0) {
          comp[v] = id;
          q.push(v);
        }
      }
      if (pinsHere < 1) for (const u of members) alive[u] = 0;
      compPins.push(pinsHere);
    }
    const edgeOn = new Uint8Array(edges.length);
    const nbE = Array.from({ length: N }, () => []);
    edges.forEach(([a, b], k) => {
      if (alive[a] && alive[b]) {
        edgeOn[k] = 1;
        nbE[a].push([b, k]);
        nbE[b].push([a, k]);
      }
    });
    return { alive, edgeOn, nbE };
  }

  function energy(net, act) {
    const { X, Y, Z, edges, L, kappa, g, N, pin } = net;
    let E = 0;
    edges.forEach(([a, b], k) => {
      if (!act.edgeOn[k]) return;
      const s = Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]) - L[k];
      if (s > 0) E += 0.5 * kappa * s * s;
    });
    for (let i = 0; i < N; i++) if (!pin[i] && act.alive[i]) E -= g * Y[i];
    return E;
  }

  function localEnergy(net, act, i, x, y, z) {
    const { X, Y, Z, L, kappa, g } = net;
    let e = -g * y;
    for (const [j, k] of act.nbE[i]) {
      const s = Math.hypot(x - X[j], y - Y[j], z - Z[j]) - L[k];
      if (s > 0) e += 0.5 * kappa * s * s;
    }
    return e;
  }

  // Giải hệ 3×3 bằng khử Gauss có chọn trụ.
  function solve3(A, b) {
    const M = [A[0].slice(), A[1].slice(), A[2].slice()];
    const v = b.slice();
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      [v[c], v[p]] = [v[p], v[c]];
      if (M[c][c] === 0) return null;
      for (let r = c + 1; r < 3; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k < 3; k++) M[r][k] -= f * M[c][k];
        v[r] -= f * v[c];
      }
    }
    const x = [0, 0, 0];
    for (let r = 2; r >= 0; r--) {
      let s = v[r];
      for (let k = r + 1; k < 3; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  // Cực tiểu hóa cục bộ theo vị trí node i: Newton 3×3 có kiểm tra giảm năng lượng.
  function relaxNode(net, act, i) {
    const { X, Y, Z, L, kappa, g } = net;
    let x = X[i], y = Y[i], z = Z[i];
    for (let it = 0; it < 12; it++) {
      let gx = 0, gy = -g, gz = 0;
      const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const [j, k] of act.nbE[i]) {
        const ux = x - X[j], uy = y - Y[j], uz = z - Z[j];
        const d = Math.hypot(ux, uy, uz);
        const s = d - L[k];
        if (s <= 0 || d === 0) continue;
        const n = [ux / d, uy / d, uz / d];
        const c = s / d;
        gx += kappa * s * n[0];
        gy += kappa * s * n[1];
        gz += kappa * s * n[2];
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          H[a][b] += kappa * (n[a] * n[b] + c * ((a === b ? 1 : 0) - n[a] * n[b]));
        }
      }
      const reg = 1e-9 * kappa + 1e-12;
      for (let a = 0; a < 3; a++) H[a][a] += reg;
      let dlt = solve3(H, [-gx, -gy, -gz]);
      if (!dlt) break;
      // giới hạn bước để node không nhảy xa khi chưa có sợi căng (đường cong phẳng)
      const len = Math.hypot(dlt[0], dlt[1], dlt[2]);
      if (len > 0.5) dlt = dlt.map((v) => (v * 0.5) / len);
      const e0 = localEnergy(net, act, i, x, y, z);
      let t = 1, moved = false;
      for (let ls = 0; ls < 40; ls++) {
        const nx = x + t * dlt[0], ny = y + t * dlt[1], nz = z + t * dlt[2];
        if (localEnergy(net, act, i, nx, ny, nz) <= e0 - 1e-18) {
          x = nx; y = ny; z = nz;
          moved = true;
          break;
        }
        t *= 0.5;
      }
      if (!moved || t * Math.hypot(dlt[0], dlt[1], dlt[2]) < 1e-13) break;
    }
    return [x, y, z];
  }

  // omega: hệ số nới lỏng (SOR). omega = 1 là Gauss–Seidel thuần.
  function sweep(net, act, omega = 1) {
    const { X, Y, Z, pin, N } = net;
    let maxMove = 0;
    for (let i = 0; i < N; i++) {
      if (pin[i] || !act.alive[i] || act.nbE[i].length === 0) continue;
      const [rx, ry, rz] = relaxNode(net, act, i);
      const x = X[i] + omega * (rx - X[i]);
      const y = Y[i] + omega * (ry - Y[i]);
      const z = Z[i] + omega * (rz - Z[i]);
      maxMove = Math.max(maxMove, Math.abs(x - X[i]), Math.abs(y - Y[i]), Math.abs(z - Z[i]));
      X[i] = x; Y[i] = y; Z[i] = z;
    }
    return maxMove;
  }

  class Solver {
    constructor(net, act, opts = {}) {
      this.net = net;
      this.act = act;
      this.tol = opts.tol || 1e-8;
      // SOR: ω = 1.6 nhanh nhất trên lưới cỡ vừa, nhưng mất ổn định ở 1536 node;
      // lưới lớn dùng ω = 1.3 (đo: hội tụ ở 1536 và 3072 node, còn ω = 1 chậm hơn ~1.7–1.9 lần).
      this.omega = opts.omega || (net.N <= 1000 ? 1.6 : 1.3);
      this.maxSweeps = opts.maxSweeps || 20000;
      this.sweeps = 0;
      this.lastMove = Infinity;
      this.done = false;
    }

    step(budget) {
      let used = 0;
      while (!this.done && used < budget) {
        this.lastMove = sweep(this.net, this.act, this.omega);
        used++;
        this.sweeps++;
        if (this.lastMove < this.tol || this.sweeps >= this.maxSweeps) this.done = true;
      }
      return { done: this.done, move: this.lastMove };
    }

    get converged() {
      return this.done && this.lastMove < this.tol;
    }
  }

  // Chẩn đoán: số sợi căng, độ giãn lớn nhất, tổng chiều dài sợi căng, năng lượng, lực dư.
  // Lực dư tại node tự do: κ Σ s·n − g·ŷ (bằng 0 ở cân bằng).
  function diagnostics(net, act) {
    const { X, Y, Z, N, edges, L, kappa, g, pin } = net;
    let taut = 0, ropes = 0, total = 0, maxStretch = 0;
    edges.forEach(([a, b], k) => {
      if (!act.edgeOn[k]) return;
      const d = Math.hypot(X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]);
      ropes++;
      total += d;
      const s = d - L[k];
      if (s > 1e-9) { taut++; maxStretch = Math.max(maxStretch, s); }
    });
    let maxRes = 0, freeNodes = 0;
    for (let i = 0; i < N; i++) {
      if (pin[i] || !act.alive[i]) continue;
      freeNodes++;
      let fx = 0, fy = -g, fz = 0;
      for (const [j, k] of act.nbE[i]) {
        const ux = X[i] - X[j], uy = Y[i] - Y[j], uz = Z[i] - Z[j];
        const d = Math.hypot(ux, uy, uz);
        const s = d - L[k];
        if (s > 0 && d > 0) {
          fx += kappa * s * ux / d;
          fy += kappa * s * uy / d;
          fz += kappa * s * uz / d;
        }
      }
      maxRes = Math.max(maxRes, Math.hypot(fx, fy, fz));
    }
    return { taut, ropes, total, maxStretch, freeNodes, energy: energy(net, act), maxRes };
  }

  // Lưới phẳng cols × rows nằm trên trần (y = 0), tâm ở gốc (x, z). Sợi nối 8 hướng,
  // luôn có cây khung để liên thông, tối đa m sợi. Chiều dài nghỉ = khoảng cách ban đầu × hệ số
  // ngẫu nhiên trong [lo, hi].
  // pins: danh sách chỉ số node ghim. Sợi nối với ghim được ưu tiên chọn trước để mỗi ghim
  // có nhiều sợi nhất có thể (tối đa 8 hướng trên lưới).
  function buildSheet(cols, rows, m, rand = Math.random, lo = 0.8, hi = 1.2, pins = []) {
    cols = Math.max(2, Math.floor(cols));
    rows = Math.max(2, Math.floor(rows));
    const n = cols * rows;
    const P = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      P.push([c - (cols - 1) / 2, 0, r - (rows - 1) / 2]);
    }
    const cand = [];
    for (let a = 0; a < n; a++) {
      const ra = Math.floor(a / cols), ca = a % cols;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rb = ra + dr, cb = ca + dc;
        if (rb < 0 || cb < 0 || rb >= rows || cb >= cols) continue;
        const b = rb * cols + cb;
        if (b > a) cand.push([a, b]);
      }
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    const pinSet = new Set(pins);
    const touches = ([a, b]) => pinSet.has(a) || pinSet.has(b);
    const ordered = cand.filter(touches).concat(cand.filter((c) => !touches(c)));
    const uf = Array.from({ length: n }, (_, i) => i);
    const find = (x) => (uf[x] === x ? x : (uf[x] = find(uf[x])));
    const tree = [], rest = [];
    for (const [a, b] of ordered) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) { uf[ra] = rb; tree.push([a, b]); } else rest.push([a, b]);
    }
    const count = Math.min(cand.length, Math.max(n - 1, Math.floor(m)));
    const edges = tree.concat(rest.slice(0, count - tree.length));
    const L = edges.map(([a, b]) => {
      const d = Math.hypot(P[b][0] - P[a][0], P[b][2] - P[a][2]);
      return d * (lo + rand() * (hi - lo));
    });
    return { P, edges, L, cols, rows };
  }

  // ---- Chu trình qua các ghim ----

  // Dijkstra từ node s trên các sợi tham gia, trọng số = chiều dài nghỉ L (đường căng có độ dài
  // đúng L). O(V²), đủ nhanh cho lưới cỡ vài trăm node. Trả về {dist, prev}.
  function dijkstra(net, act, s) {
    const N = net.N;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    // heap nhị phân (lazy): các cặp [khoảng cách, node]
    const hd = [], hv = [];
    const push = (d, v) => {
      let i = hd.length;
      hd.push(d); hv.push(v);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hd[p] <= hd[i]) break;
        [hd[p], hd[i]] = [hd[i], hd[p]];
        [hv[p], hv[i]] = [hv[i], hv[p]];
        i = p;
      }
    };
    const pop = () => {
      const d = hd[0], v = hv[0];
      const ld = hd.pop(), lv = hv.pop();
      if (hd.length > 0) {
        hd[0] = ld; hv[0] = lv;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < hd.length && hd[l] < hd[m]) m = l;
          if (r < hd.length && hd[r] < hd[m]) m = r;
          if (m === i) break;
          [hd[m], hd[i]] = [hd[i], hd[m]];
          [hv[m], hv[i]] = [hv[i], hv[m]];
          i = m;
        }
      }
      return [d, v];
    };
    dist[s] = 0;
    push(0, s);
    while (hd.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      for (const [v, k] of act.nbE[u]) {
        const nd = d + net.L[k];
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(nd, v); }
      }
    }
    return { dist, prev };
  }

  // Khoảng cách giữa mọi cặp ghim (theo đường sợi ngắn nhất). pinIdx: danh sách chỉ số ghim.
  function pinDistances(net, act, pinIdx) {
    const m = pinIdx.length;
    const D = Array.from({ length: m }, () => new Array(m).fill(Infinity));
    for (let a = 0; a < m; a++) {
      const { dist } = dijkstra(net, act, pinIdx[a]);
      for (let b = 0; b < m; b++) D[a][b] = dist[pinIdx[b]];
    }
    return D;
  }

  // Chèn xa nhất (farthest insertion) cho bài TSP đối xứng trên ma trận khoảng cách D.
  // Bắt đầu từ cặp xa nhau nhất; mỗi bước chọn điểm xa tập đã chọn nhất rồi chèn vào cạnh
  // làm tăng độ dài chu trình ít nhất. Trả về {order, length}: order là hoán vị các chỉ số.
  function farthestInsertionTour(D) {
    const m = D.length;
    if (m === 0) return { order: [], length: 0, snapshots: [] };
    if (m === 1) return { order: [0], length: 0, snapshots: [[0]] };
    let a = 0, b = 1;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) if (D[i][j] > D[a][b]) { a = i; b = j; }
    let tour = [a, b];
    const snapshots = [tour.slice()];
    const inTour = new Uint8Array(m);
    inTour[a] = 1;
    inTour[b] = 1;
    while (tour.length < m) {
      // điểm ngoài tour có khoảng cách tới tập đã chọn lớn nhất
      let k = -1, best = -Infinity;
      for (let c = 0; c < m; c++) {
        if (inTour[c]) continue;
        let md = Infinity;
        for (const t of tour) md = Math.min(md, D[c][t]);
        if (md > best) { best = md; k = c; }
      }
      // chèn k vào vị trí tăng độ dài chu trình ít nhất
      let pos = 0, inc = Infinity;
      for (let p = 0; p < tour.length; p++) {
        const i = tour[p], j = tour[(p + 1) % tour.length];
        const c = D[i][k] + D[k][j] - D[i][j];
        if (c < inc) { inc = c; pos = p + 1; }
      }
      tour = tour.slice(0, pos).concat([k], tour.slice(pos));
      snapshots.push(tour.slice());
      inTour[k] = 1;
    }
    let length = 0;
    for (let p = 0; p < m; p++) length += D[tour[p]][tour[(p + 1) % m]];
    return { order: tour, length, snapshots };
  }

  // Các node nằm trên ít nhất một đường ngắn nhất giữa hai ghim liền kề trong chu trình.
  // Node ngoài tập này là node thừa (làm mờ). Trả về Uint8Array theo chỉ số node.
  function usedNodes(net, act, pinOrder) {
    const used = new Uint8Array(net.N);
    const m = pinOrder.length;
    for (let p = 0; p < m; p++) {
      const s = pinOrder[p], t = pinOrder[(p + 1) % m];
      if (s === t) { used[s] = 1; continue; }
      const { dist, prev } = dijkstra(net, act, s);
      if (dist[t] === Infinity) continue;
      for (let c = t; c >= 0; c = prev[c]) used[c] = 1;
    }
    return used;
  }

  // Cây đường đi ngắn nhất từ mỗi ghim, tính một lần rồi dùng lại cho khoảng cách, đoạn
  // đường và node thừa. Trả về Map: chỉ số node ghim → {dist, prev}.
  function shortestTrees(net, act, pinIdx) {
    const trees = new Map();
    for (const s of pinIdx) if (!trees.has(s)) trees.set(s, dijkstra(net, act, s));
    return trees;
  }

  // Ma trận khoảng cách giữa các ghim từ các cây đã tính.
  function pinDistancesT(trees, pinIdx) {
    return pinIdx.map((a) => pinIdx.map((b) => trees.get(a).dist[b]));
  }

  // Dãy node từ s đến t trên cây đường đi của s (rỗng nếu không tới được).
  function pathNodes(trees, s, t) {
    const { dist, prev } = trees.get(s);
    if (dist[t] === Infinity) return [];
    const out = [];
    for (let c = t; c >= 0; c = prev[c]) {
      out.push(c);
      if (c === s) break;
    }
    return out.reverse();
  }

  // Node thừa: các node nằm trên đường giữa hai ghim liền kề trong chu trình.
  function usedNodesT(net, trees, pinOrder) {
    const used = new Uint8Array(net.N);
    const m = pinOrder.length;
    for (let p = 0; p < m; p++) {
      const s = pinOrder[p], t = pinOrder[(p + 1) % m];
      if (s === t) { used[s] = 1; continue; }
      for (const c of pathNodes(trees, s, t)) used[c] = 1;
    }
    return used;
  }

  // Held–Karp: chu trình ngắn nhất đúng trên ma trận D (m ≤ 12). DP theo tập con, truy vết
  // thứ tự qua bảng cha. Trả về {order (bắt đầu từ 0), length}.
  function heldKarpTour(D) {
    const m = D.length;
    if (m === 0) return { order: [], length: 0 };
    if (m === 1) return { order: [0], length: 0 };
    if (m === 2) return { order: [0, 1], length: 2 * D[0][1] };
    const FULL = 1 << m;
    const dp = Array.from({ length: FULL }, () => new Float64Array(m).fill(Infinity));
    const par = Array.from({ length: FULL }, () => new Int8Array(m).fill(-1));
    dp[1][0] = 0;
    for (let S = 1; S < FULL; S++) {
      if (!(S & 1)) continue;
      for (let j = 0; j < m; j++) {
        if (dp[S][j] === Infinity || !(S & (1 << j))) continue;
        for (let k = 0; k < m; k++) {
          if (S & (1 << k)) continue;
          const T = S | (1 << k);
          const v = dp[S][j] + D[j][k];
          if (v < dp[T][k]) { dp[T][k] = v; par[T][k] = j; }
        }
      }
    }
    let best = Infinity, bj = -1;
    for (let j = 1; j < m; j++) {
      const v = dp[FULL - 1][j] + D[j][0];
      if (v < best) { best = v; bj = j; }
    }
    const order = [];
    let S = FULL - 1, j = bj;
    while (j !== -1) {
      order.push(j);
      const pj = par[S][j];
      S ^= 1 << j;
      j = pj;
    }
    order.reverse();
    return { order, length: best };
  }

  // Chu trình tốt nhất có thể: Held–Karp khi m ≤ 12 (tối ưu), ngược lại chèn xa nhất.
  // Trả về {order, length, exact, heuristicLength}; order là chỉ số local.
  function bestTour(D) {
    const h = farthestInsertionTour(D);
    if (D.length < 3 || D.length > 12) {
      return { order: h.order, length: h.length, exact: false, heuristicLength: h.length };
    }
    const e = heldKarpTour(D);
    return { order: e.order, length: e.length, exact: true, heuristicLength: h.length };
  }

  // Loại node thừa trước khi cân bằng. Chu trình và các node nằm trên đường ngắn nhất giữa
  // các ghim liền kề chỉ phụ thuộc vào chiều dài nghỉ L, không phụ thuộc vị trí cân bằng,
  // nên tính được trên đồ thị đầy đủ (act0). Các node khác bị bỏ khỏi cân bằng.
  // Trả về {alive, edgeOn, nbE} mới, dùng thay cho activeSet.
  function cyclePrune(net, act0) {
    const pinIdx = [];
    for (let i = 0; i < net.N; i++) if (net.pin[i] && act0.alive[i]) pinIdx.push(i);
    if (pinIdx.length < 3) return act0;
    const trees = shortestTrees(net, act0, pinIdx);
    const D = pinDistancesT(trees, pinIdx);
    // giữ mọi node nằm trên đường của cả chu trình chèn xa nhất và chu trình tối ưu
    const best = bestTour(D);
    const orders = [best.order];
    if (best.exact) orders.push(farthestInsertionTour(D).order);
    const used = new Uint8Array(net.N);
    for (const o of orders) {
      const u = usedNodesT(net, trees, o.map((k) => pinIdx[k]));
      for (let i = 0; i < net.N; i++) if (u[i]) used[i] = 1;
    }
    const alive = new Uint8Array(net.N);
    for (let i = 0; i < net.N; i++) alive[i] = act0.alive[i] && (net.pin[i] || used[i]) ? 1 : 0;
    const edgeOn = new Uint8Array(net.edges.length);
    const nbE = Array.from({ length: net.N }, () => []);
    net.edges.forEach(([a, b], k) => {
      if (alive[a] && alive[b]) {
        edgeOn[k] = 1;
        nbE[a].push([b, k]);
        nbE[b].push([a, k]);
      }
    });
    return { alive, edgeOn, nbE };
  }

  const api = {
    cyclePrune,
    heldKarpTour, bestTour, shortestTrees, pinDistancesT, pathNodes, usedNodesT,
    createNet, activeSet, energy, sweep, Solver, diagnostics, buildSheet,
    dijkstra, pinDistances, farthestInsertionTour, usedNodes,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

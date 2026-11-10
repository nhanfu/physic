// Lõi mô phỏng mạng sợi chỉ (không DOM, không trọng lực).
//
// Mỗi sợi k nối hai node a, b có chiều dài L_k. Sợi chỉ chịu kéo: chỉ khi |p_b − p_a| > L_k
// nó mới kéo hai đầu vào trong. Năng lượng:
//     E = Σ_k ½ · max(0, |p_b − p_a| − L_k)²
// Đây là hàm lồi theo vị trí, khả vi liên tục (C¹). Node ghim cố định. Hằng số độ cứng không
// ảnh hưởng nghiệm cực tiểu nên bỏ đi. Khi kéo các ghim ra xa, sợi căng hiện ra thành các
// đường nối giữa ghim.
//
// Các phần:
//   createNet   - dựng đồ thị (tọa độ, cờ ghim, cạnh, chiều dài)
//   activeSet   - bóc node tự do bậc ≤ 1 và bỏ cụm có ít hơn 2 ghim
//   sweep       - một vòng Gauss–Seidel: mỗi node tự do cực tiểu hóa E theo vị trí của nó
//   Solver      - chạy sweep theo đợt, dừng khi độ dời nhỏ
//   energy, diagnostics - năng lượng, chiều dài sợi căng, lực dư
//   buildLattice- lưới ngẫu nhiên có liên thông, chiều dài sợi ngẫu nhiên

(function (global) {
  'use strict';

  function createNet(X0, Y0, pinFlags, edges, lengths) {
    const N = X0.length;
    const adj = Array.from({ length: N }, () => []);
    edges.forEach(([a, b], k) => {
      adj[a].push([b, k]);
      adj[b].push([a, k]);
    });
    return {
      N,
      X: Float64Array.from(X0),
      Y: Float64Array.from(Y0),
      pin: Uint8Array.from(pinFlags, (v) => (v ? 1 : 0)),
      edges: edges.map(([a, b]) => [a, b]),
      L: Float64Array.from(lengths),
      adj,
    };
  }

  // Phần mạng tham gia cân bằng:
  //  - alive[i] : node còn tham gia (node ghim luôn còn để hiển thị)
  //  - edgeOn[k]: sợi k tham gia
  //  - nbE[i]   : danh sách [láng giềng j, sợi k] qua các sợi tham gia
  function activeSet(net) {
    const { N, edges, adj, pin } = net;
    const deg = new Int32Array(N);
    for (const [a, b] of edges) {
      deg[a]++;
      deg[b]++;
    }
    const alive = new Uint8Array(N).fill(1);
    const stack = [];
    for (let i = 0; i < N; i++) if (!pin[i] && deg[i] <= 1) stack.push(i);
    while (stack.length) {
      const i = stack.pop();
      if (!alive[i]) continue;
      alive[i] = 0;
      for (const [j] of adj[i]) {
        if (alive[j]) {
          deg[j]--;
          if (!pin[j] && deg[j] <= 1) stack.push(j);
        }
      }
    }

    const comp = new Int32Array(N).fill(-1);
    const compPins = [];
    for (let s = 0; s < N; s++) {
      if (!alive[s] || comp[s] >= 0) continue;
      const id = compPins.length;
      const members = [];
      let pinsHere = 0;
      const q = [s];
      comp[s] = id;
      while (q.length) {
        const u = q.pop();
        members.push(u);
        if (pin[u]) pinsHere++;
        for (const [v] of adj[u]) {
          if (alive[v] && comp[v] < 0) {
            comp[v] = id;
            q.push(v);
          }
        }
      }
      if (pinsHere < 2) for (const u of members) if (!pin[u]) alive[u] = 0;
      compPins.push(pinsHere);
    }

    const edgeOn = new Uint8Array(edges.length);
    const nbE = Array.from({ length: N }, () => []);
    edges.forEach(([a, b], k) => {
      if (alive[a] && alive[b] && compPins[comp[a]] >= 2) {
        edgeOn[k] = 1;
        nbE[a].push([b, k]);
        nbE[b].push([a, k]);
      }
    });
    return { alive, edgeOn, nbE };
  }

  // Năng lượng của các sợi tham gia.
  function energy(net, act) {
    const { X, Y, edges, L } = net;
    let E = 0;
    edges.forEach(([a, b], k) => {
      if (!act.edgeOn[k]) return;
      const s = Math.hypot(X[b] - X[a], Y[b] - Y[a]) - L[k];
      if (s > 0) E += 0.5 * s * s;
    });
    return E;
  }

  // Năng lượng cục bộ của node i khi đặt tại (x, y), các sợi quanh i.
  function localEnergy(net, act, i, x, y) {
    const { X, Y, L } = net;
    let e = 0;
    for (const [j, k] of act.nbE[i]) {
      const s = Math.hypot(x - X[j], y - Y[j]) - L[k];
      if (s > 0) e += 0.5 * s * s;
    }
    return e;
  }

  // Cực tiểu hóa cục bộ theo vị trí node i: Newton có kiểm tra giảm năng lượng.
  // Hàm theo p_i là lồi nên Newton với Hessian xác định không âm hội tụ tốt.
  function relaxNode(net, act, i) {
    const { X, Y } = net;
    let x = X[i], y = Y[i];
    for (let it = 0; it < 6; it++) {
      let gx = 0, gy = 0, hxx = 0, hxy = 0, hyy = 0, active = false;
      for (const [j, k] of act.nbE[i]) {
        const ux = x - X[j], uy = y - Y[j];
        const d = Math.hypot(ux, uy);
        const s = d - net.L[k];
        if (s <= 0 || d === 0) continue;
        active = true;
        const nx = ux / d, ny = uy / d;
        gx += s * nx;
        gy += s * ny;
        // ∇²(½s²) = ∇s∇sᵀ + s∇²s,  ∇s = n,  ∇²s = (I − nnᵀ)/d
        const c = s / d;
        hxx += nx * nx + c * (1 - nx * nx);
        hxy += nx * ny - c * nx * ny;
        hyy += ny * ny + c * (1 - ny * ny);
      }
      if (!active) break;
      const reg = 1e-12 * (hxx + hyy + 1);
      const a = hxx + reg, b = hxy, c2 = hyy + reg;
      const det = a * c2 - b * b;
      if (!(det > 0)) break;
      const dx = -(c2 * gx - b * gy) / det;
      const dy = -(-b * gx + a * gy) / det;
      const e0 = localEnergy(net, act, i, x, y);
      let t = 1;
      let moved = false;
      for (let ls = 0; ls < 30; ls++) {
        const nxp = x + t * dx, nyp = y + t * dy;
        if (localEnergy(net, act, i, nxp, nyp) <= e0 - 1e-16) {
          x = nxp;
          y = nyp;
          moved = true;
          break;
        }
        t *= 0.5;
      }
      if (!moved) break;
      if (Math.hypot(t * dx, t * dy) < 1e-12) break;
    }
    return [x, y];
  }

  // Một vòng Gauss–Seidel. Trả về độ dời lớn nhất của node.
  function sweep(net, act) {
    const { X, Y, pin, N } = net;
    let maxMove = 0;
    for (let i = 0; i < N; i++) {
      if (pin[i] || !act.alive[i]) continue;
      if (act.nbE[i].length === 0) continue;
      const [x, y] = relaxNode(net, act, i);
      maxMove = Math.max(maxMove, Math.abs(x - X[i]), Math.abs(y - Y[i]));
      X[i] = x;
      Y[i] = y;
    }
    return maxMove;
  }

  class Solver {
    constructor(net, act, opts = {}) {
      this.net = net;
      this.act = act;
      this.tol = opts.tol || 1e-9;
      this.maxSweeps = opts.maxSweeps || 200000;
      this.sweeps = 0;
      this.lastMove = Infinity;
      this.done = false;
    }

    step(budget) {
      let used = 0;
      while (!this.done && used < budget) {
        this.lastMove = sweep(this.net, this.act);
        used++;
        this.sweeps++;
        if (this.lastMove < this.tol) this.done = true;
        if (this.sweeps >= this.maxSweeps) this.done = true;
      }
      return { done: this.done, move: this.lastMove };
    }

    get converged() {
      return this.done && this.lastMove < this.tol;
    }
  }

  // Chẩn đoán: chiều dài sợi đang căng, số sợi căng, năng lượng, lực dư lớn nhất.
  // Lực dư: tổng lực căng (s·n) tác dụng lên mỗi node tự do; ở cân bằng bằng 0.
  function diagnostics(net, act) {
    const { X, Y, N, edges, pin, L } = net;
    let total = 0, ropes = 0, taut = 0;
    edges.forEach(([a, b], k) => {
      if (!act.edgeOn[k]) return;
      const d = Math.hypot(X[b] - X[a], Y[b] - Y[a]);
      total += d;
      ropes++;
      if (d > L[k] + 1e-9) taut++;
    });
    let maxRes = 0, freeNodes = 0;
    for (let i = 0; i < N; i++) {
      if (pin[i] || !act.alive[i]) continue;
      freeNodes++;
      let fx = 0, fy = 0;
      for (const [j, k] of act.nbE[i]) {
        const ux = X[i] - X[j], uy = Y[i] - Y[j];
        const d = Math.hypot(ux, uy);
        const s = d - L[k];
        if (s > 0 && d > 0) {
          fx += s * ux / d;
          fy += s * uy / d;
        }
      }
      maxRes = Math.max(maxRes, Math.hypot(fx, fy));
    }
    return { total, ropes, taut, freeNodes, energy: energy(net, act), maxRes };
  }

  // Lưới n node (xếp gần vuông, cách nhau 1), tối đa m sợi, luôn có cây khung để liên thông.
  // Sợi nối 8 hướng lân cận. Chiều dài L_k = khoảng cách lưới × hệ số ngẫu nhiên trong [lo, hi].
  function buildLattice(n, m, rand = Math.random, lo = 0.75, hi = 1.25) {
    n = Math.max(2, Math.floor(n));
    const cols = Math.ceil(Math.sqrt(n));
    const X0 = [], Y0 = [];
    for (let k = 0; k < n; k++) {
      X0.push((k % cols) - (cols - 1) / 2);
      Y0.push(Math.floor(k / cols));
    }
    const cand = [];
    for (let a = 0; a < n; a++) {
      const ra = Math.floor(a / cols), ca = a % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rb = ra + dr, cb = ca + dc;
          if (rb < 0 || cb < 0 || cb >= cols) continue;
          const b = rb * cols + cb;
          if (b <= a || b >= n) continue;
          cand.push([a, b]);
        }
      }
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    const uf = Array.from({ length: n }, (_, i) => i);
    const find = (x) => (uf[x] === x ? x : (uf[x] = find(uf[x])));
    const tree = [], rest = [];
    for (const [a, b] of cand) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) {
        uf[ra] = rb;
        tree.push([a, b]);
      } else rest.push([a, b]);
    }
    const count = Math.min(cand.length, Math.max(n - 1, Math.floor(m)));
    const edges = tree.concat(rest.slice(0, count - tree.length));
    const lengths = edges.map(([a, b]) => {
      const d = Math.hypot(X0[b] - X0[a], Y0[b] - Y0[a]);
      return d * (lo + rand() * (hi - lo));
    });
    return { X0, Y0, edges, lengths, cols };
  }

  const api = { createNet, activeSet, energy, sweep, Solver, diagnostics, buildLattice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

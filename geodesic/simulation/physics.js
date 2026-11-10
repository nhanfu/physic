/*
 * physics.js — Đường trắc địa Schwarzschild cho quỹ đạo Trái Đất quanh Mặt Trời.
 *
 * Đơn vị hình học: G = c = 1, độ dài tính bằng AU, thời gian tính bằng "AU/c"
 * (≈ 499 giây). Khi đó khối lượng Mặt Trời M = GM☉/(c²·AU) ≈ 9.87e-9 AU.
 *
 * Toàn bộ chuyển động nằm trong mặt phẳng xích đạo θ = π/2, nên trạng thái
 * của đường trắc địa là
 *     y = [t, r, φ, uᵗ, uʳ, uᵠ, D]
 * với uᵘ = dxᵘ/dτ (τ = thời gian riêng) và D = t − τ (độ trễ đồng hồ Trái Đất
 * so với đồng hồ ở vô cực, tích phân riêng để giữ độ chính xác).
 *
 * Phương trình trắc địa:   d²xᵘ/dτ² = −Γᵘ_αβ uᵅ uᵝ
 */
(function (root) {
  'use strict';

  // ---------- Hằng số vật lý (SI) ----------
  const C = 299792458;                 // m/s
  const GM_SUN = 1.32712440018e20;     // m³/s²
  const AU = 1.495978707e11;           // m
  const YEAR = 365.25 * 86400;         // s (năm Julius)

  const M_SUN = GM_SUN / (C * C) / AU; // khối lượng Mặt Trời theo AU  ≈ 9.87e-9
  const AU_OVER_C = AU / C;            // 1 đơn vị thời gian hình học = 499 s

  const EARTH = { a: 1.00000261, e: 0.0167086 };

  // ---------- Metric Schwarzschild (mặt phẳng xích đạo) ----------
  // ds² = −(1−2M/r)dt² + dr²/(1−2M/r) + r²dφ²
  function metric(M, r) {
    const f = 1 - 2 * M / r;
    return { gtt: -f, grr: 1 / f, gpp: r * r };
  }

  // Các ký hiệu Christoffel khác 0 tại θ = π/2 (các thành phần chứa θ bị triệt
  // tiêu vì uᶿ = 0 và cosθ = 0).
  function christoffel(M, r) {
    const f = 1 - 2 * M / r;
    return {
      t_tr: M / (r * r * f),     // Γᵗ_tr = Γᵗ_rt
      r_tt: M * f / (r * r),     // Γʳ_tt
      r_rr: -M / (r * r * f),    // Γʳ_rr
      r_pp: -r * f,              // Γʳ_φφ
      p_rp: 1 / r,               // Γᵠ_rφ = Γᵠ_φr
    };
  }

  // Vế phải của hệ phương trình bậc nhất dy/dτ = F(y)
  function geodesicRHS(M, y) {
    const r = y[1], ut = y[3], ur = y[4], up = y[5];
    const G = christoffel(M, r);
    return [
      ut,
      ur,
      up,
      -2 * G.t_tr * ut * ur,
      -G.r_tt * ut * ut - G.r_rr * ur * ur - G.r_pp * up * up,
      -2 * G.p_rp * ur * up,
      ut - 1,                    // dD/dτ = dt/dτ − 1
    ];
  }

  // Newton: y = [x, y, vx, vy], gia tốc = −M r̂ / r²  (thời gian Newton tuyệt đối)
  function newtonRHS(M, s) {
    const x = s[0], y = s[1];
    const r2 = x * x + y * y, r3 = r2 * Math.sqrt(r2);
    return [s[2], s[3], -M * x / r3, -M * y / r3];
  }

  function rk4(F, y, h) {
    const n = y.length, tmp = new Array(n);
    const k1 = F(y);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
    const k2 = F(tmp);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
    const k3 = F(tmp);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    const k4 = F(tmp);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return out;
  }

  // ---------- Hằng số chuyển động ----------
  // Đặt hai điểm quay đầu u₁ = 1/r_p, u₂ = 1/r_a vào (dr/dτ)² = E² − V(r) = 0:
  //   L² [ (u₁+u₂) − 2M(u₁²+u₁u₂+u₂²) ] = 2M,   E² = (1−2Mu₁)(1+L²u₁²)
  // Giới hạn Newton: L² → M·a(1−e²).
  function orbitConstants(M, a, e) {
    const rp = a * (1 - e), ra = a * (1 + e);
    const u1 = 1 / rp, u2 = 1 / ra;
    const den = (u1 + u2) - 2 * M * (u1 * u1 + u1 * u2 + u2 * u2);
    if (!(den > 0)) return { valid: false, rp, ra };
    const L2 = 2 * M / den;
    const E2 = (1 - 2 * M * u1) * (1 + L2 * u1 * u1);
    // Quỹ đạo chỉ ổn định nếu cực đại thế năng nằm trong r_p
    const radii = circularRadii(M, Math.sqrt(L2));
    const valid = !!radii && radii.unstable < rp && E2 < 1;
    return { valid, rp, ra, L: Math.sqrt(L2), E: Math.sqrt(E2) };
  }

  // V_eff(r) = (1 − 2M/r)(1 + L²/r²)   với (dr/dτ)² = E² − V_eff
  function veff(M, L, r) { return (1 - 2 * M / r) * (1 + L * L / (r * r)); }
  function veffNewton(M, L, r) { return 1 - 2 * M / r + L * L / (r * r); }

  // Các bán kính quỹ đạo tròn: dV/dr = 0  ⇔  M r² − L² r + 3ML² = 0
  function circularRadii(M, L) {
    const disc = L ** 4 - 12 * M * M * L * L;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return { stable: (L * L + s) / (2 * M), unstable: (L * L - s) / (2 * M) };
  }

  // Δφ tiên động mỗi vòng theo lý thuyết bậc một: 6πM / (a(1−e²))
  function precessionTheory(M, a, e) { return 6 * Math.PI * M / (a * (1 - e * e)); }

  // ---------- Bộ mô phỏng ----------
  class OrbitSim {
    constructor({ M, a = 1, e = EARTH.e, stepsPerOrbit = 1500 }) {
      this.M = M; this.a = a; this.e = e;
      this.period = 2 * Math.PI * Math.sqrt(a ** 3 / M); // chu kỳ Kepler (đơn vị AU/c)
      this.h0 = this.period / stepsPerOrbit;
      const k = orbitConstants(M, a, e);
      this.k = k;
      this.valid = k.valid;
      this.reset();
    }

    reset() {
      const { M, e, k } = this;
      const rp = k.rp, f = 1 - 2 * M / rp;
      // Bắt đầu tại cận nhật: uʳ = 0, uᵠ = L/r², uᵗ = E/(1−2M/r)
      this.gr = k.valid ? [0, rp, 0, k.E / f, 0, k.L / (rp * rp), 0] : null;
      this.tau = 0;
      const vp = Math.sqrt(M * (1 + e) / rp);
      this.nw = [rp, 0, 0, vp];
      this.nwTime = 0;
      this.nwPhi = 0;
      this.perihelia = [];     // φ (radian, không quấn) tại mỗi lần qua cận nhật
      this.nwPerihelia = [];
      this.orbits = 0;
      this.plunged = false;
    }

    // Bước biến thiên theo r^1.5 — nhỏ ở cận nhật, lớn ở viễn nhật
    stepSize(r) { return this.h0 * Math.pow(r / this.a, 1.5); }

    step() {
      if (this.gr && !this.plunged) {
        const prev = this.gr;
        const h = this.stepSize(prev[1]);
        const next = rk4((y) => geodesicRHS(this.M, y), prev, h);
        this.tau += h;
        // Cận nhật: uʳ đổi dấu − → +. Nội suy tuyến tính để lấy φ chính xác.
        if (prev[4] < 0 && next[4] >= 0) {
          const s = prev[4] / (prev[4] - next[4]);
          this.perihelia.push(prev[2] + s * (next[2] - prev[2]));
          this.orbits++;
        }
        this.gr = next;
        if (next[1] < 2.2 * this.M || !isFinite(next[1])) this.plunged = true;
      }
      // Newton dùng cùng bước theo thời gian (≈ τ trong giới hạn trường yếu)
      const p = this.nw;
      const hn = this.stepSize(Math.hypot(p[0], p[1]));
      const n = rk4((s) => newtonRHS(this.M, s), p, hn);
      // Góc không quấn (unwrapped) để đo tiên động giống hệt phía GR
      let dphi = Math.atan2(n[1], n[0]) - Math.atan2(p[1], p[0]);
      if (dphi < -Math.PI) dphi += 2 * Math.PI;
      if (dphi > Math.PI) dphi -= 2 * Math.PI;
      const phiNext = this.nwPhi + dphi;
      const vrPrev = p[0] * p[2] + p[1] * p[3], vrNext = n[0] * n[2] + n[1] * n[3];
      if (vrPrev < 0 && vrNext >= 0) {
        const s = vrPrev / (vrPrev - vrNext);
        this.nwPerihelia.push(this.nwPhi + s * dphi);
      }
      this.nwPhi = phiNext;
      this.nw = n;
      this.nwTime += hn;
    }

    // Tiên động trung bình mỗi vòng (radian) từ các lần qua cận nhật đo được
    measuredPrecession() {
      const P = this.perihelia;
      if (P.length < 2) return null;
      return (P[P.length - 1] - P[0]) / (P.length - 1) - 2 * Math.PI;
    }
    newtonPrecession() {
      const P = this.nwPerihelia;
      if (P.length < 2) return null;
      return (P[P.length - 1] - P[0]) / (P.length - 1) - 2 * Math.PI;
    }

    // Ràng buộc g_μν uᵘ uᵛ = −1. Sai lệch = độ "trôi" số học.
    normError() {
      if (!this.gr) return NaN;
      const [, r, , ut, ur, up] = this.gr;
      const g = metric(this.M, r);
      return g.gtt * ut * ut + g.grr * ur * ur + g.gpp * up * up + 1;
    }

    position() {
      const y = this.gr;
      return y ? { x: y[1] * Math.cos(y[2]), y: y[1] * Math.sin(y[2]), t: y[0], r: y[1] } : null;
    }
  }

  const api = {
    C, GM_SUN, AU, YEAR, M_SUN, AU_OVER_C, EARTH,
    metric, christoffel, geodesicRHS, newtonRHS, rk4,
    orbitConstants, veff, veffNewton, circularRadii, precessionTheory, OrbitSim,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GRPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

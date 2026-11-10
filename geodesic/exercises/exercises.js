/*
 * exercises.js — Nội dung bài tập. Mỗi bài gồm:
 *   theory / task : HTML (công thức KaTeX trong $...$ hoặc $$...$$)
 *   starter       : code khởi đầu cho người học
 *   solution      : lời giải tham khảo (cũng được dùng để xây `lib` cho các bài sau)
 *   exports       : tên các hàm người học phải định nghĩa
 *   tests         : [{ name, run(api, lib, t) }] — ném lỗi nếu sai
 *   visualize     : (plot, api, lib) => void — vẽ minh họa sau khi chạy
 *
 * `lib` chứa hằng số + lời giải tham khảo của MỌI BÀI TRƯỚC, nên mỗi bài độc lập.
 */
(function (root) {
  'use strict';
  const R = String.raw;

  // ------------------------------------------------------------------
  // Thư viện nền (luôn có sẵn trong lib)
  // ------------------------------------------------------------------
  const BASE_LIB = {
    // Hằng số SI
    G: 6.67430e-11, C: 299792458, M_SUN_KG: 1.98847e30, M_EARTH_KG: 5.9722e24,
    GM_SUN: 1.32712440018e20, GM_EARTH: 3.986004418e14,
    AU: 1.495978707e11, R_SUN: 6.957e8, R_EARTH: 6.371e6, R_GPS: 2.656e7, V_EQUATOR: 465.1,
    DAY: 86400, YEAR: 365.25 * 86400,
    M_SUN_GEOM: 1.32712440018e20 / (299792458 * 299792458),   // GM☉/c² ≈ 1476.6 m
    ARCSEC: 180 * 3600 / Math.PI,                               // radian → giây cung

    // Nghịch đảo ma trận n×n (Gauss–Jordan, chọn trụ một phần)
    inverse(m) {
      const n = m.length, a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
      for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
        if (Math.abs(a[p][c]) < 1e-300) throw new Error('inverse: ma trận suy biến');
        [a[c], a[p]] = [a[p], a[c]];
        const d = a[c][c];
        for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
        for (let r = 0; r < n; r++) {
          if (r === c) continue;
          const f = a[r][c];
          if (f) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
        }
      }
      return a.map((row) => row.slice(n));
    },
    zeros(...dims) {
      const [d, ...rest] = dims;
      return Array.from({ length: d }, () => (rest.length ? BASE_LIB.zeros(...rest) : 0));
    },
  };

  // ------------------------------------------------------------------
  // Bài tập
  // ------------------------------------------------------------------
  const EXERCISES = [];
  const add = (ex) => EXERCISES.push(ex);

  // ================= Chương 1: Công cụ số =================
  add({
    id: 'rk4', module: '1. Công cụ số', title: 'Bộ tích phân Runge–Kutta bậc 4',
    exports: ['rk4Step', 'integrate'],
    theory: R`
<p>Mọi mô phỏng GR rốt cuộc đều là giải hệ phương trình vi phân thường
$\dfrac{dy}{d\lambda} = f(\lambda, y)$. Phương trình trắc địa là bậc 2, nhưng ta luôn đổi nó thành bậc 1
bằng cách gộp vị trí và vận tốc vào một vector trạng thái $y = (x^\mu, u^\mu)$.</p>
<p>Phương pháp Runge–Kutta bậc 4 lấy mẫu độ dốc bốn lần trong mỗi bước:</p>
$$\begin{aligned}
k_1 &= f(t,\, y) & k_2 &= f\!\left(t + \tfrac h2,\, y + \tfrac h2 k_1\right)\\
k_3 &= f\!\left(t + \tfrac h2,\, y + \tfrac h2 k_2\right) & k_4 &= f(t + h,\, y + h\,k_3)
\end{aligned}$$
$$y_{n+1} = y_n + \frac h6\,(k_1 + 2k_2 + 2k_3 + k_4)$$
<p>Sai số toàn cục là $O(h^4)$: giảm $h$ đi 2 lần thì sai số giảm khoảng $2^4 = 16$ lần.
Đây là "động cơ" của toàn bộ phần sau — kể cả mô phỏng quỹ đạo Trái Đất.</p>`,
    task: R`
<ul>
<li><code>rk4Step(f, t, y, h)</code>: trả về <b>mảng mới</b> $y_{n+1}$ (không được sửa <code>y</code>). <code>f(t, y)</code> trả về mảng cùng độ dài.</li>
<li><code>integrate(f, t0, y0, h, n)</code>: chạy <code>n</code> bước, trả về mảng <code>[{ t, y }, ...]</code> gồm <code>n + 1</code> phần tử (kể cả điểm đầu).</li>
</ul>`,
    starter: R`// f(t, y) trả về mảng dy/dt cùng độ dài với y
function rk4Step(f, t, y, h) {
  // TODO: tính k1, k2, k3, k4 rồi trả về mảng y mới
}

// Trả về [{ t, y }, ...] gồm n + 1 phần tử
function integrate(f, t0, y0, h, n) {
  // TODO
}
`,
    solution: R`// y + a·k (mảng mới)
function axpy(y, k, a) {
  const out = new Array(y.length);
  for (let i = 0; i < y.length; i++) out[i] = y[i] + a * k[i];
  return out;
}

function rk4Step(f, t, y, h) {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, axpy(y, k1, h / 2));
  const k3 = f(t + h / 2, axpy(y, k2, h / 2));
  const k4 = f(t + h, axpy(y, k3, h));
  const out = new Array(y.length);
  for (let i = 0; i < y.length; i++) {
    out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

function integrate(f, t0, y0, h, n) {
  const out = [{ t: t0, y: y0.slice() }];
  let y = y0, t = t0;
  for (let i = 0; i < n; i++) {
    y = rk4Step(f, t, y, h);
    t += h;
    out.push({ t, y });
  }
  return out;
}
`,
    hints: [
      'Viết một hàm phụ axpy(y, k, a) trả về mảng y[i] + a·k[i]; bạn sẽ dùng nó 3 lần.',
      'k2 và k3 đều được đánh giá tại t + h/2, nhưng k2 dùng k1 còn k3 dùng k2.',
      'integrate: nhớ cộng dồn t += h sau mỗi bước và push cả điểm ban đầu.',
    ],
    tests: [
      { name: 'dy/dt = −y: 10 bước h = 0.1 cho y(1) ≈ e⁻¹', run(api, lib, t) {
        let y = [1];
        for (let i = 0; i < 10; i++) y = api.rk4Step((_, s) => [-s[0]], i * 0.1, y, 0.1);
        t.close(y[0], Math.exp(-1), 1e-6, 'y(1)');
      } },
      { name: 'Không sửa mảng đầu vào', run(api, lib, t) {
        const y = [1, 2];
        const out = api.rk4Step((_, s) => [s[1], -s[0]], 0, y, 0.1);
        t.ok(y[0] === 1 && y[1] === 2, 'mảng y gốc đã bị thay đổi');
        t.ok(out !== y, 'phải trả về mảng mới');
      } },
      { name: 'Hàm f nhận đúng giá trị t (dy/dt = t² ⇒ y(2) = 8/3)', run(api, lib, t) {
        let y = [0];
        for (let i = 0; i < 4; i++) y = api.rk4Step((tt) => [tt * tt], i * 0.5, y, 0.5);
        t.close(y[0], 8 / 3, 1e-12, 'y(2)');
      } },
      { name: 'Bậc hội tụ ≈ 4 (tỉ số sai số khi chia đôi h ≈ 16)', run(api, lib, t) {
        const err = (h) => {
          let y = [1], n = Math.round(2 / h);
          for (let i = 0; i < n; i++) y = api.rk4Step((_, s) => [-s[0]], i * h, y, h);
          return Math.abs(y[0] - Math.exp(-2));
        };
        const ratio = err(0.2) / err(0.1);
        t.ok(ratio > 12 && ratio < 20, 'tỉ số = ' + ratio.toFixed(2) + ' (mong đợi ~16)');
      } },
      { name: 'integrate: n + 1 điểm, bảo toàn năng lượng dao động điều hòa', run(api, lib, t) {
        const path = api.integrate((_, s) => [s[1], -s[0]], 0, [1, 0], 0.01, 1000);
        t.ok(Array.isArray(path) && path.length === 1001, 'cần 1001 phần tử');
        t.close(path[1000].t, 10, 1e-9, 't cuối');
        const [x, v] = path[1000].y;
        t.close(0.5 * (x * x + v * v), 0.5, 1e-8, 'năng lượng');
      } },
    ],
    visualize(plot, api) {
      const big = api.integrate((_, s) => [s[1], -s[0]], 0, [1, 0], 0.6, 60);
      const exact = []; for (let i = 0; i <= 100; i++) exact.push([Math.cos(i / 100 * 2 * Math.PI), Math.sin(i / 100 * 2 * Math.PI)]);
      plot.frame({ xr: [-1.3, 1.3], yr: [-1.3, 1.3], equal: true, xl: 'x', yl: 'v' });
      plot.line(exact, plot.colors.muted, { dash: [4, 4] });
      plot.line(big.map((p) => [p.y[0], -p.y[1]]), plot.colors.a);
      big.forEach((p) => plot.dot(p.y[0], -p.y[1], plot.colors.a, 2.5));
      plot.legend([['RK4, h = 0.6 (rất lớn!)', plot.colors.a], ['nghiệm chính xác', plot.colors.muted]]);
    },
  });

  add({
    id: 'kepler', module: '1. Công cụ số', title: 'Quỹ đạo Newton (đường cơ sở)',
    exports: ['keplerRHS', 'keplerPeriod', 'keplerInit'],
    theory: R`
<p>Trước khi làm GR, ta cần đường cơ sở Newton để so sánh. Với đơn vị $G = 1$:</p>
$$\ddot{\vec r} = -\frac{M\,\vec r}{r^3}$$
<p>Trạng thái 2D là $s = [x, y, v_x, v_y]$. Quỹ đạo elip bán trục lớn $a$, độ lệch tâm $e$ có cận điểm
$r_p = a(1-e)$, tại đó vận tốc vuông góc với bán kính và có độ lớn (từ định luật bảo toàn năng lượng & mômen động lượng)</p>
$$v_p = \sqrt{\frac{M(1+e)}{r_p}}, \qquad T = 2\pi\sqrt{\frac{a^3}{M}}, \qquad \mathcal E = \frac{v^2}{2} - \frac{M}{r} = -\frac{M}{2a}.$$
<p>Trong Newton, elip <b>khép kín hoàn hảo</b> — cận điểm không bao giờ dịch chuyển. GR sẽ phá vỡ điều này.</p>`,
    task: R`
<ul>
<li><code>keplerRHS(M)</code> trả về <b>hàm</b> <code>(t, s) =&gt; [vx, vy, ax, ay]</code>.</li>
<li><code>keplerPeriod(M, a)</code> trả về chu kỳ $T$.</li>
<li><code>keplerInit(M, a, e)</code> trả về trạng thái tại cận điểm, nằm trên trục $+x$, quay ngược chiều kim đồng hồ: <code>[r_p, 0, 0, v_p]</code>.</li>
</ul>
<p>Dùng sẵn: <code>lib.rk4Step</code>, <code>lib.integrate</code>.</p>`,
    starter: R`function keplerRHS(M) {
  return function (t, s) {
    const [x, y, vx, vy] = s;
    // TODO: trả về [dx/dt, dy/dt, dvx/dt, dvy/dt]
  };
}

function keplerPeriod(M, a) {
  // TODO
}

function keplerInit(M, a, e) {
  // TODO: [rp, 0, 0, vp]
}
`,
    solution: R`function keplerRHS(M) {
  return function (t, s) {
    const [x, y, vx, vy] = s;
    const r = Math.hypot(x, y), r3 = r * r * r;
    return [vx, vy, -M * x / r3, -M * y / r3];
  };
}

function keplerPeriod(M, a) {
  return 2 * Math.PI * Math.sqrt(a * a * a / M);
}

function keplerInit(M, a, e) {
  const rp = a * (1 - e);
  return [rp, 0, 0, Math.sqrt(M * (1 + e) / rp)];
}
`,
    hints: ['Gia tốc theo x là −M·x/r³ (không phải −M/r²!) vì vector đơn vị r̂ = (x, y)/r.', 'r = Math.hypot(x, y).'],
    tests: [
      { name: 'keplerRHS tại (2, 0) với M = 4', run(api, lib, t) {
        const d = api.keplerRHS(4)(0, [2, 0, 0, 1]);
        t.arrClose(d, [0, 1, -1, 0], 1e-12, 'dy/dt');
      } },
      { name: 'Chu kỳ & năng lượng của keplerInit', run(api, lib, t) {
        t.close(api.keplerPeriod(1, 1), 2 * Math.PI, 1e-12, 'T(M=1, a=1)');
        t.close(api.keplerPeriod(8, 2), 2 * Math.PI, 1e-12, 'T(M=8, a=2)');
        const s = api.keplerInit(2, 3, 0.4);
        t.arrClose([s[1], s[2]], [0, 0], 1e-15, 'y, vx tại cận điểm');
        t.close(s[0], 1.8, 1e-12, 'r_p');
        const E = 0.5 * (s[2] ** 2 + s[3] ** 2) - 2 / Math.hypot(s[0], s[1]);
        t.close(E, -2 / (2 * 3), 1e-12, 'năng lượng = −M/2a');
      } },
      { name: 'Sau một chu kỳ elip khép kín (e = 0.5)', run(api, lib, t) {
        const M = 1, a = 1, e = 0.5, n = 6000, T = api.keplerPeriod(M, a);
        const s0 = api.keplerInit(M, a, e);
        const path = lib.integrate(api.keplerRHS(M), 0, s0, T / n, n);
        const s = path[n].y;
        t.close(Math.hypot(s[0] - s0[0], s[1] - s0[1]), 0, 1e-5, 'khoảng cách tới điểm đầu');
      } },
    ],
    visualize(plot, api, lib) {
      plot.frame({ xr: [-3.2, 1.2], yr: [-1.6, 1.6], equal: true, xl: 'x', yl: 'y' });
      [0, 0.3, 0.6].forEach((e, i) => {
        const T = api.keplerPeriod(1, 1.5), s0 = api.keplerInit(1, 1.5, e);
        const p = lib.integrate(api.keplerRHS(1), 0, s0, T / 800, 800);
        plot.line(p.map((q) => [q.y[0], q.y[1]]), plot.palette[i]);
      });
      plot.sun(0, 0);
      plot.legend([['e = 0', plot.palette[0]], ['e = 0.3', plot.palette[1]], ['e = 0.6', plot.palette[2]]]);
    },
  });

  // ================= Chương 2: Metric & tensor =================
  add({
    id: 'minkowski', module: '2. Metric & tensor', title: 'Không-thời gian phẳng Minkowski',
    exports: ['minkowski', 'metricDot', 'classify', 'properTime', 'lorentzGamma'],
    theory: R`
<p>Metric $g_{\mu\nu}$ là "thước đo" của không-thời gian. Khoảng giữa hai sự kiện gần nhau:</p>
$$ds^2 = g_{\mu\nu}\,dx^\mu dx^\nu = \sum_{\mu=0}^{3}\sum_{\nu=0}^{3} g_{\mu\nu}\,dx^\mu dx^\nu$$
<p>Quy ước tổng Einstein (chỉ số lặp lại trên–dưới thì cộng) dịch thẳng thành <b>hai vòng for lồng nhau</b>.
Không-thời gian phẳng (đơn vị $c = 1$, chữ ký $-+++$): $\eta = \operatorname{diag}(-1, 1, 1, 1)$, tọa độ $x^\mu = (t, x, y, z)$.</p>
<ul>
<li>$ds^2 < 0$: <b>timelike</b> — có thể nối bằng một vật có khối lượng. Thời gian riêng $d\tau = \sqrt{-ds^2}$.</li>
<li>$ds^2 = 0$: <b>null</b> — ánh sáng.</li>
<li>$ds^2 > 0$: <b>spacelike</b> — không có quan hệ nhân quả.</li>
</ul>
<p>$ds^2$ là <b>bất biến</b>: mọi quan sát viên quán tính (nối với nhau bằng phép biến đổi Lorentz) đều đo cùng một giá trị.
Nhân tố Lorentz $\gamma = 1/\sqrt{1 - v^2}$.</p>`,
    task: R`
<ul>
<li><code>minkowski()</code> → ma trận 4×4 (mảng lồng).</li>
<li><code>metricDot(g, a, b)</code> → $g_{\mu\nu}a^\mu b^\nu$ cho ma trận <code>g</code> bất kỳ (không nhất thiết chéo, kích thước bất kỳ).</li>
<li><code>classify(g, dx, tol = 1e-12)</code> → <code>'timelike' | 'null' | 'spacelike'</code>.</li>
<li><code>properTime(g, dx)</code> → $\sqrt{-ds^2}$ nếu timelike, ngược lại <code>NaN</code>.</li>
<li><code>lorentzGamma(v)</code>.</li>
</ul>`,
    starter: R`function minkowski() {
  // TODO
}

function metricDot(g, a, b) {
  // TODO: tổng kép g[mu][nu] * a[mu] * b[nu]
}

function classify(g, dx, tol = 1e-12) {
  // TODO
}

function properTime(g, dx) {
  // TODO
}

function lorentzGamma(v) {
  // TODO
}
`,
    solution: R`function minkowski() {
  return [
    [-1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function metricDot(g, a, b) {
  let s = 0;
  for (let mu = 0; mu < a.length; mu++) {
    for (let nu = 0; nu < b.length; nu++) s += g[mu][nu] * a[mu] * b[nu];
  }
  return s;
}

function classify(g, dx, tol = 1e-12) {
  const ds2 = metricDot(g, dx, dx);
  if (Math.abs(ds2) <= tol) return 'null';
  return ds2 < 0 ? 'timelike' : 'spacelike';
}

function properTime(g, dx) {
  const ds2 = metricDot(g, dx, dx);
  return ds2 < 0 ? Math.sqrt(-ds2) : NaN;
}

function lorentzGamma(v) {
  return 1 / Math.sqrt(1 - v * v);
}
`,
    hints: ['Đừng giả sử g là ma trận chéo — test sẽ dùng metric có thành phần ngoài đường chéo.', 'properTime: tận dụng metricDot bạn vừa viết.'],
    tests: [
      { name: 'minkowski() đúng', run(api, lib, t) {
        const g = api.minkowski();
        t.ok(Array.isArray(g) && g.length === 4 && g.every((r) => r.length === 4), 'cần mảng 4×4');
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) t.close(g[i][j], i !== j ? 0 : i === 0 ? -1 : 1, 0, 'g[' + i + '][' + j + ']');
      } },
      { name: 'metricDot với metric không chéo', run(api, lib, t) {
        const g = [[-2, 0.5], [0.5, 3]];
        t.close(api.metricDot(g, [1, 2], [3, -1]), -2 * 3 + 0.5 * 1 * -1 + 0.5 * 2 * 3 + 3 * 2 * -1, 1e-12, 'g(a,b)');
      } },
      { name: 'Phân loại khoảng', run(api, lib, t) {
        const g = api.minkowski();
        t.equal(api.classify(g, [1, 0, 0, 0]), 'timelike', 'đứng yên');
        t.equal(api.classify(g, [1, 1, 0, 0]), 'null', 'tia sáng theo x');
        t.equal(api.classify(g, [1, 0.6, 0.8, 0]), 'null', 'tia sáng chéo');
        t.equal(api.classify(g, [0, 1, 0, 0]), 'spacelike', 'đồng thời, khác chỗ');
      } },
      { name: 'Song sinh: đi 6 năm ánh sáng trong 10 năm ⇒ già thêm 8 năm', run(api, lib, t) {
        t.close(api.properTime(api.minkowski(), [10, 6, 0, 0]), 8, 1e-12, 'τ');
        t.ok(Number.isNaN(api.properTime(api.minkowski(), [1, 2, 0, 0])), 'spacelike phải trả NaN');
        t.close(api.lorentzGamma(0.6), 1.25, 1e-12, 'γ(0.6)');
      } },
      { name: 'ds² bất biến dưới phép boost Lorentz', run(api, lib, t) {
        const v = 0.7, gm = 1 / Math.sqrt(1 - v * v);
        const L = [[gm, -gm * v, 0, 0], [-gm * v, gm, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
        const x = [2, 0.3, -1.2, 0.5];
        const xp = L.map((row) => row.reduce((s, c, j) => s + c * x[j], 0));
        const g = api.minkowski();
        t.close(api.metricDot(g, xp, xp), api.metricDot(g, x, x), 1e-12, "ds'² vs ds²");
      } },
    ],
    visualize(plot, api) {
      plot.frame({ xr: [-2, 2], yr: [-2, 2], equal: true, xl: 'x', yl: 't' });
      const g = api.minkowski();
      plot.line([[-2, -2], [2, 2]], plot.colors.warn, { dash: [5, 4] });
      plot.line([[-2, 2], [2, -2]], plot.colors.warn, { dash: [5, 4] });
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 3.8 - 1.9;
      const col = { timelike: plot.palette[0], spacelike: plot.palette[2], null: plot.colors.warn };
      for (let i = 0; i < 160; i++) {
        const tt = rnd(), x = rnd();
        plot.dot(x, tt, col[api.classify(g, [tt, x, 0, 0])] || plot.colors.muted, 3);
      }
      plot.dot(0, 0, plot.colors.text, 4);
      plot.legend([['timelike (trong nón)', plot.palette[0]], ['spacelike', plot.palette[2]], ['nón ánh sáng', plot.colors.warn]]);
    },
  });

  add({
    id: 'fourvel', module: '2. Metric & tensor', title: '4-vận tốc & chuẩn hóa',
    exports: ['lowerIndex', 'normalizeTimelike'],
    theory: R`
<p>4-vận tốc của một vật có khối lượng là $u^\mu = dx^\mu/d\tau$. Vì $d\tau^2 = -ds^2$ nên nó luôn thỏa</p>
$$g_{\mu\nu}\,u^\mu u^\nu = -1.$$
<p>Đây là <b>ràng buộc</b> quan trọng nhất khi lập trình GR: dùng nó để (1) dựng điều kiện đầu hợp lệ và (2) kiểm tra
sai số tích lũy của bộ tích phân. Hạ chỉ số: $u_\mu = g_{\mu\nu}u^\nu$.</p>
<p>Thường ta biết phần không gian $u^i$ và cần tìm $u^t$. Thay vào ràng buộc được phương trình bậc hai:</p>
$$\underbrace{g_{tt}}_{A}(u^t)^2 + \underbrace{2g_{ti}u^i}_{B}\,u^t + \underbrace{g_{ij}u^iu^j + 1}_{C'} = 0$$
<p>Chọn nghiệm $u^t > 0$ (hướng về tương lai). Trong Minkowski kết quả là $u^\mu = \gamma(1, \vec v)$.</p>`,
    task: R`
<ul>
<li><code>lowerIndex(g, u)</code> → mảng $u_\mu$.</li>
<li><code>normalizeTimelike(g, spatial)</code> với <code>spatial = [u¹, u², u³]</code> → 4-vector đầy đủ <code>[uᵗ, u¹, u², u³]</code>.
Phải hoạt động cả khi $g_{ti} \ne 0$ (ví dụ metric Kerr của hố đen quay).</li>
</ul>
<p>Dùng sẵn: <code>lib.metricDot</code>, <code>lib.minkowski</code>.</p>`,
    starter: R`function lowerIndex(g, u) {
  // TODO: u_mu = g_{mu nu} u^nu
}

function normalizeTimelike(g, spatial) {
  // TODO: giải A·ut² + B·ut + C' = 0, chọn ut > 0
}
`,
    solution: R`function lowerIndex(g, u) {
  return g.map((row) => row.reduce((s, gij, j) => s + gij * u[j], 0));
}

function normalizeTimelike(g, spatial) {
  const u = [0, ...spatial];
  const A = g[0][0];
  let B = 0, C = 1;
  for (let i = 1; i < 4; i++) {
    B += 2 * g[0][i] * u[i];
    for (let j = 1; j < 4; j++) C += g[i][j] * u[i] * u[j];
  }
  const disc = B * B - 4 * A * C;
  if (disc < 0) throw new Error('Không tồn tại uᵗ thực: vận tốc vượt quá ánh sáng?');
  const r1 = (-B + Math.sqrt(disc)) / (2 * A);
  const r2 = (-B - Math.sqrt(disc)) / (2 * A);
  u[0] = Math.max(r1, r2);
  return u;
}
`,
    hints: ['C\' = 1 + Σ g_ij uⁱ uʲ (i, j chạy từ 1 tới 3).', 'Với A = g_tt < 0, nghiệm dương là (−B − √Δ)/(2A); cách an toàn: lấy max của hai nghiệm.'],
    tests: [
      { name: 'lowerIndex trong Minkowski', run(api, lib, t) {
        t.arrClose(api.lowerIndex(lib.minkowski(), [2, 1, 0, -3]), [-2, 1, 0, -3], 1e-15, 'u_μ');
      } },
      { name: 'Minkowski: uˣ = 0.75 ⇒ uᵗ = γ = 1.25', run(api, lib, t) {
        t.arrClose(api.normalizeTimelike(lib.minkowski(), [0.75, 0, 0]), [1.25, 0.75, 0, 0], 1e-12, 'u');
      } },
      { name: 'Quan sát viên đứng yên trong trường hấp dẫn: uᵗ = 1/√(1−2M/r)', run(api, lib, t) {
        const g = [[-0.8, 0, 0, 0], [0, 1.25, 0, 0], [0, 0, 100, 0], [0, 0, 0, 100]];
        t.close(api.normalizeTimelike(g, [0, 0, 0])[0], 1 / Math.sqrt(0.8), 1e-12, 'uᵗ');
      } },
      { name: 'Metric có g_tφ ≠ 0 (kiểu Kerr)', run(api, lib, t) {
        const g = [[-0.7, 0, 0, -0.3], [0, 1.4, 0, 0], [0, 0, 9, 0], [-0.3, 0, 0, 12]];
        const u = api.normalizeTimelike(g, [0.1, 0, 0.05]);
        t.ok(u[0] > 0, 'uᵗ phải dương');
        t.close(lib.metricDot(g, u, u), -1, 1e-12, 'g(u,u)');
      } },
    ],
    visualize(plot, api, lib) {
      const pts = []; for (let i = 0; i <= 80; i++) { const ux = i / 80 * 4; pts.push([ux, api.normalizeTimelike(lib.minkowski(), [ux, 0, 0])[0]]); }
      plot.frame({ xr: [0, 4], yr: [0, 4.4], xl: 'uˣ = γv', yl: 'uᵗ = γ' });
      plot.line([[0, 0], [4, 4]], plot.colors.warn, { dash: [5, 4] });
      plot.line(pts, plot.colors.a);
      plot.legend([['hyperbol uᵗ² − uˣ² = 1', plot.colors.a], ['giới hạn ánh sáng', plot.colors.warn]]);
    },
  });

  add({
    id: 'length', module: '2. Metric & tensor', title: 'Metric tổng quát & độ dài đường cong',
    exports: ['polarMetric', 'sphereMetric', 'curveLength'],
    theory: R`
<p>Metric không chỉ dành cho không-thời gian: nó mô tả hình học của bất kỳ "không gian" nào trong một hệ tọa độ cụ thể.</p>
<ul>
<li>Mặt phẳng, tọa độ cực $(r, \theta)$: $ds^2 = dr^2 + r^2 d\theta^2$ — vẫn phẳng, chỉ có tọa độ cong.</li>
<li>Mặt cầu đơn vị, tọa độ $(\theta, \phi)$: $ds^2 = d\theta^2 + \sin^2\theta\, d\phi^2$ — <b>thật sự cong</b>.</li>
</ul>
<p>Độ dài của đường cong $x^i(\lambda)$:</p>
$$L = \int_{\lambda_0}^{\lambda_1} \sqrt{g_{ij}(x)\,\frac{dx^i}{d\lambda}\frac{dx^j}{d\lambda}}\;d\lambda
\;\approx\; \sum_k \sqrt{g_{ij}(x_{k+\frac12})\,\Delta x^i_k\,\Delta x^j_k}$$
<p>Trong code, metric là <b>một hàm của vị trí</b>: <code>x =&gt; ma trận</code>. Đây là thiết kế mà ta sẽ giữ suốt khóa học —
Christoffel, trắc địa… đều nhận vào một <code>metricFn</code>.</p>`,
    task: R`
<ul>
<li><code>polarMetric([r, θ])</code>, <code>sphereMetric([θ, φ])</code> → ma trận 2×2.</li>
<li><code>curveLength(metricFn, path, l0, l1, N)</code>: <code>path(λ)</code> trả về tọa độ; chia $[l_0, l_1]$ thành <code>N</code> đoạn,
lấy metric ở <b>trung điểm</b> mỗi đoạn.</li>
</ul>
<p>Dùng sẵn: <code>lib.metricDot</code>.</p>`,
    starter: R`function polarMetric([r, theta]) {
  // TODO
}

function sphereMetric([theta, phi]) {
  // TODO
}

function curveLength(metricFn, path, l0, l1, N) {
  // TODO
}
`,
    solution: R`function polarMetric([r, theta]) {
  return [[1, 0], [0, r * r]];
}

function sphereMetric([theta, phi]) {
  const s = Math.sin(theta);
  return [[1, 0], [0, s * s]];
}

function curveLength(metricFn, path, l0, l1, N) {
  const h = (l1 - l0) / N;
  let L = 0;
  for (let k = 0; k < N; k++) {
    const a = path(l0 + k * h), b = path(l0 + (k + 1) * h);
    const mid = path(l0 + (k + 0.5) * h);
    const dx = b.map((bi, i) => bi - a[i]);
    L += Math.sqrt(lib.metricDot(metricFn(mid), dx, dx));
  }
  return L;
}
`,
    hints: ['Δx = path(λ_{k+1}) − path(λ_k), metric lấy tại path(λ_k + h/2).', 'Độ dài mỗi đoạn là √(g(Δx, Δx)).'],
    tests: [
      { name: 'Giá trị metric', run(api, lib, t) {
        t.arrClose(api.polarMetric([3, 1]).flat(), [1, 0, 0, 9], 1e-15, 'cực');
        t.arrClose(api.sphereMetric([Math.PI / 6, 2]).flat(), [1, 0, 0, 0.25], 1e-15, 'cầu');
      } },
      { name: 'Chu vi đường tròn r = 2 trong tọa độ cực = 4π', run(api, lib, t) {
        t.close(api.curveLength(api.polarMetric, (l) => [2, l], 0, 2 * Math.PI, 200), 4 * Math.PI, 1e-9, 'L');
      } },
      { name: 'Đoạn thẳng (1,0)→(1,1) biểu diễn trong tọa độ cực có độ dài 1', run(api, lib, t) {
        const path = (l) => [Math.hypot(1, l), Math.atan2(l, 1)];
        t.close(api.curveLength(api.polarMetric, path, 0, 1, 2000), 1, 1e-6, 'L');
      } },
      { name: 'Mặt cầu: vĩ tuyến θ = π/3 dài 2π·sin(π/3), kinh tuyến dài Δθ', run(api, lib, t) {
        t.close(api.curveLength(api.sphereMetric, (l) => [Math.PI / 3, l], 0, 2 * Math.PI, 400), 2 * Math.PI * Math.sin(Math.PI / 3), 1e-9, 'vĩ tuyến');
        t.close(api.curveLength(api.sphereMetric, (l) => [l, 0.4], 0.2, 1.2, 100), 1, 1e-9, 'kinh tuyến');
      } },
    ],
    visualize(plot, api) {
      plot.frame({ xr: [-0.3, 2.3], yr: [-0.3, 2.3], equal: true, xl: 'x', yl: 'y' });
      for (let k = 1; k <= 4; k++) { const c = []; for (let i = 0; i <= 60; i++) c.push([k * 0.5 * Math.cos(i / 60 * Math.PI / 2), k * 0.5 * Math.sin(i / 60 * Math.PI / 2)]); plot.line(c, plot.colors.grid); }
      for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI / 2; plot.line([[0, 0], [2.2 * Math.cos(a), 2.2 * Math.sin(a)]], plot.colors.grid); }
      const pts = []; for (let i = 0; i <= 40; i++) { const l = i / 40; pts.push([1, l]); }
      plot.line(pts, plot.colors.a, { width: 2.5 });
      const L = api.curveLength(api.polarMetric, (l) => [Math.hypot(1, l), Math.atan2(l, 1)], 0, 1, 2000);
      plot.text('L = ' + L.toFixed(8) + ' (tính bằng metric cực)', 1.05, 0.5);
    },
  });

  // ================= Chương 3: Christoffel & trắc địa =================
  add({
    id: 'christoffel', module: '3. Christoffel & trắc địa', title: 'Ký hiệu Christoffel bằng số',
    exports: ['metricDerivatives', 'christoffel'],
    theory: R`
<p>Ký hiệu Christoffel mô tả các vector cơ sở thay đổi thế nào khi di chuyển — chúng là "lực quán tính" sinh ra bởi
hệ tọa độ/độ cong:</p>
$$\Gamma^\lambda_{\mu\nu} = \tfrac12\, g^{\lambda\sigma}\left(\partial_\mu g_{\sigma\nu} + \partial_\nu g_{\sigma\mu} - \partial_\sigma g_{\mu\nu}\right)$$
<p>Ta tính đạo hàm bằng <b>sai phân trung tâm</b> (sai số $O(\varepsilon^2)$):</p>
$$\partial_k g_{ij}(x) \approx \frac{g_{ij}(x + \varepsilon\, e_k) - g_{ij}(x - \varepsilon\, e_k)}{2\varepsilon}$$
<p>$g^{\lambda\sigma}$ là ma trận nghịch đảo: <code>lib.inverse(g)</code>. Kết quả là mảng 3 chiều
<code>Gamma[λ][μ][ν]</code>, đối xứng theo hai chỉ số dưới. Kiểm chứng với các giá trị đã biết:</p>
<ul>
<li>Tọa độ cực: $\Gamma^r_{\theta\theta} = -r$, $\Gamma^\theta_{r\theta} = \Gamma^\theta_{\theta r} = 1/r$.</li>
<li>Mặt cầu: $\Gamma^\theta_{\phi\phi} = -\sin\theta\cos\theta$, $\Gamma^\phi_{\theta\phi} = \cot\theta$.</li>
</ul>
<p>Lưu ý: Γ khác 0 trong tọa độ cực dù mặt phẳng phẳng — Γ <b>không phải tensor</b>; độ cong thật nằm ở tensor Riemann.</p>`,
    task: R`
<ul>
<li><code>metricDerivatives(metricFn, x, eps)</code> → <code>dg[k][i][j]</code> $= \partial_k g_{ij}$.</li>
<li><code>christoffel(metricFn, x, eps = 1e-5)</code> → <code>Gamma[λ][μ][ν]</code>. Hoạt động với số chiều bất kỳ.</li>
</ul>
<p>Dùng sẵn: <code>lib.inverse</code>, <code>lib.zeros(n, n, n)</code>.</p>`,
    starter: R`function metricDerivatives(metricFn, x, eps) {
  const n = x.length;
  // TODO: dg[k][i][j] = (g(x + eps e_k) - g(x - eps e_k)) / (2 eps)
}

function christoffel(metricFn, x, eps = 1e-5) {
  // TODO
}
`,
    solution: R`function metricDerivatives(metricFn, x, eps) {
  const n = x.length;
  const dg = [];
  for (let k = 0; k < n; k++) {
    const xp = x.slice(), xm = x.slice();
    xp[k] += eps;
    xm[k] -= eps;
    const gp = metricFn(xp), gm = metricFn(xm);
    dg.push(gp.map((row, i) => row.map((v, j) => (v - gm[i][j]) / (2 * eps))));
  }
  return dg;
}

function christoffel(metricFn, x, eps = 1e-5) {
  const n = x.length;
  const ginv = lib.inverse(metricFn(x));
  const dg = metricDerivatives(metricFn, x, eps);
  const G = lib.zeros(n, n, n);
  for (let l = 0; l < n; l++)
    for (let m = 0; m < n; m++)
      for (let v = 0; v < n; v++) {
        let s = 0;
        for (let sg = 0; sg < n; sg++) {
          s += ginv[l][sg] * (dg[m][sg][v] + dg[v][sg][m] - dg[sg][m][v]);
        }
        G[l][m][v] = 0.5 * s;
      }
  return G;
}
`,
    hints: [
      'Đọc kỹ chỉ số: ∂_μ g_σν là dg[μ][σ][ν].',
      'Bốn vòng lặp lồng nhau: λ, μ, ν bên ngoài và σ là chỉ số tổng bên trong.',
      'Dùng x.slice() để không làm hỏng x khi cộng/trừ eps.',
    ],
    tests: [
      { name: 'metricDerivatives cho tọa độ cực: ∂_r g_θθ = 2r', run(api, lib, t) {
        const dg = api.metricDerivatives(lib.polarMetric, [2, 0.3], 1e-5);
        t.close(dg[0][1][1], 4, 1e-8, '∂_r g_θθ');
        t.close(dg[1][1][1], 0, 1e-8, '∂_θ g_θθ');
      } },
      { name: 'Christoffel tọa độ cực tại r = 2', run(api, lib, t) {
        const G = api.christoffel(lib.polarMetric, [2, 0.3]);
        t.close(G[0][1][1], -2, 1e-7, 'Γ^r_θθ');
        t.close(G[1][0][1], 0.5, 1e-7, 'Γ^θ_rθ');
        t.close(G[1][1][0], 0.5, 1e-7, 'Γ^θ_θr');
        t.close(G[0][0][0], 0, 1e-7, 'Γ^r_rr');
      } },
      { name: 'Christoffel mặt cầu tại θ = 0.7', run(api, lib, t) {
        const th = 0.7, G = api.christoffel(lib.sphereMetric, [th, 1.1]);
        t.close(G[0][1][1], -Math.sin(th) * Math.cos(th), 1e-7, 'Γ^θ_φφ');
        t.close(G[1][0][1], 1 / Math.tan(th), 1e-7, 'Γ^φ_θφ');
      } },
      { name: 'Tọa độ Descartes 3D: mọi Γ = 0', run(api, lib, t) {
        const G = api.christoffel(() => [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [1, 2, 3]);
        t.ok(G.flat(2).every((v) => Math.abs(v) < 1e-12), 'có Γ khác 0');
      } },
    ],
    visualize(plot, api, lib) {
      const th = 0.7, G = api.christoffel(lib.sphereMetric, [th, 0]);
      const names = ['θ', 'φ'];
      plot.frame({ xr: [0, 1], yr: [0, 1], axes: false });
      plot.text('Γ của mặt cầu tại θ = 0.7 (hàng: Γ^λ_μν)', 0.04, 0.93, { size: 14 });
      let row = 0;
      for (let l = 0; l < 2; l++) for (let m = 0; m < 2; m++) for (let v = 0; v < 2; v++) {
        const val = G[l][m][v];
        plot.text('Γ^' + names[l] + '_' + names[m] + names[v] + ' = ' + (Math.abs(val) < 1e-9 ? '0' : val.toFixed(8)),
          0.06 + (row % 2) * 0.48, 0.78 - Math.floor(row / 2) * 0.13, { color: Math.abs(val) < 1e-9 ? plot.colors.muted : plot.colors.text, size: 14 });
        row++;
      }
    },
  });

  add({
    id: 'geodesic', module: '3. Christoffel & trắc địa', title: 'Phương trình trắc địa',
    exports: ['geodesicAcceleration', 'geodesicRHS'],
    theory: R`
<p>Đường trắc địa là đường "thẳng nhất có thể" trong không gian cong: vector tiếp tuyến được vận chuyển song song
dọc chính nó. Tương đương, nó làm cực trị độ dài (hoặc thời gian riêng). Phương trình:</p>
$$\frac{d^2x^\mu}{d\lambda^2} = -\Gamma^\mu_{\alpha\beta}\,\frac{dx^\alpha}{d\lambda}\frac{dx^\beta}{d\lambda}$$
<p>Viết thành hệ bậc 1 cho trạng thái $y = (x^0..x^{n-1},\; u^0..u^{n-1})$:</p>
$$\frac{dx^\mu}{d\lambda} = u^\mu, \qquad \frac{du^\mu}{d\lambda} = -\Gamma^\mu_{\alpha\beta}u^\alpha u^\beta$$
<p><b>Đây chính là định luật "chuyển động" duy nhất của GR</b> cho vật rơi tự do. Không có lực hấp dẫn —
chỉ có hình học. Trong tọa độ cực, một đường thẳng có $r(\lambda), \theta(\lambda)$ phức tạp,
nhưng phương trình trên vẫn cho ra đúng nó.</p>`,
    task: R`
<ul>
<li><code>geodesicAcceleration(Gamma, u)</code> → mảng $a^\mu = -\Gamma^\mu_{\alpha\beta}u^\alpha u^\beta$.</li>
<li><code>geodesicRHS(metricFn)</code> → hàm <code>(λ, y) =&gt; dy</code> với <code>y.length = 2n</code>.</li>
</ul>
<p>Dùng sẵn: <code>lib.christoffel</code>, <code>lib.rk4Step</code>, <code>lib.integrate</code>.</p>`,
    starter: R`function geodesicAcceleration(Gamma, u) {
  // TODO
}

function geodesicRHS(metricFn) {
  return function (lam, y) {
    const n = y.length / 2;
    const x = y.slice(0, n), u = y.slice(n);
    // TODO: trả về [...u, ...a]
  };
}
`,
    solution: R`function geodesicAcceleration(Gamma, u) {
  const n = u.length;
  const a = new Array(n).fill(0);
  for (let m = 0; m < n; m++)
    for (let al = 0; al < n; al++)
      for (let be = 0; be < n; be++) a[m] -= Gamma[m][al][be] * u[al] * u[be];
  return a;
}

function geodesicRHS(metricFn) {
  return function (lam, y) {
    const n = y.length / 2;
    const x = y.slice(0, n), u = y.slice(n);
    const G = lib.christoffel(metricFn, x);
    return [...u, ...geodesicAcceleration(G, u)];
  };
}
`,
    hints: ['Dấu trừ! a^μ = −Γ^μ_αβ uᵅ uᵝ.', 'Γ đối xứng nên cả Γ^μ_αβ và Γ^μ_βα đều được cộng — đừng nhân 2 thêm lần nữa khi đã lặp đủ α, β.'],
    tests: [
      { name: 'geodesicAcceleration với Γ cho trước', run(api, lib, t) {
        const G = [[[0, 0], [0, -2]], [[0, 0.5], [0.5, 0]]];
        t.arrClose(api.geodesicAcceleration(G, [3, 1]), [2, -3], 1e-15, 'a');
      } },
      { name: 'geodesicRHS trả về [u, a]', run(api, lib, t) {
        const d = api.geodesicRHS(lib.polarMetric)(0, [2, 0, 0, 1]);
        t.arrClose(d, [0, 1, 2, 0], 1e-7, 'dy');
      } },
      { name: 'Trắc địa trong tọa độ cực là đường thẳng: (1,0) đi lên ⇒ r = √2, θ = π/4 tại λ = 1', run(api, lib, t) {
        const p = lib.integrate(api.geodesicRHS(lib.polarMetric), 0, [1, 0, 0, 1], 0.01, 100);
        const [r, th] = p[100].y;
        t.close(r, Math.SQRT2, 1e-7, 'r');
        t.close(th, Math.PI / 4, 1e-7, 'θ');
      } },
    ],
    visualize(plot, api, lib) {
      plot.frame({ xr: [-2.5, 2.5], yr: [-2.5, 2.5], equal: true, xl: 'x', yl: 'y' });
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * 2 * Math.PI;
        const y0 = [1, 0, Math.cos(a), Math.sin(a)];       // ur, uθ tại r = 1
        const p = lib.integrate(api.geodesicRHS(lib.polarMetric), 0, y0, 0.02, 160)
          .filter((q) => q.y[0] < 3.6).map((q) => [q.y[0] * Math.cos(q.y[1]), q.y[0] * Math.sin(q.y[1])]);
        plot.line(p, plot.palette[k % plot.palette.length]);
      }
      plot.dot(1, 0, plot.colors.text, 4);
      plot.text('Tích phân trong (r, θ) — vẽ trong (x, y): toàn đường thẳng', -2.4, 2.25);
    },
  });

  add({
    id: 'sphere', module: '3. Christoffel & trắc địa', title: 'Đại vòng tròn trên mặt cầu',
    exports: ['integrateGeodesic', 'sphereToCartesian'],
    theory: R`
<p>Trên mặt cầu, trắc địa là các <b>đại vòng tròn</b> — giao của mặt cầu với mặt phẳng đi qua tâm. Đó là lý do
đường bay xuyên lục địa trông "cong" trên bản đồ phẳng.</p>
<p>Đây là ví dụ đầu tiên về không gian <b>thật sự cong</b>: hai trắc địa xuất phát song song trên xích đạo,
cùng đi về phía bắc, sẽ gặp nhau ở cực. Trong GR, hiện tượng "trắc địa song song hội tụ" này chính là
<b>lực thủy triều</b> — biểu hiện bất biến của độ cong (phương trình độ lệch trắc địa).</p>
<p>Nhúng vào 3D: $X = \sin\theta\cos\phi,\; Y = \sin\theta\sin\phi,\; Z = \cos\theta$.
Xuất phát trên xích đạo ($\theta = \pi/2$) với hướng nghiêng góc $\alpha$ về phía bắc:
$u = (-\sin\alpha,\ \cos\alpha)$ (vì $\theta$ giảm khi đi lên bắc). Khi đó vĩ độ lớn nhất đạt được là $\alpha$,
và sau $\lambda = 2\pi$ ta quay về điểm xuất phát.</p>`,
    task: R`
<ul>
<li><code>integrateGeodesic(metricFn, x0, u0, lamEnd, nSteps)</code> → mảng <code>nSteps + 1</code> phần tử
<code>{ lam, x, u }</code> (x, u là mảng tọa độ & vận tốc).</li>
<li><code>sphereToCartesian([θ, φ])</code> → <code>[X, Y, Z]</code>.</li>
</ul>
<p>Dùng sẵn: <code>lib.geodesicRHS</code>, <code>lib.rk4Step</code>, <code>lib.sphereMetric</code>.</p>`,
    starter: R`function integrateGeodesic(metricFn, x0, u0, lamEnd, nSteps) {
  // TODO
}

function sphereToCartesian([theta, phi]) {
  // TODO
}
`,
    solution: R`function integrateGeodesic(metricFn, x0, u0, lamEnd, nSteps) {
  const f = lib.geodesicRHS(metricFn);
  const n = x0.length, h = lamEnd / nSteps;
  let y = [...x0, ...u0];
  const out = [{ lam: 0, x: x0.slice(), u: u0.slice() }];
  for (let i = 1; i <= nSteps; i++) {
    y = lib.rk4Step(f, (i - 1) * h, y, h);
    out.push({ lam: i * h, x: y.slice(0, n), u: y.slice(n) });
  }
  return out;
}

function sphereToCartesian([theta, phi]) {
  const s = Math.sin(theta);
  return [s * Math.cos(phi), s * Math.sin(phi), Math.cos(theta)];
}
`,
    hints: ['Ghép y = [...x0, ...u0], gọi lib.rk4Step nSteps lần, mỗi lần tách y thành x và u.'],
    tests: [
      { name: 'Định dạng kết quả', run(api, lib, t) {
        const p = api.integrateGeodesic(lib.sphereMetric, [Math.PI / 2, 0], [0, 1], 1, 10);
        t.ok(Array.isArray(p) && p.length === 11, 'cần 11 phần tử');
        t.ok(Array.isArray(p[10].x) && p[10].x.length === 2 && Array.isArray(p[10].u), 'mỗi phần tử có x, u là mảng');
        t.close(p[10].lam, 1, 1e-12, 'lam cuối');
        t.arrClose(api.sphereToCartesian([Math.PI / 2, Math.PI / 2]), [0, 1, 0], 1e-15, 'sphereToCartesian');
      } },
      { name: 'Đại vòng tròn quay về điểm đầu sau λ = 2π', run(api, lib, t) {
        const a = 0.5, p = api.integrateGeodesic(lib.sphereMetric, [Math.PI / 2, 0], [-Math.sin(a), Math.cos(a)], 2 * Math.PI, 400);
        const P0 = api.sphereToCartesian(p[0].x), P1 = api.sphereToCartesian(p[400].x);
        t.close(Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]), 0, 1e-6, 'khoảng cách');
      } },
      { name: 'Vĩ độ cực đại = α và đường nằm trong mặt phẳng qua tâm', run(api, lib, t) {
        const a = 0.5, p = api.integrateGeodesic(lib.sphereMetric, [Math.PI / 2, 0], [-Math.sin(a), Math.cos(a)], 2 * Math.PI, 400);
        const minTheta = Math.min(...p.map((q) => q.x[0]));
        t.close(Math.PI / 2 - minTheta, a, 1e-4, 'vĩ độ cực đại');
        const n = [0, -Math.sin(a), Math.cos(a)];                       // pháp tuyến = P0 × V0
        const off = Math.max(...p.map((q) => { const P = api.sphereToCartesian(q.x); return Math.abs(P[0] * n[0] + P[1] * n[1] + P[2] * n[2]); }));
        t.close(off, 0, 1e-6, 'độ lệch khỏi mặt phẳng');
      } },
    ],
    visualize(plot, api, lib) {
      const view = (P) => { const cy = Math.cos(0.5), sy = Math.sin(0.5), cp = Math.cos(0.35), sp = Math.sin(0.35);
        const x = P[0] * cy - P[1] * sy, y = P[0] * sy + P[1] * cy, z = P[2];
        return { X: y, Y: z * cp - x * sp, front: x * cp + z * sp > 0 }; };
      plot.frame({ xr: [-1.2, 1.2], yr: [-1.2, 1.2], equal: true, axes: false });
      const circle = []; for (let i = 0; i <= 100; i++) circle.push([Math.cos(i / 50 * Math.PI), Math.sin(i / 50 * Math.PI)]);
      plot.line(circle, plot.colors.muted);
      const draw3 = (pts, color, width) => {
        let seg = [], front = null;
        const flush = () => { if (seg.length > 1) plot.line(seg, color, { width: front ? width : 1, alpha: front ? 1 : 0.25 }); };
        pts.forEach((P) => { const v = view(P); if (front !== null && v.front !== front) { flush(); seg = [seg[seg.length - 1]]; } front = v.front; seg.push([v.X, v.Y]); });
        flush();
      };
      for (let k = 1; k < 6; k++) { const th = k / 6 * Math.PI, pts = []; for (let i = 0; i <= 80; i++) pts.push(api.sphereToCartesian([th, i / 40 * Math.PI])); draw3(pts, plot.colors.grid, 1); }
      for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 80; i++) pts.push(api.sphereToCartesian([i / 80 * Math.PI, k / 6 * Math.PI])); draw3(pts, plot.colors.grid, 1); }
      [0.25, 0.8, 1.25].forEach((a, i) => {
        const p = api.integrateGeodesic(lib.sphereMetric, [Math.PI / 2, 0], [-Math.sin(a), Math.cos(a)], 2 * Math.PI, 300);
        draw3(p.map((q) => api.sphereToCartesian(q.x)), plot.palette[i], 2.2);
      });
      [-0.25, 0.25].forEach((phi) => {
        const p = api.integrateGeodesic(lib.sphereMetric, [Math.PI / 2, phi], [-1, 0], Math.PI / 2 - 0.02, 100);
        draw3(p.map((q) => api.sphereToCartesian(q.x)), plot.colors.warn, 2.2);
      });
      plot.legend([['đại vòng tròn α = 0.25, 0.8, 1.25', plot.palette[0]], ['2 trắc địa "song song" hội tụ ở cực', plot.colors.warn]]);
    },
  });

  // ================= Chương 4: Schwarzschild =================
  add({
    id: 'schwarzschild', module: '4. Hình học Schwarzschild', title: 'Metric Schwarzschild & đơn vị hình học',
    exports: ['geometricMass', 'schwarzschildRadius', 'schwarzschildMetric'],
    theory: R`
<p>Nghiệm chân không, đối xứng cầu, tĩnh của phương trình Einstein (Schwarzschild, 1916) — mô tả không-thời gian quanh
Mặt Trời (bỏ qua chuyển động quay & các hành tinh):</p>
$$ds^2 = -\left(1-\frac{2M}{r}\right)dt^2 + \frac{dr^2}{1-\frac{2M}{r}} + r^2\left(d\theta^2 + \sin^2\theta\,d\phi^2\right)$$
<p>Ở đây dùng <b>đơn vị hình học</b> $G = c = 1$, nên khối lượng có thứ nguyên độ dài:
$M_{\text{geom}} = GM/c^2$. Bán kính Schwarzschild $r_s = 2M$:
Mặt Trời ≈ 2.95 km, Trái Đất ≈ 8.87 mm. Quy tắc vàng khi lập trình GR:
<b>tính toán hoàn toàn trong đơn vị hình học, chỉ đổi sang SI ở đầu vào/đầu ra</b>.</p>
<p>Tọa độ $x^\mu = (t, r, \theta, \phi)$. Khi $r \to \infty$, metric trở về Minkowski trong tọa độ cầu.</p>`,
    task: R`
<ul>
<li><code>geometricMass(massKg)</code> → $GM/c^2$ (mét). <code>schwarzschildRadius(massKg)</code> → $2GM/c^2$ (mét).</li>
<li><code>schwarzschildMetric(M)</code> → <b>hàm</b> <code>([t, r, θ, φ]) =&gt; ma trận 4×4</code>.</li>
</ul>
<p>Hằng số: <code>lib.G</code>, <code>lib.C</code>, <code>lib.M_SUN_KG</code>, <code>lib.M_EARTH_KG</code>.</p>`,
    starter: R`function geometricMass(massKg) {
  // TODO
}

function schwarzschildRadius(massKg) {
  // TODO
}

function schwarzschildMetric(M) {
  return function ([t, r, theta, phi]) {
    // TODO
  };
}
`,
    solution: R`function geometricMass(massKg) {
  return lib.G * massKg / (lib.C * lib.C);
}

function schwarzschildRadius(massKg) {
  return 2 * geometricMass(massKg);
}

function schwarzschildMetric(M) {
  return function ([t, r, theta, phi]) {
    const f = 1 - 2 * M / r, s = Math.sin(theta);
    return [
      [-f, 0, 0, 0],
      [0, 1 / f, 0, 0],
      [0, 0, r * r, 0],
      [0, 0, 0, r * r * s * s],
    ];
  };
}
`,
    hints: ['f = 1 − 2M/r; g_tt = −f, g_rr = 1/f.', 'Đừng quên sin²θ trong g_φφ.'],
    tests: [
      { name: 'Bán kính Schwarzschild của Mặt Trời ≈ 2953 m, Trái Đất ≈ 8.87 mm', run(api, lib, t) {
        t.close(api.schwarzschildRadius(lib.M_SUN_KG), 2953.4, 1.5, 'r_s Mặt Trời (m)');
        t.close(api.schwarzschildRadius(lib.M_EARTH_KG) * 1000, 8.87, 0.01, 'r_s Trái Đất (mm)');
        t.close(api.geometricMass(lib.M_SUN_KG), 1476.7, 1, 'M☉ (m)');
      } },
      { name: 'Giá trị metric tại r = 10, M = 1', run(api, lib, t) {
        const g = api.schwarzschildMetric(1)([0, 10, Math.PI / 2, 0]);
        t.arrClose([g[0][0], g[1][1], g[2][2], g[3][3]], [-0.8, 1.25, 100, 100], 1e-12, 'đường chéo');
        const g2 = api.schwarzschildMetric(1)([0, 10, Math.PI / 3, 0]);
        t.close(g2[3][3], 75, 1e-9, 'g_φφ tại θ = π/3');
        t.close(g[0][1] + g[2][3], 0, 0, 'thành phần ngoài chéo');
      } },
      { name: 'g_tt · g_rr = −1 mọi nơi ngoài chân trời', run(api, lib, t) {
        [2.5, 3, 7, 100].forEach((r) => { const g = api.schwarzschildMetric(1)([0, r, 1, 0]); t.close(g[0][0] * g[1][1], -1, 1e-12, 'r = ' + r); });
      } },
    ],
    visualize(plot, api) {
      const gtt = [], grr = [];
      for (let i = 0; i <= 300; i++) { const r = 2.05 + i / 300 * 18; const g = api.schwarzschildMetric(1)([0, r, Math.PI / 2, 0]); gtt.push([r, g[0][0]]); grr.push([r, Math.min(g[1][1], 6)]); }
      plot.frame({ xr: [0, 20], yr: [-1.2, 6], xl: 'r / M', yl: 'g' });
      plot.line([[2, -1.2], [2, 6]], plot.colors.warn, { dash: [4, 4] });
      plot.line(gtt, plot.palette[0]); plot.line(grr, plot.palette[1]);
      plot.line([[0, -1], [20, -1]], plot.colors.muted, { dash: [2, 4] }); plot.line([[0, 1], [20, 1]], plot.colors.muted, { dash: [2, 4] });
      plot.legend([['g_tt = −(1 − 2M/r)', plot.palette[0]], ['g_rr = 1/(1 − 2M/r)', plot.palette[1]], ['chân trời r = 2M', plot.colors.warn]]);
    },
  });

  add({
    id: 'schw-gamma', module: '4. Hình học Schwarzschild', title: 'Christoffel giải tích của Schwarzschild',
    exports: ['schwarzschildChristoffel'],
    theory: R`
<p>Christoffel bằng số rất tiện để kiểm tra, nhưng chậm: mỗi lần gọi cần $2n$ lần tính metric + nghịch đảo ma trận.
Để mô phỏng hàng nghìn vòng quỹ đạo, ta dùng công thức giải tích. Với $f = 1 - 2M/r$, các thành phần khác 0 là:</p>
$$\begin{aligned}
\Gamma^t_{tr} &= \frac{M}{r^2 f} & \Gamma^r_{tt} &= \frac{M f}{r^2} & \Gamma^r_{rr} &= -\frac{M}{r^2 f}\\
\Gamma^r_{\theta\theta} &= -r f & \Gamma^r_{\phi\phi} &= -r f \sin^2\theta & \Gamma^\theta_{r\theta} &= \frac1r\\
\Gamma^\theta_{\phi\phi} &= -\sin\theta\cos\theta & \Gamma^\phi_{r\phi} &= \frac1r & \Gamma^\phi_{\theta\phi} &= \cot\theta
\end{aligned}$$
<p>(cùng với các thành phần đối xứng $\Gamma^\lambda_{\nu\mu} = \Gamma^\lambda_{\mu\nu}$).</p>
<p><b>Quy trình chuẩn trong thực tế</b>: suy ra công thức bằng tay hoặc bằng đại số máy tính (SymPy, Mathematica),
viết code, rồi <b>kiểm chứng bằng phiên bản số học</b> — chính là việc test của bài này làm.</p>
<p>Để ý $\Gamma^r_{tt} \approx M/r^2$ khi $r \gg M$: đó chính là gia tốc hấp dẫn Newton!</p>`,
    task: R`<p><code>schwarzschildChristoffel(M, r, theta)</code> → mảng 4×4×4 <code>G[λ][μ][ν]</code> với chỉ số 0=t, 1=r, 2=θ, 3=φ.
Nhớ điền cả hai vị trí đối xứng.</p><p>Dùng sẵn: <code>lib.zeros</code>.</p>`,
    starter: R`function schwarzschildChristoffel(M, r, theta) {
  const G = lib.zeros(4, 4, 4);
  const f = 1 - 2 * M / r;
  const T = 0, R = 1, TH = 2, PH = 3;
  // TODO: G[T][T][R] = G[T][R][T] = ...
  return G;
}
`,
    solution: R`function schwarzschildChristoffel(M, r, theta) {
  const G = lib.zeros(4, 4, 4);
  const f = 1 - 2 * M / r;
  const s = Math.sin(theta), c = Math.cos(theta);
  const T = 0, R = 1, TH = 2, PH = 3;
  const sym = (l, m, n, v) => { G[l][m][n] = v; G[l][n][m] = v; };

  sym(T, T, R, M / (r * r * f));
  G[R][T][T] = M * f / (r * r);
  G[R][R][R] = -M / (r * r * f);
  G[R][TH][TH] = -r * f;
  G[R][PH][PH] = -r * f * s * s;
  sym(TH, R, TH, 1 / r);
  G[TH][PH][PH] = -s * c;
  sym(PH, R, PH, 1 / r);
  sym(PH, TH, PH, c / s);
  return G;
}
`,
    hints: ['Viết một hàm phụ sym(l, m, n, v) gán cả G[l][m][n] và G[l][n][m].', 'Có 9 thành phần độc lập; các Γ với hai chỉ số dưới giống nhau (Γ^r_tt…) chỉ có một vị trí.'],
    tests: [
      { name: 'Khớp với Christoffel số học tại mặt phẳng xích đạo', run(api, lib, t) {
        const x = [0, 7.3, Math.PI / 2, 0.4];
        const A = api.schwarzschildChristoffel(1, x[1], x[2]), N = lib.christoffel(lib.schwarzschildMetric(1), x);
        for (let l = 0; l < 4; l++) for (let m = 0; m < 4; m++) for (let n = 0; n < 4; n++) t.close(A[l][m][n], N[l][m][n], 1e-6, 'Γ[' + l + '][' + m + '][' + n + ']');
      } },
      { name: 'Khớp cả ngoài mặt phẳng xích đạo (θ = 1.0)', run(api, lib, t) {
        const x = [0, 4.1, 1.0, 0];
        const A = api.schwarzschildChristoffel(1, x[1], x[2]), N = lib.christoffel(lib.schwarzschildMetric(1), x);
        for (let l = 0; l < 4; l++) for (let m = 0; m < 4; m++) for (let n = 0; n < 4; n++) t.close(A[l][m][n], N[l][m][n], 1e-6, 'Γ[' + l + '][' + m + '][' + n + ']');
      } },
    ],
    visualize(plot, api) {
      const gr = [], nw = [];
      for (let i = 0; i <= 300; i++) { const r = 2.2 + i / 300 * 18; gr.push([r, api.schwarzschildChristoffel(1, r, Math.PI / 2)[1][0][0]]); nw.push([r, 1 / (r * r)]); }
      plot.frame({ xr: [2, 20], yr: [0, 0.2], xl: 'r / M', yl: 'gia tốc' });
      plot.line(nw, plot.colors.muted, { dash: [5, 4] }); plot.line(gr, plot.palette[0]);
      plot.legend([['Γʳ_tt = M(1−2M/r)/r²', plot.palette[0]], ['Newton M/r²', plot.colors.muted]]);
    },
  });

  add({
    id: 'schw-geodesic', module: '4. Hình học Schwarzschild', title: 'Trắc địa xích đạo & đại lượng bảo toàn',
    exports: ['schwarzschildRHS', 'conservedEL', 'normError'],
    theory: R`
<p>Nhờ đối xứng cầu, quỹ đạo nằm trong một mặt phẳng; chọn $\theta = \pi/2$, $u^\theta = 0$ thì nó ở đó mãi.
Trạng thái rút gọn còn 6 thành phần $y = [t, r, \phi, u^t, u^r, u^\phi]$, với $\lambda = \tau$ (thời gian riêng):</p>
$$\begin{aligned}
\frac{du^t}{d\tau} &= -2\Gamma^t_{tr}\,u^t u^r\\
\frac{du^r}{d\tau} &= -\Gamma^r_{tt}(u^t)^2 - \Gamma^r_{rr}(u^r)^2 - \Gamma^r_{\phi\phi}(u^\phi)^2\\
\frac{du^\phi}{d\tau} &= -2\Gamma^\phi_{r\phi}\,u^r u^\phi
\end{aligned}$$
<p>(Hệ số 2 xuất hiện vì $\Gamma^t_{tr}u^tu^r + \Gamma^t_{rt}u^ru^t$.)
Metric không phụ thuộc $t$ và $\phi$ ⇒ theo định lý Noether có hai đại lượng bảo toàn:</p>
$$E = -u_t = \left(1 - \frac{2M}{r}\right)u^t \quad\text{(năng lượng/đơn vị khối lượng)},\qquad L = u_\phi = r^2 u^\phi.$$
<p>Cùng với ràng buộc $g_{\mu\nu}u^\mu u^\nu = -1$, đây là ba "máy dò lỗi" cho bộ tích phân của bạn.
Quỹ đạo tròn bán kính $r$: $u^t = 1/\sqrt{1 - 3M/r}$, $u^\phi = u^t\sqrt{M/r^3}$.</p>`,
    task: R`
<ul>
<li><code>schwarzschildRHS(M)</code> → hàm <code>(τ, y) =&gt; dy</code> (6 thành phần).</li>
<li><code>conservedEL(M, y)</code> → <code>{ E, L }</code>.</li>
<li><code>normError(M, y)</code> → $g_{\mu\nu}u^\mu u^\nu + 1$ (lý tưởng = 0).</li>
</ul>
<p>Dùng sẵn: <code>lib.schwarzschildChristoffel</code>, <code>lib.rk4Step</code>, <code>lib.integrate</code>.</p>`,
    starter: R`function schwarzschildRHS(M) {
  return function (tau, y) {
    const [t, r, phi, ut, ur, uphi] = y;
    // TODO
  };
}

function conservedEL(M, y) {
  // TODO
}

function normError(M, y) {
  // TODO
}
`,
    solution: R`function schwarzschildRHS(M) {
  return function (tau, y) {
    const [t, r, phi, ut, ur, uphi] = y;
    const G = lib.schwarzschildChristoffel(M, r, Math.PI / 2);
    return [
      ut,
      ur,
      uphi,
      -2 * G[0][0][1] * ut * ur,
      -G[1][0][0] * ut * ut - G[1][1][1] * ur * ur - G[1][3][3] * uphi * uphi,
      -2 * G[3][1][3] * ur * uphi,
    ];
  };
}

function conservedEL(M, y) {
  const [, r, , ut, , uphi] = y;
  return { E: (1 - 2 * M / r) * ut, L: r * r * uphi };
}

function normError(M, y) {
  const [, r, , ut, ur, uphi] = y;
  const f = 1 - 2 * M / r;
  return -f * ut * ut + ur * ur / f + r * r * uphi * uphi + 1;
}
`,
    hints: ['Chỉ số: Γᵗ_tr = G[0][0][1], Γʳ_tt = G[1][0][0], Γʳ_rr = G[1][1][1], Γʳ_φφ = G[1][3][3], Γᵠ_rφ = G[3][1][3].'],
    tests: [
      { name: 'Quỹ đạo tròn: duʳ/dτ = 0', run(api, lib, t) {
        const r = 20, ut = 1 / Math.sqrt(1 - 3 / r), up = ut * Math.sqrt(1 / r ** 3);
        const d = api.schwarzschildRHS(1)(0, [0, r, 0, ut, 0, up]);
        t.ok(Array.isArray(d) && d.length === 6, 'cần 6 thành phần');
        t.close(d[4], 0, 1e-14, 'duʳ/dτ');
        t.close(api.normError(1, [0, r, 0, ut, 0, up]), 0, 1e-12, 'ràng buộc chuẩn hóa');
      } },
      { name: 'Quỹ đạo tròn giữ nguyên r sau một vòng', run(api, lib, t) {
        const r = 20, ut = 1 / Math.sqrt(1 - 3 / r), up = ut * Math.sqrt(1 / r ** 3);
        const T = 2 * Math.PI / up, n = 2000;
        const p = lib.integrate(api.schwarzschildRHS(1), 0, [0, r, 0, ut, 0, up], T / n, n);
        t.close(p[n].y[1], r, 1e-8, 'r');
        t.close(p[n].y[2], 2 * Math.PI, 1e-8, 'φ');
      } },
      { name: 'E, L và ràng buộc được bảo toàn trên quỹ đạo lệch tâm', run(api, lib, t) {
        const r = 15, ut0 = 1 / Math.sqrt(1 - 3 / r), up = 0.85 * ut0 * Math.sqrt(1 / r ** 3);
        const y0 = [0, r, 0, 0, 0, up]; y0[3] = Math.sqrt((1 + r * r * up * up) / (1 - 2 / r));
        const a = api.conservedEL(1, y0);
        const p = lib.integrate(api.schwarzschildRHS(1), 0, y0, 0.5, 3000);
        const b = api.conservedEL(1, p[3000].y);
        t.close((b.E - a.E) / a.E, 0, 1e-9, 'ΔE/E');
        t.close((b.L - a.L) / a.L, 0, 1e-9, 'ΔL/L');
        t.close(api.normError(1, p[3000].y), 0, 1e-9, 'g(u,u) + 1');
      } },
    ],
    visualize(plot, api, lib) {
      const r = 15, up = 0.8 / Math.sqrt(1 - 3 / r) * Math.sqrt(1 / r ** 3);
      const y0 = [0, r, 0, Math.sqrt((1 + r * r * up * up) / (1 - 2 / r)), 0, up];
      const p = lib.integrate(api.schwarzschildRHS(1), 0, y0, 0.5, 9000);
      plot.frame({ xr: [-16, 16], yr: [-16, 16], equal: true, xl: 'x / M', yl: 'y / M' });
      plot.line(p.map((q) => [q.y[1] * Math.cos(q.y[2]), q.y[1] * Math.sin(q.y[2])]), plot.colors.a, { width: 1.2 });
      plot.circle(0, 0, 2, plot.colors.warn); plot.sun(0, 0);
      plot.text('Quỹ đạo hoa hồng: elip không khép kín', -15.5, 15);
    },
  });

  // ================= Chương 5: Quỹ đạo & hiệu ứng quan sát =================
  add({
    id: 'veff', module: '5. Quỹ đạo & kiểm chứng', title: 'Thế hiệu dụng & ISCO',
    exports: ['veff', 'circularOrbitRadii', 'iscoRadius'],
    theory: R`
<p>Thay $E$ và $L$ vào ràng buộc chuẩn hóa, chuyển động xuyên tâm trở thành bài toán 1 chiều:</p>
$$\left(\frac{dr}{d\tau}\right)^2 = E^2 - V_{\text{eff}}(r),\qquad
V_{\text{eff}} = \left(1 - \frac{2M}{r}\right)\left(1 + \frac{L^2}{r^2}\right) = 1 - \frac{2M}{r} + \frac{L^2}{r^2} - \frac{2ML^2}{r^3}$$
<p>Ba số hạng đầu chính là Newton. Số hạng cuối $-2ML^2/r^3$ là <b>đóng góp của GR</b>: nó gây ra tiên động cận nhật, và ở gần
hố đen nó thắng rào thế ly tâm, nuốt chửng vật thể.</p>
<p>Quỹ đạo tròn ở cực trị $dV/dr = 0 \iff Mr^2 - L^2 r + 3ML^2 = 0$:</p>
$$r_\pm = \frac{L^2 \pm \sqrt{L^4 - 12M^2L^2}}{2M}$$
<p>$r_+$ là cực tiểu (ổn định), $r_-$ là cực đại (không ổn định). Chỉ tồn tại khi $L^2 \ge 12M^2$; ở biên, $r_+ = r_- = 6M$:
<b>ISCO</b> — quỹ đạo tròn ổn định trong cùng. Mép trong của đĩa bồi tụ quanh hố đen nằm ở đây.</p>`,
    task: R`
<ul>
<li><code>veff(M, L, r)</code>.</li>
<li><code>circularOrbitRadii(M, L)</code> → <code>{ stable, unstable }</code> hoặc <code>null</code> nếu không tồn tại.</li>
<li><code>iscoRadius(M)</code>.</li>
</ul>`,
    starter: R`function veff(M, L, r) {
  // TODO
}

function circularOrbitRadii(M, L) {
  // TODO
}

function iscoRadius(M) {
  // TODO
}
`,
    solution: R`function veff(M, L, r) {
  return (1 - 2 * M / r) * (1 + (L * L) / (r * r));
}

function circularOrbitRadii(M, L) {
  const disc = L ** 4 - 12 * M * M * L * L;
  // Dung sai làm tròn: tại đúng L = √12·M, disc có thể ra −1e-15 thay vì 0
  if (disc < -1e-12 * L ** 4) return null;
  const s = Math.sqrt(Math.max(disc, 0));
  return { stable: (L * L + s) / (2 * M), unstable: (L * L - s) / (2 * M) };
}

function iscoRadius(M) {
  return circularOrbitRadii(M, Math.sqrt(12) * M).stable;
}
`,
    hints: ['ISCO là lúc biệt thức bằng 0: L = √12·M.', 'Bẫy số thực: Math.sqrt(12) ** 2 không đúng bằng 12, nên biệt thức tại ISCO có thể là −1e-15. Hãy cho phép một dung sai tương đối nhỏ thay vì so sánh < 0 cứng nhắc.'],
    tests: [
      { name: 'veff', run(api, lib, t) {
        t.close(api.veff(1, 4, 10), 0.8 * 1.16, 1e-12, 'V(10)');
      } },
      { name: 'L = 4M: quỹ đạo tròn tại r = 12M (ổn định) và 4M (không ổn định)', run(api, lib, t) {
        const c = api.circularOrbitRadii(1, 4);
        t.ok(c, 'phải tồn tại');
        t.close(c.stable, 12, 1e-12, 'ổn định'); t.close(c.unstable, 4, 1e-12, 'không ổn định');
        const d = (r) => (api.veff(1, 4, r + 1e-6) - api.veff(1, 4, r - 1e-6)) / 2e-6;
        t.close(d(12), 0, 1e-8, "V'(12)");
        t.ok(api.veff(1, 4, 11.9) > api.veff(1, 4, 12) && api.veff(1, 4, 12.1) > api.veff(1, 4, 12), 'r = 12 phải là cực tiểu');
      } },
      { name: 'L = 3M: không có quỹ đạo tròn; ISCO = 6M', run(api, lib, t) {
        t.ok(api.circularOrbitRadii(1, 3) === null, 'phải trả về null');
        t.close(api.iscoRadius(1), 6, 1e-9, 'ISCO (M=1)');
        t.close(api.iscoRadius(2.5), 15, 1e-9, 'ISCO (M=2.5)');
      } },
    ],
    visualize(plot, api) {
      plot.frame({ xr: [2, 40], yr: [0.86, 1.06], xl: 'r / M', yl: 'V_eff' });
      [3, Math.sqrt(12), 4, 4.3, 4.8].forEach((L, i) => {
        const pts = []; for (let k = 0; k <= 400; k++) { const r = 2.05 + k / 400 * 38; pts.push([r, Math.min(api.veff(1, L, r), 1.06)]); }
        plot.line(pts, plot.palette[i % plot.palette.length]);
        const c = api.circularOrbitRadii(1, L);
        if (c) { plot.dot(c.stable, api.veff(1, L, c.stable), plot.palette[i % plot.palette.length], 4); if (c.unstable > 2.05) plot.dot(c.unstable, api.veff(1, L, c.unstable), plot.colors.text, 3); }
      });
      plot.legend([['L = 3M', plot.palette[0]], ['L = √12 M (ISCO)', plot.palette[1]], ['L = 4M', plot.palette[2]], ['L = 4.3M', plot.palette[3]], ['L = 4.8M', plot.palette[4]]]);
    },
  });

  add({
    id: 'orbit-init', module: '5. Quỹ đạo & kiểm chứng', title: 'Điều kiện đầu cho quỹ đạo elip GR',
    exports: ['orbitInit'],
    theory: R`
<p>Ta muốn một quỹ đạo GR "giống" elip $(a, e)$: cận điểm $r_p = a(1-e)$, viễn điểm $r_a = a(1+e)$.
Tại hai điểm quay đầu $dr/d\tau = 0$ nên $E^2 = V_{\text{eff}}(r_p) = V_{\text{eff}}(r_a)$. Đặt $u = 1/r$:</p>
$$(1 - 2Mu_1)(1 + L^2u_1^2) = (1 - 2Mu_2)(1 + L^2u_2^2)$$
<p>Trừ hai vế và chia cho $(u_1 - u_2)$:</p>
$$L^2\left[(u_1 + u_2) - 2M(u_1^2 + u_1u_2 + u_2^2)\right] = 2M,\qquad E^2 = (1 - 2Mu_1)(1 + L^2u_1^2)$$
<p>Giới hạn Newton ($M \to 0$ trong ngoặc): $L^2 = Ma(1-e^2)$ — đúng công thức Kepler.
Quỹ đạo chỉ <b>liên kết & ổn định</b> nếu: mẫu số dương, tồn tại cực đại thế ($L^2 \ge 12M^2$) và nó nằm
<b>bên trong</b> $r_p$, và $E &lt; 1$. Nếu không, vật sẽ rơi vào hố đen.</p>
<p>Trạng thái đầu tại cận điểm: $u^r = 0$, $u^\phi = L/r_p^2$, $u^t = E/(1 - 2M/r_p)$.</p>`,
    task: R`<p><code>orbitInit(M, a, e)</code> → <code>{ E, L, rp, ra, y0 }</code> với <code>y0 = [0, rp, 0, ut, 0, uphi]</code>,
hoặc <code>null</code> nếu quỹ đạo không hợp lệ.</p><p>Dùng sẵn: <code>lib.veff</code>, <code>lib.circularOrbitRadii</code>, <code>lib.schwarzschildRHS</code>, <code>lib.rk4Step</code>.</p>`,
    starter: R`function orbitInit(M, a, e) {
  const rp = a * (1 - e), ra = a * (1 + e);
  const u1 = 1 / rp, u2 = 1 / ra;
  // TODO: tính L², E², kiểm tra tính hợp lệ, dựng y0
}
`,
    solution: R`function orbitInit(M, a, e) {
  const rp = a * (1 - e), ra = a * (1 + e);
  const u1 = 1 / rp, u2 = 1 / ra;
  const den = (u1 + u2) - 2 * M * (u1 * u1 + u1 * u2 + u2 * u2);
  if (den <= 0) return null;
  const L = Math.sqrt(2 * M / den);
  const E = Math.sqrt((1 - 2 * M * u1) * (1 + L * L * u1 * u1));
  const c = lib.circularOrbitRadii(M, L);
  if (!c || c.unstable >= rp || E >= 1) return null;
  const y0 = [0, rp, 0, E / (1 - 2 * M / rp), 0, L / (rp * rp)];
  return { E, L, rp, ra, y0 };
}
`,
    hints: ['L = √(2M / mẫu số).', 'Kiểm tra hợp lệ bằng lib.circularOrbitRadii(M, L): cần kết quả khác null và unstable < rp.'],
    tests: [
      { name: 'Giới hạn Newton: L² ≈ M·a(1 − e²)', run(api, lib, t) {
        const o = api.orbitInit(1e-8, 1, 0.3);
        t.ok(o, 'không được trả null');
        t.close(o.L * o.L / (1e-8 * 0.91), 1, 1e-6, 'tỉ số');
      } },
      { name: 'E² = V(r_p) = V(r_a) và ràng buộc chuẩn hóa', run(api, lib, t) {
        const M = 0.01, o = api.orbitInit(M, 1, 0.5);
        t.close(o.E * o.E, lib.veff(M, o.L, o.rp), 1e-13, 'V(r_p)');
        t.close(o.E * o.E, lib.veff(M, o.L, o.ra), 1e-13, 'V(r_a)');
        t.close(lib.normError(M, o.y0), 0, 1e-13, 'g(u,u)+1');
      } },
      { name: 'Tích phân: r thực sự dao động giữa r_p và r_a', run(api, lib, t) {
        const M = 0.01, o = api.orbitInit(M, 1, 0.5), f = lib.schwarzschildRHS(M);
        const h = 2 * Math.PI * Math.sqrt(1 / M) / 8000;
        let y = o.y0, rmax = 0, rmin = Infinity;
        for (let i = 0; i < 8000; i++) { y = lib.rk4Step(f, 0, y, h); rmax = Math.max(rmax, y[1]); rmin = Math.min(rmin, y[1]); }
        t.close(rmax, o.ra, 1e-6, 'r lớn nhất');
        t.close(rmin, o.rp, 1e-6, 'r nhỏ nhất');
      } },
      { name: 'Quỹ đạo rơi vào hố đen bị loại', run(api, lib, t) {
        t.ok(api.orbitInit(0.2, 1, 0.5) === null, 'M = 0.2, a = 1, e = 0.5 phải trả null');
      } },
    ],
    visualize(plot, api, lib) {
      const M = 0.01, o = api.orbitInit(M, 1, 0.5); if (!o) return;
      const p = lib.integrate(lib.schwarzschildRHS(M), 0, o.y0, 2 * Math.PI * 10 / 3000, 3000);
      plot.frame({ xr: [-1.7, 0.7], yr: [-1.1, 1.1], equal: true, xl: 'x', yl: 'y' });
      plot.circle(0, 0, o.rp, plot.colors.grid); plot.circle(0, 0, o.ra, plot.colors.grid);
      plot.line(p.map((q) => [q.y[1] * Math.cos(q.y[2]), q.y[1] * Math.sin(q.y[2])]), plot.colors.a);
      plot.sun(0, 0);
      plot.legend([['1 vòng GR (M = 0.01)', plot.colors.a], ['r_p và r_a', plot.colors.grid]]);
    },
  });

  add({
    id: 'precession', module: '5. Quỹ đạo & kiểm chứng', title: 'Tiên động cận nhật: Sao Thủy & Trái Đất',
    exports: ['measurePrecession', 'precessionArcsecPerCentury'],
    theory: R`
<p>Năm 1859 Le Verrier phát hiện cận nhật Sao Thủy dịch thêm 43″/thế kỷ mà cơ học Newton (kể cả nhiễu loạn
từ các hành tinh khác) không giải thích được. Năm 1915 Einstein tính ra đúng con số này — thắng lợi đầu tiên của GR.
Lý thuyết bậc một:</p>
$$\Delta\phi = \frac{6\pi M}{a(1 - e^2)}\quad\text{(radian / vòng, }M = GM_\odot/c^2\text{)}$$
<p><b>Đo bằng số</b>: tích phân trắc địa, mỗi lần $u^r$ đổi dấu từ âm sang dương là một lần qua cận điểm.
Nội suy tuyến tính để lấy $\phi$ chính xác:
$\phi_* = \phi_k + s(\phi_{k+1} - \phi_k)$ với $s = u^r_k/(u^r_k - u^r_{k+1})$.
Tiên động trung bình $= (\phi_{\text{cuối}} - \phi_{\text{đầu}})/(n - 1) - 2\pi$.</p>
<p>Mẹo: dùng bước thay đổi $h = h_0 (r/a)^{3/2}$ (nhỏ ở cận điểm, nơi mọi thứ thay đổi nhanh), với
$h_0 = T/\text{stepsPerOrbit}$, $T = 2\pi\sqrt{a^3/M}$.</p>
<p>Với Trái Đất kết quả chỉ là 3.84″/thế kỷ — vẫn đo được bằng radar và đo laser hiện đại.</p>`,
    task: R`
<ul>
<li><code>measurePrecession(M, a, e, nOrbits = 5, stepsPerOrbit = 2000)</code> → radian/vòng (đo bằng tích phân số).</li>
<li><code>precessionArcsecPerCentury(aMeters, e, periodDays)</code> → giây cung/thế kỷ cho quỹ đạo quanh Mặt Trời (dùng công thức).</li>
</ul>
<p>Dùng sẵn: <code>lib.orbitInit</code>, <code>lib.schwarzschildRHS</code>, <code>lib.rk4Step</code>, <code>lib.M_SUN_GEOM</code>, <code>lib.ARCSEC</code>.</p>`,
    starter: R`function measurePrecession(M, a, e, nOrbits = 5, stepsPerOrbit = 2000) {
  const o = lib.orbitInit(M, a, e);
  const f = lib.schwarzschildRHS(M);
  const h0 = 2 * Math.PI * Math.sqrt(a ** 3 / M) / stepsPerOrbit;
  const perihelia = [0];          // bắt đầu tại cận điểm, φ = 0
  let y = o.y0;
  // TODO: lặp tới khi perihelia.length > nOrbits
}

function precessionArcsecPerCentury(aMeters, e, periodDays) {
  // TODO
}
`,
    solution: R`function measurePrecession(M, a, e, nOrbits = 5, stepsPerOrbit = 2000) {
  const o = lib.orbitInit(M, a, e);
  const f = lib.schwarzschildRHS(M);
  const h0 = 2 * Math.PI * Math.sqrt(a ** 3 / M) / stepsPerOrbit;
  const perihelia = [0];
  let y = o.y0;
  let guard = 0;
  while (perihelia.length <= nOrbits && guard++ < 1e6) {
    const h = h0 * Math.pow(y[1] / a, 1.5);
    const next = lib.rk4Step(f, 0, y, h);
    if (y[4] < 0 && next[4] >= 0) {
      const s = y[4] / (y[4] - next[4]);
      perihelia.push(y[2] + s * (next[2] - y[2]));
    }
    y = next;
  }
  const n = perihelia.length - 1;
  return (perihelia[n] - perihelia[0]) / n - 2 * Math.PI;
}

function precessionArcsecPerCentury(aMeters, e, periodDays) {
  const perOrbit = 6 * Math.PI * lib.M_SUN_GEOM / (aMeters * (1 - e * e));
  const orbitsPerCentury = 36525 / periodDays;
  return perOrbit * orbitsPerCentury * lib.ARCSEC;
}
`,
    hints: [
      'Trong vòng lặp: tính h theo r hiện tại, bước RK4, rồi kiểm tra y[4] < 0 && next[4] >= 0.',
      'φ không bị "quấn" về [0, 2π) trong tích phân nên trừ thẳng được.',
      'Số vòng một thế kỷ = 36525 / periodDays.',
    ],
    tests: [
      { name: 'Đo được khớp 6πM/(a(1−e²)) trong 1% (M = 10⁻³, e = 0.3)', run(api, lib, t) {
        const th = 6 * Math.PI * 1e-3 / (1 - 0.09);
        const m = api.measurePrecession(1e-3, 1, 0.3, 4, 2000);
        t.close(m / th, 1, 0.01, 'tỉ số đo/lý thuyết');
      } },
      { name: 'Sao Thủy: 43″/thế kỷ', run(api, lib, t) {
        t.close(api.precessionArcsecPerCentury(5.7909e10, 0.2056, 87.969), 42.98, 0.1, '″/thế kỷ');
      } },
      { name: 'Trái Đất: 3.84″/thế kỷ', run(api, lib, t) {
        t.close(api.precessionArcsecPerCentury(lib.AU * 1.00000261, 0.0167086, 365.256), 3.84, 0.02, '″/thế kỷ');
      } },
    ],
    visualize(plot, api, lib) {
      const M = 0.006, e = 0.5, o = lib.orbitInit(M, 1, e), f = lib.schwarzschildRHS(M);
      const h0 = 2 * Math.PI * Math.sqrt(1 / M) / 1500;
      let y = o.y0; const pts = [], per = [];
      for (let i = 0; i < 1500 * 12; i++) {
        const n = lib.rk4Step(f, 0, y, h0 * Math.pow(y[1], 1.5));
        if (y[4] < 0 && n[4] >= 0) per.push(y[2]);
        y = n; if (i % 3 === 0) pts.push([y[1] * Math.cos(y[2]), y[1] * Math.sin(y[2])]);
      }
      plot.frame({ xr: [-1.7, 1.7], yr: [-1.7, 1.7], equal: true, xl: 'x', yl: 'y' });
      plot.line(pts, plot.colors.a, { width: 1 });
      per.forEach((phi) => plot.line([[0, 0], [0.75 * Math.cos(phi), 0.75 * Math.sin(phi)]], plot.colors.warn));
      plot.sun(0, 0);
      const m = api.measurePrecession(M, 1, e, 3, 1500);
      plot.text('đo: ' + (m * 180 / Math.PI).toFixed(3) + '°/vòng  ·  bậc 1: ' + (6 * Math.PI * M / (1 - e * e) * 180 / Math.PI).toFixed(3) + '°/vòng', -1.65, 1.55);
    },
  });

  add({
    id: 'clocks', module: '5. Quỹ đạo & kiểm chứng', title: 'Giãn nở thời gian: Trái Đất & GPS',
    exports: ['dTauDtCircular', 'earthClockLagPerYear', 'gpsOffsetMicrosecondsPerDay'],
    theory: R`
<p>Tốc độ đồng hồ trên quỹ đạo so với đồng hồ ở vô cực là $d\tau/dt = 1/u^t$. Với quỹ đạo tròn trong Schwarzschild
(gộp cả hiệu ứng hấp dẫn lẫn vận tốc):</p>
$$\frac{d\tau}{dt} = \sqrt{1 - \frac{3M}{r}}$$
<p>Trong trường yếu, khai triển bậc một (đơn vị SI):</p>
$$\frac{d\tau}{dt} \approx 1 - \underbrace{\frac{GM}{rc^2}}_{\text{hấp dẫn}} - \underbrace{\frac{v^2}{2c^2}}_{\text{vận tốc}}$$
<p><b>Trái Đất</b> trễ ≈ 0.47 s mỗi năm so với đồng hồ ở xa Mặt Trời.</p>
<p><b>GPS</b>: vệ tinh ở $r = 26\,560$ km bay với $v = \sqrt{GM_\oplus/r}$; đồng hồ mặt đất ở bán kính $R_\oplus$ quay với
$v = 465$ m/s (xích đạo). Hiệu ứng hấp dẫn làm đồng hồ vệ tinh <i>nhanh</i> hơn ~45.7 µs/ngày, vận tốc làm nó <i>chậm</i> đi ~7.2 µs/ngày.
Tổng cộng ≈ +38.6 µs/ngày; không bù trừ thì sai số định vị tăng ~11 km mỗi ngày.</p>`,
    task: R`
<ul>
<li><code>dTauDtCircular(M, r)</code> (đơn vị hình học).</li>
<li><code>earthClockLagPerYear()</code> → số giây đồng hồ Trái Đất chậm hơn trong 1 năm (dùng <code>lib.M_SUN_GEOM</code>, <code>lib.AU</code>, <code>lib.YEAR</code>, coi quỹ đạo tròn).</li>
<li><code>gpsOffsetMicrosecondsPerDay()</code> → µs/ngày đồng hồ vệ tinh chạy nhanh hơn đồng hồ mặt đất (dương). Dùng
<code>lib.GM_EARTH</code>, <code>lib.R_EARTH</code>, <code>lib.R_GPS</code>, <code>lib.V_EQUATOR</code>, <code>lib.C</code>, <code>lib.DAY</code>.</li>
</ul>`,
    starter: R`function dTauDtCircular(M, r) {
  // TODO
}

function earthClockLagPerYear() {
  // TODO
}

function gpsOffsetMicrosecondsPerDay() {
  // TODO: rate(satellite) - rate(ground), mỗi rate = 1 - GM/(r c²) - v²/(2c²)
}
`,
    solution: R`function dTauDtCircular(M, r) {
  return Math.sqrt(1 - 3 * M / r);
}

function earthClockLagPerYear() {
  return (1 - dTauDtCircular(lib.M_SUN_GEOM, lib.AU)) * lib.YEAR;
}

function gpsOffsetMicrosecondsPerDay() {
  const c2 = lib.C * lib.C;
  const rate = (r, v) => 1 - lib.GM_EARTH / (r * c2) - (v * v) / (2 * c2);
  const vSat = Math.sqrt(lib.GM_EARTH / lib.R_GPS);
  const diff = rate(lib.R_GPS, vSat) - rate(lib.R_EARTH, lib.V_EQUATOR);
  return diff * lib.DAY * 1e6;
}
`,
    hints: ['M_SUN_GEOM tính bằng mét, AU cũng bằng mét — tỉ số M/r không thứ nguyên.', 'Vận tốc quỹ đạo tròn: v = √(GM/r).'],
    tests: [
      { name: 'dτ/dt tại ISCO = √(1/2)', run(api, lib, t) {
        t.close(api.dTauDtCircular(1, 6), Math.SQRT1_2, 1e-12, 'dτ/dt');
      } },
      { name: 'Đồng hồ Trái Đất chậm ≈ 0.467 s/năm', run(api, lib, t) {
        t.close(api.earthClockLagPerYear(), 0.4673, 0.002, 's/năm');
      } },
      { name: 'GPS: +38.6 µs/ngày', run(api, lib, t) {
        t.close(api.gpsOffsetMicrosecondsPerDay(), 38.6, 0.3, 'µs/ngày');
      } },
    ],
    visualize(plot, api, lib) {
      const c2 = lib.C * lib.C;
      const grav = (lib.GM_EARTH / lib.R_EARTH - lib.GM_EARTH / lib.R_GPS) / c2 * lib.DAY * 1e6;
      const vel = -(lib.GM_EARTH / lib.R_GPS - lib.V_EQUATOR ** 2) / (2 * c2) * lib.DAY * 1e6;
      const net = api.gpsOffsetMicrosecondsPerDay();
      plot.frame({ xr: [0, 3], yr: [-12, 52], xl: '', yl: 'µs / ngày', xticks: false });
      [[grav, 'hấp dẫn', plot.palette[0]], [vel, 'vận tốc', plot.palette[2]], [net, 'tổng (code của bạn)', plot.palette[1]]].forEach(([v, name, col], i) => {
        plot.rect(i + 0.2, 0, 0.6, v, col);
        plot.text(name + ': ' + v.toFixed(2), i + 0.12, v >= 0 ? v + 3 : v - 2.5);
      });
      plot.line([[0, 0], [3, 0]], plot.colors.muted);
    },
  });

  add({
    id: 'lensing', module: '5. Quỹ đạo & kiểm chứng', title: 'Ánh sáng bị bẻ cong: Eddington 1919',
    exports: ['photonDeflection', 'sunDeflectionArcsec'],
    theory: R`
<p>Photon đi theo <b>trắc địa null</b> ($ds^2 = 0$). Thay vì tích phân theo tham số affine, ta dùng phương trình quỹ đạo
cho $u = 1/r$ theo góc $\phi$ (suy ra từ phương trình trắc địa + bảo toàn $E$, $L$):</p>
$$\frac{d^2u}{d\phi^2} + u = 3Mu^2$$
<p>Không có khối lượng, nghiệm $u = \sin\phi / b$ là đường thẳng cách tâm $b$ (tham số va chạm), đi từ vô cực ở
$\phi = 0$ tới vô cực ở $\phi = \pi$. Có khối lượng, photon ra tới vô cực ở $\phi = \pi + \delta$ với</p>
$$\delta \approx \frac{4M}{b} + \frac{15\pi}{4}\frac{M^2}{b^2} + \frac{128}{3}\frac{M^3}{b^3}$$
<p>Ánh sáng sượt mép Mặt Trời: $\delta = 1.75''$ — gấp đôi giá trị "Newton" $2M/b$. Đo đạc nhật thực năm 1919 của
Eddington xác nhận giá trị GR và đưa Einstein lên trang nhất báo chí toàn thế giới.</p>
<p><b>Thuật toán</b>: trạng thái $[u, u']$ với $u(0) = 0$, $u'(0) = 1/b$; bước RK4 theo $\phi$ cho tới khi $u$ trở lại âm
(sau khi đã đi qua điểm gần nhất); nội suy tuyến tính để tìm $\phi$ tại $u = 0$.</p>`,
    task: R`
<ul>
<li><code>photonDeflection(M, b, nSteps = 20000)</code> → $\delta$ (radian), dùng tích phân số với bước $h = 1.2\pi/\text{nSteps}$.</li>
<li><code>sunDeflectionArcsec()</code> → độ lệch tia sáng sượt mép Mặt Trời, giây cung (<code>lib.M_SUN_GEOM</code>, <code>lib.R_SUN</code>).</li>
</ul>
<p>Dùng sẵn: <code>lib.rk4Step</code>, <code>lib.ARCSEC</code>.</p>`,
    starter: R`function photonDeflection(M, b, nSteps = 20000) {
  const f = (phi, [u, du]) => [du, /* TODO: u'' */ 0];
  const h = 1.2 * Math.PI / nSteps;
  let y = [0, 1 / b], phi = 0;
  // TODO: bước cho tới khi u < 0, nội suy, trả về phi_end - PI
}

function sunDeflectionArcsec() {
  // TODO
}
`,
    solution: R`function photonDeflection(M, b, nSteps = 20000) {
  const f = (phi, [u, du]) => [du, 3 * M * u * u - u];
  const h = 1.2 * Math.PI / nSteps;
  let y = [0, 1 / b], phi = 0;
  for (let i = 0; i < 10 * nSteps; i++) {
    const next = lib.rk4Step(f, phi, y, h);
    if (next[0] < 0) {
      const s = y[0] / (y[0] - next[0]);
      return phi + s * h - Math.PI;
    }
    y = next;
    phi += h;
  }
  return NaN; // photon bị bắt (b quá nhỏ)
}

function sunDeflectionArcsec() {
  return photonDeflection(lib.M_SUN_GEOM, lib.R_SUN) * lib.ARCSEC;
}
`,
    hints: ['u\'\' = 3Mu² − u.', 'Điều kiện dừng: giá trị u của bước kế tiếp < 0 (u bắt đầu bằng 0 nên đừng kiểm tra điểm đầu).', 'Nếu b < 3√3·M photon bị hố đen bắt — hãy trả NaN.'],
    tests: [
      { name: 'Không có khối lượng: δ = 0', run(api, lib, t) {
        t.close(api.photonDeflection(0, 5), 0, 1e-8, 'δ');
      } },
      { name: 'M/b = 10⁻³: δ ≈ 4M/b', run(api, lib, t) {
        t.close(api.photonDeflection(1, 1000) / 4e-3, 1, 0.01, 'δ / (4M/b)');
      } },
      { name: 'M/b = 10⁻²: khớp khai triển tới bậc ba', run(api, lib, t) {
        const m = 0.01, th = 4 * m + 15 * Math.PI / 4 * m * m + 128 / 3 * m ** 3;
        t.close(api.photonDeflection(1, 100) / th, 1, 2e-4, 'tỉ số');
      } },
      { name: 'Mặt Trời: 1.75″', run(api, lib, t) {
        t.close(api.sunDeflectionArcsec(), 1.751, 0.01, '″');
      } },
    ],
    visualize(plot, api) {
      plot.frame({ xr: [-30, 30], yr: [-14, 18], equal: true, xl: 'x / M', yl: 'y / M' });
      [5.4, 6.5, 8, 10, 13, 16].forEach((b, i) => {
        const pts = []; let y = [0, 1 / b], phi = 0; const h = 0.002;
        for (let k = 0; k < 6000; k++) {
          const r = 1 / y[0]; if (y[0] > 0 && r < 60) pts.push([r * Math.cos(phi), r * Math.sin(phi)]);
          const d1 = [y[1], 3 * y[0] * y[0] - y[0]]; const mid = [y[0] + h / 2 * d1[0], y[1] + h / 2 * d1[1]];
          const d2 = [mid[1], 3 * mid[0] * mid[0] - mid[0]]; y = [y[0] + h * d2[0], y[1] + h * d2[1]]; phi += h;
          if (y[0] < 0 || y[0] > 0.5) break;
        }
        plot.line(pts.reverse(), plot.palette[i % plot.palette.length]);
        const d = api.photonDeflection(1, b);
        plot.text('b=' + b + ': δ=' + (isFinite(d) ? (d * 180 / Math.PI).toFixed(1) + '°' : 'bị bắt'), 14, -2 - i * 2);
      });
      plot.circle(0, 0, 2, plot.colors.warn); plot.circle(0, 0, 3, plot.colors.grid);
      plot.text('photon đi từ phải sang trái', -29, 17);
    },
  });

  // ================= Chương 6: Tổng hợp =================
  add({
    id: 'capstone', module: '6. Tổng hợp', title: 'Dự án cuối: bộ mô phỏng quỹ đạo hoàn chỉnh',
    exports: ['createSimulator'],
    theory: R`
<p>Ghép mọi thứ thành một bộ mô phỏng có trạng thái — chính là kiến trúc của <code>simulation/physics.js</code>
(hãy mở file đó ra so sánh sau khi làm xong):</p>
<ol>
<li><b>Điều kiện đầu</b> từ $(M, a, e)$ → $E, L$ → $u^\mu$ hợp lệ.</li>
<li><b>Vòng lặp tích phân</b> bước biến thiên $h \propto r^{3/2}$, theo thời gian riêng $\tau$.</li>
<li><b>Quan sát</b>: vị trí $(x, y)$, thời gian tọa độ $t$, thời gian riêng $\tau$, các lần qua cận điểm.</li>
<li><b>Chẩn đoán</b>: ràng buộc chuẩn hóa — nếu nó trôi xa 0, kết quả không đáng tin.</li>
</ol>
<p>Một nguyên tắc thiết kế quan trọng: <b>tách vật lý khỏi hiển thị</b>. Bộ mô phỏng không biết gì về canvas;
phần vẽ chỉ đọc trạng thái. Nhờ vậy bạn test được vật lý (như bài này làm) mà không cần trình duyệt.</p>`,
    task: R`
<p><code>createSimulator(M, a, e, stepsPerOrbit = 1500)</code> → object có:</p>
<ul>
<li><code>step()</code>: tiến một bước RK4.</li>
<li><code>position()</code> → <code>{ x, y }</code>; thuộc tính <code>tau</code> (thời gian riêng) và <code>t</code> (thời gian tọa độ).</li>
<li><code>perihelia</code>: mảng các góc $\phi$ (nội suy) tại mỗi lần qua cận điểm, <b>không</b> tính điểm đầu.</li>
<li><code>precession()</code> → tiên động trung bình (rad/vòng) từ <code>perihelia</code>, hoặc <code>null</code> nếu có &lt; 2 lần.</li>
<li><code>normError()</code>.</li>
</ul>
<p>Dùng sẵn mọi thứ trong <code>lib</code>.</p>`,
    starter: R`function createSimulator(M, a, e, stepsPerOrbit = 1500) {
  const o = lib.orbitInit(M, a, e);
  if (!o) throw new Error('Quỹ đạo không hợp lệ');
  const f = lib.schwarzschildRHS(M);
  const h0 = 2 * Math.PI * Math.sqrt(a ** 3 / M) / stepsPerOrbit;

  const sim = {
    y: o.y0.slice(),
    tau: 0,
    get t() { return this.y[0]; },
    perihelia: [],
    step() {
      // TODO
    },
    position() {
      // TODO
    },
    precession() {
      // TODO
    },
    normError() {
      return lib.normError(M, this.y);
    },
  };
  return sim;
}
`,
    solution: R`function createSimulator(M, a, e, stepsPerOrbit = 1500) {
  const o = lib.orbitInit(M, a, e);
  if (!o) throw new Error('Quỹ đạo không hợp lệ');
  const f = lib.schwarzschildRHS(M);
  const h0 = 2 * Math.PI * Math.sqrt(a ** 3 / M) / stepsPerOrbit;

  const sim = {
    y: o.y0.slice(),
    tau: 0,
    get t() { return this.y[0]; },
    perihelia: [],
    step() {
      const y = this.y;
      const h = h0 * Math.pow(y[1] / a, 1.5);
      const next = lib.rk4Step(f, this.tau, y, h);
      if (y[4] < 0 && next[4] >= 0) {
        const s = y[4] / (y[4] - next[4]);
        this.perihelia.push(y[2] + s * (next[2] - y[2]));
      }
      this.y = next;
      this.tau += h;
    },
    position() {
      const [, r, phi] = this.y;
      return { x: r * Math.cos(phi), y: r * Math.sin(phi) };
    },
    precession() {
      const P = this.perihelia;
      if (P.length < 2) return null;
      return (P[P.length - 1] - P[0]) / (P.length - 1) - 2 * Math.PI;
    },
    normError() {
      return lib.normError(M, this.y);
    },
  };
  return sim;
}
`,
    hints: ['step() gần giống hệt vòng lặp trong bài tiên động — chỉ là tách ra thành từng bước.', 'Đừng quên cộng tau += h.'],
    tests: [
      { name: 'Chạy 4 vòng: tiên động khớp lý thuyết (±3%)', run(api, lib, t) {
        const sim = api.createSimulator(0.002, 1, 0.4);
        let guard = 0;
        while (sim.perihelia.length < 5 && guard++ < 2e5) sim.step();
        const th = 6 * Math.PI * 0.002 / (1 - 0.16);
        t.close(sim.precession() / th, 1, 0.03, 'tỉ số');
      } },
      { name: 'Ràng buộc chuẩn hóa, t > τ, vị trí trong [r_p, r_a]', run(api, lib, t) {
        const sim = api.createSimulator(0.002, 1, 0.4);
        for (let i = 0; i < 3000; i++) sim.step();
        t.close(sim.normError(), 0, 1e-9, 'g(u,u)+1');
        t.ok(sim.t > sim.tau && sim.tau > 0, 'đồng hồ tọa độ phải chạy nhanh hơn thời gian riêng');
        const p = sim.position(), r = Math.hypot(p.x, p.y);
        t.ok(r >= 0.6 - 1e-6 && r <= 1.4 + 1e-6, 'r = ' + r + ' nằm ngoài [0.6, 1.4]');
        t.ok(api.createSimulator(0.002, 1, 0.4).precession() === null, 'chưa có cận điểm thì precession() = null');
      } },
    ],
    visualize(plot, api) {
      const sim = api.createSimulator(0.012, 1, 0.55, 900);
      const trail = [];
      plot.animate(() => {
        for (let i = 0; i < 12; i++) { sim.step(); const p = sim.position(); trail.push([p.x, p.y]); }
        if (trail.length > 15000) trail.splice(0, trail.length - 15000);
        plot.frame({ xr: [-1.8, 1.8], yr: [-1.8, 1.8], equal: true, xl: 'x', yl: 'y' });
        plot.line(trail, plot.colors.a, { width: 1.1 });
        sim.perihelia.forEach((phi) => plot.line([[0, 0], [0.5 * Math.cos(phi), 0.5 * Math.sin(phi)]], plot.colors.warn));
        plot.sun(0, 0);
        const p = sim.position(); plot.dot(p.x, p.y, plot.colors.text, 4);
        const pr = sim.precession();
        plot.text('vòng: ' + sim.perihelia.length + '  ·  tiên động: ' + (pr == null ? '—' : (pr * 180 / Math.PI).toFixed(2) + '°/vòng') +
          '  ·  t − τ = ' + (sim.t - sim.tau).toFixed(2) + '  ·  |g(u,u)+1| = ' + Math.abs(sim.normError()).toExponential(1), -1.75, 1.65);
      });
    },
  });

  add({
    id: 'challenges', module: '6. Tổng hợp', title: 'Thử thách mở rộng (sân chơi tự do)',
    exports: [], playground: true,
    theory: R`
<p>Không có test — đây là sân chơi. Code của bạn được chạy với <code>lib</code> (toàn bộ lời giải các bài trước)
và <code>plot</code> (bộ vẽ). Một số hướng đi để biến lý thuyết thành dự án thật:</p>
<ol>
<li><b>Trễ Shapiro</b>: tín hiệu radar sượt qua Mặt Trời tới Sao Kim bị trễ thêm ~200 µs.
Tích phân $dt/d\phi$ dọc trắc địa null và so sánh với $4M\ln(4r_1r_2/b^2)$.</li>
<li><b>Sao S2 quanh Sgr A*</b>: $M = 4.3\times10^6 M_\odot$, $a = 1000$ AU, $e = 0.88$. Tiên động đo bởi GRAVITY (2020) ≈ 12′/vòng.</li>
<li><b>Bóng hố đen</b>: bắn photon với nhiều $b$, tìm ngưỡng bị bắt $b_c = 3\sqrt3 M$; dựng ảnh ray-tracing đĩa bồi tụ.</li>
<li><b>Metric Kerr</b> (hố đen quay): viết <code>kerrMetric(M, a)</code> trong tọa độ Boyer–Lindquist, dùng
<code>lib.christoffel</code> số và <code>lib.geodesicRHS</code> có sẵn — quan sát hiệu ứng kéo hệ quy chiếu (frame dragging).</li>
<li><b>Bộ tích phân bảo toàn</b>: thay RK4 bằng Gauss–Legendre symplectic hoặc RK45 thích ứng; so sánh độ trôi của
$g_{\mu\nu}u^\mu u^\nu$ sau $10^5$ vòng.</li>
<li><b>Sao Thủy N-vật</b>: thêm nhiễu loạn từ Sao Kim, Trái Đất, Sao Mộc (Newton) + hiệu chỉnh 1PN, tái hiện tổng 574″/thế kỷ.</li>
</ol>
<p>API của <code>plot</code>: <code>frame({xr, yr, equal, xl, yl})</code>, <code>line(pts, color, {dash, width})</code>,
<code>dot(x, y, color, r)</code>, <code>circle(x, y, r, color)</code>, <code>text(s, x, y)</code>, <code>sun(x, y)</code>,
<code>legend([[label, color]])</code>, <code>animate(fn)</code>, <code>palette</code>, <code>colors</code>.</p>`,
    task: R`<p>Bấm <b>Chạy</b> để thực thi code; dùng <code>console.log</code> để in kết quả.</p>`,
    starter: R`// Ví dụ: ngưỡng bắt photon — so sánh với 3√3 M ≈ 5.196 M
let lo = 3, hi = 8;
for (let i = 0; i < 40; i++) {
  const mid = (lo + hi) / 2;
  if (Number.isNaN(lib.photonDeflection(1, mid, 4000))) lo = mid; else hi = mid;
}
console.log('b_c ≈', hi.toFixed(5), '  lý thuyết:', (3 * Math.sqrt(3)).toFixed(5));

plot.frame({ xr: [0, 20], yr: [0, 6], xl: 'b / M', yl: 'δ (rad)' });
const pts = [];
for (let b = hi + 0.01; b < 20; b += 0.05) pts.push([b, lib.photonDeflection(1, b, 4000)]);
plot.line(pts, plot.colors.a);
plot.line(pts.map(([b]) => [b, 4 / b]), plot.colors.muted, { dash: [4, 4] });
plot.legend([['δ chính xác (số)', plot.colors.a], ['4M/b (bậc 1)', plot.colors.muted]]);
`,
    solution: '',
    hints: [],
    tests: [],
  });

  const api = { BASE_LIB, EXERCISES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GR_COURSE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

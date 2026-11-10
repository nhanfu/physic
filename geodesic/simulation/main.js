/* main.js — giao diện & vẽ cho mô phỏng (vật lý nằm trong physics.js) */
(function () {
  'use strict';
  const P = window.GRPhysics;
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const COL = {
    gr: css('--gr'), newton: css('--newton'), sun: css('--sun'), peri: css('--peri'),
    line: css('--line'), muted: css('--muted'), text: css('--text'), good: css('--good'), warn: css('--warn'),
  };
  const ARCSEC = 180 * 3600 / Math.PI;
  const TRAIL_MAX = 24000;

  // ---------- Trạng thái ----------
  const ui = {
    running: true, speed: 10, massLog: 0, ecc: P.EARTH.e,
    showNewton: true, showPeri: true, view3d: 'worldline', chart: 'veff',
    zoom: 1, yaw: -0.6, pitch: 0.42, dragging: false, autoRotate: true,
  };
  let sim, grTrail, nwTrail;

  function build() {
    const M = P.M_SUN * Math.pow(10, ui.massLog);
    sim = new P.OrbitSim({ M, a: P.EARTH.a, e: ui.ecc, stepsPerOrbit: 1500 });
    grTrail = []; nwTrail = [];
    pushTrail();
    updateLabels();
  }
  function pushTrail() {
    const p = sim.position();
    if (p) grTrail.push(p);
    nwTrail.push({ x: sim.nw[0], y: sim.nw[1] });
    if (grTrail.length > TRAIL_MAX) grTrail.splice(0, grTrail.length - TRAIL_MAX);
    if (nwTrail.length > TRAIL_MAX) nwTrail.splice(0, nwTrail.length - TRAIL_MAX);
  }

  // ---------- Canvas tiện ích ----------
  function fit(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function polyline(ctx, pts, map, stride = 1) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += stride) {
      const [X, Y] = map(pts[i]);
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    const last = pts[pts.length - 1];
    if (last) { const [X, Y] = map(last); ctx.lineTo(X, Y); }
    ctx.stroke();
  }
  function sunGlyph(ctx, X, Y, r) {
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 4);
    g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.25, 'rgba(255,190,70,0.35)'); g.addColorStop(1, 'rgba(255,170,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.sun; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
  }
  function earthGlyph(ctx, X, Y, r = 5) {
    ctx.fillStyle = 'rgba(79,209,255,0.25)'; ctx.beginPath(); ctx.arc(X, Y, r * 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#7fe0ff'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
  }

  // ---------- Quỹ đạo 2D ----------
  function drawOrbit() {
    const { ctx, w, h } = fit($('orbit'));
    ctx.clearRect(0, 0, w, h);
    const R = sim.k.ra * 1.08;
    const s = (Math.min(w, h) * 0.47 / R) * ui.zoom;
    const cx = w / 2, cy = h / 2;
    const map = (p) => [cx + p.x * s, cy - p.y * s];

    // lưới
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1; ctx.fillStyle = COL.muted; ctx.font = '11px system-ui';
    for (const rr of [0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
      if (rr * s < 20) continue;
      ctx.beginPath(); ctx.arc(cx, cy, rr * s, 0, 7); ctx.stroke();
      ctx.fillText(rr + ' AU', cx + rr * s * 0.707 + 3, cy - rr * s * 0.707 - 3);
    }

    // Newton
    if (ui.showNewton && nwTrail.length > 1) {
      ctx.strokeStyle = COL.newton; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      polyline(ctx, nwTrail.slice(-1600), map, 2);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // GR: vẽ theo từng đoạn, mờ dần về quá khứ
    const n = grTrail.length;
    if (n > 1) {
      const chunks = 24, size = Math.ceil(n / chunks), stride = Math.max(1, Math.floor(n / 9000));
      ctx.strokeStyle = COL.gr; ctx.lineWidth = 1.6;
      for (let c = 0; c < chunks; c++) {
        const seg = grTrail.slice(c * size, Math.min(n, (c + 1) * size + 1));
        if (seg.length < 2) continue;
        ctx.globalAlpha = 0.12 + 0.88 * Math.pow((c + 1) / chunks, 1.6);
        polyline(ctx, seg, map, stride);
      }
      ctx.globalAlpha = 1;
    }

    // các lần qua cận nhật
    if (ui.showPeri) {
      ctx.lineWidth = 1;
      const per = sim.perihelia.slice(-40), rp = sim.k.rp;
      per.forEach((phi, i) => {
        ctx.strokeStyle = COL.peri; ctx.globalAlpha = 0.25 + 0.75 * (i + 1) / per.length;
        const [X, Y] = map({ x: rp * Math.cos(phi), y: rp * Math.sin(phi) });
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (X - cx) * 1.25, cy + (Y - cy) * 1.25); ctx.stroke();
        ctx.fillStyle = COL.peri; ctx.beginPath(); ctx.arc(X, Y, 2.5, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Mặt Trời & bán kính Schwarzschild
    sunGlyph(ctx, cx, cy, 7);
    const rsPx = 2 * sim.M * s;
    ctx.fillStyle = COL.muted;
    if (rsPx > 2) {
      ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx, cy, rsPx, 0, 7); ctx.fill();
      ctx.strokeStyle = COL.warn; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL.warn; ctx.fillText('r_s', cx + rsPx + 4, cy + 4);
    }
    ctx.fillStyle = COL.muted;
    ctx.fillText('r_s = 2M = ' + fmtLen(2 * sim.M * P.AU), 10, h - 10);

    if (ui.showNewton) { const [X, Y] = map({ x: sim.nw[0], y: sim.nw[1] });
      ctx.strokeStyle = COL.newton; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.stroke(); }
    const p = sim.position();
    if (p) { const [X, Y] = map(p); earthGlyph(ctx, X, Y); }

    if (!sim.valid || sim.plunged) {
      ctx.fillStyle = COL.warn; ctx.font = '600 14px system-ui';
      ctx.fillText(sim.plunged ? 'Trái Đất đã rơi qua chân trời sự kiện!' :
        'Không có quỹ đạo liên kết ổn định với (M, e) này — giảm khối lượng hoặc e', 12, 22);
    }
  }

  // ---------- 3D: worldline & sơ đồ nhúng ----------
  function camera(w, h, scale) {
    const cy = Math.cos(ui.yaw), sy = Math.sin(ui.yaw), cp = Math.cos(ui.pitch), sp = Math.sin(ui.pitch);
    return (x, y, z) => {
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      const X = x1, Y = y1 * sp + z * cp, depth = -y1 * cp + z * sp;
      const k = 4 / (4 - depth * 0.6); // phối cảnh nhẹ
      return [w / 2 + X * scale * k, h * 0.56 - Y * scale * k];
    };
  }

  function drawWorldline() {
    const { ctx, w, h } = fit($('view3d'));
    ctx.clearRect(0, 0, w, h);
    const R = sim.k.ra;
    const proj = camera(w, h, Math.min(w, h) * 0.34);
    const tNow = sim.gr ? sim.gr[0] : 0;
    const kz = 0.55 / sim.period;           // 1 chu kỳ → 0.55 đơn vị chiều cao
    const z = (t) => (t - tNow) * kz + 0.55;
    const toP = (q) => proj(q.x / R, q.y / R, z(q.t));

    // mặt phẳng "hiện tại" t = t_now
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * 2 * Math.PI, [X, Y] = proj(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0.55);
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.stroke();

    // worldline của Mặt Trời: đường thẳng đứng
    ctx.strokeStyle = COL.sun; ctx.globalAlpha = 0.8; ctx.lineWidth = 2;
    const [sx0, sy0] = proj(0, 0, -1.25), [sx1, sy1] = proj(0, 0, 0.55);
    ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke(); ctx.globalAlpha = 1;

    // trục t
    const [ax, ay] = proj(-1.3, -1.3, -1.25), [bx, by] = proj(-1.3, -1.3, 0.75);
    ctx.strokeStyle = COL.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = COL.muted; ctx.font = '11px system-ui'; ctx.fillText('t', bx - 3, by - 6);

    // worldline Trái Đất (≈ 3.3 chu kỳ gần nhất)
    const tMin = tNow - 3.3 * sim.period;
    let i0 = grTrail.length - 1;
    while (i0 > 0 && grTrail[i0].t > tMin) i0--;
    const seg = grTrail.slice(i0);
    if (seg.length > 1) {
      const chunks = 16, size = Math.ceil(seg.length / chunks);
      ctx.strokeStyle = COL.gr; ctx.lineWidth = 1.8;
      for (let c = 0; c < chunks; c++) {
        const part = seg.slice(c * size, Math.min(seg.length, (c + 1) * size + 1));
        if (part.length < 2) continue;
        ctx.globalAlpha = 0.15 + 0.85 * (c + 1) / chunks;
        polyline(ctx, part, toP, 2);
      }
      ctx.globalAlpha = 1;
    }
    const [sx, sy] = proj(0, 0, 0.55); sunGlyph(ctx, sx, sy, 5);
    const p = sim.position();
    if (p) { const [X, Y] = toP(p); earthGlyph(ctx, X, Y, 4); }

    const lightYearsPerOrbit = sim.period * P.AU_OVER_C / P.YEAR;
    const squash = (sim.period / R) / (0.55 / 1);  // tỉ lệ nén thật của trục t
    ctx.fillStyle = COL.muted;
    ctx.fillText('1 vòng = ' + lightYearsPerOrbit.toPrecision(3) + ' năm ánh sáng theo t · trục t nén ×' + fmtBig(squash), 10, h - 10);
  }

  function drawEmbedding() {
    const { ctx, w, h } = fit($('view3d'));
    ctx.clearRect(0, 0, w, h);
    const rs = 2 * sim.M, R = sim.k.ra * 1.35;
    const rin = Math.max(rs * 1.0005, 0.06 * R);
    const zf = (r) => 2 * Math.sqrt(rs * (r - rs));
    const span = zf(R) - zf(rin);
    const ex = 0.75 * R / span;             // phóng đại trục đứng
    const height = (r) => (zf(r) - zf(R)) * ex / R + 0.25;
    const proj = camera(w, h, Math.min(w, h) * 0.36);
    const P3 = (r, phi) => proj(r * Math.cos(phi) / R, r * Math.sin(phi) / R, height(r));

    ctx.lineWidth = 1;
    const rings = 14, spokes = 28;
    for (let i = 0; i <= rings; i++) {
      const r = rin + (R - rin) * Math.pow(i / rings, 1.6);
      ctx.strokeStyle = COL.line; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let j = 0; j <= 72; j++) { const [X, Y] = P3(r, j / 72 * 2 * Math.PI); j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
    }
    for (let j = 0; j < spokes; j++) {
      const phi = j / spokes * 2 * Math.PI;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const r = rin + (R - rin) * Math.pow(i / 40, 1.6), [X, Y] = P3(r, phi);
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const [cx0, cy0] = proj(0, 0, height(rin));
    sunGlyph(ctx, cx0, cy0, 5);

    const recent = grTrail.slice(-Math.round(1600 * 1.6));
    if (recent.length > 1) {
      ctx.strokeStyle = COL.gr; ctx.lineWidth = 1.8;
      polyline(ctx, recent, (q) => P3(Math.hypot(q.x, q.y), Math.atan2(q.y, q.x)), 3);
    }
    const p = sim.position();
    if (p) { const [X, Y] = P3(p.r, Math.atan2(p.y, p.x)); earthGlyph(ctx, X, Y, 4); }
    ctx.fillStyle = COL.muted; ctx.font = '11px system-ui';
    ctx.fillText('Lát cắt t = const, z = 2√(r_s(r − r_s)) · trục đứng phóng đại ×' + fmtBig(ex), 10, h - 10);
  }

  // ---------- Biểu đồ ----------
  function axes(ctx, w, h, pad, xr, yr, xl, yl) {
    const X = (x) => pad.l + (x - xr[0]) / (xr[1] - xr[0]) * (w - pad.l - pad.r);
    const Y = (y) => h - pad.b - (y - yr[0]) / (yr[1] - yr[0]) * (h - pad.t - pad.b);
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    ctx.fillStyle = COL.muted; ctx.font = '11px system-ui';
    ctx.fillText(xl, w - pad.r - ctx.measureText(xl).width, h - 6);
    ctx.save(); ctx.translate(12, pad.t + 4); ctx.fillText(yl, 0, 8); ctx.restore();
    return { X, Y };
  }

  function drawVeff() {
    const { ctx, w, h } = fit($('chart'));
    ctx.clearRect(0, 0, w, h);
    if (!sim.valid) return;
    const M = sim.M, L = sim.k.L, E2 = sim.k.E ** 2, rp = sim.k.rp, ra = sim.k.ra;
    const radii = P.circularRadii(M, L);
    const strong = M / rp > 0.004;
    const rLo = strong ? Math.max(2.05 * M, radii.unstable * 0.75) : rp * 0.45, rHi = ra * 1.9;
    const N = 300, xs = [], gr = [], nw = [];
    for (let i = 0; i <= N; i++) {
      const r = rLo + (rHi - rLo) * i / N;
      xs.push(r); gr.push(P.veff(M, L, r) - 1); nw.push(P.veffNewton(M, L, r) - 1);
    }
    const e = E2 - 1;
    const lo = Math.min(...gr.filter(isFinite)), depth = e - lo;
    let hi = strong ? Math.max(e + depth * 1.5, Math.max(...gr) * 1.05) : e + depth * 2.2;
    hi = Math.min(hi, e + depth * 6);
    const yr = [lo - depth * 0.25, hi];
    const pad = { l: 34, r: 12, t: 12, b: 24 };
    const { X, Y } = axes(ctx, w, h, pad, [rLo, rHi], yr, 'r (AU)', 'V − 1');
    const clip = (v) => Math.max(yr[0], Math.min(yr[1], v));

    // vùng được phép r_p ≤ r ≤ r_a
    ctx.fillStyle = 'rgba(79,209,255,0.08)';
    ctx.fillRect(X(rp), pad.t, X(ra) - X(rp), h - pad.t - pad.b);
    const plot = (arr, col, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(dash || []);
      ctx.beginPath(); arr.forEach((v, i) => { const xx = X(xs[i]), yy = Y(clip(v)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); });
      ctx.stroke(); ctx.setLineDash([]);
    };
    plot(nw, COL.newton, [4, 4]);
    plot(gr, COL.gr);
    ctx.strokeStyle = COL.peri; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(e)); ctx.lineTo(w - pad.r, Y(e)); ctx.stroke();
    ctx.fillStyle = COL.peri; ctx.fillText('E² − 1', w - pad.r - 44, Y(e) - 4);
    const p = sim.position();
    if (p) { earthGlyph(ctx, X(p.r), Y(e), 4); }
    ctx.fillStyle = COL.muted;
    ctx.fillText('V = (1−2M/r)(1+L²/r²)  ·  Newton: 1 − 2M/r + L²/r² (đứt nét)', pad.l + 6, pad.t + 10);
  }

  function drawPeri() {
    const { ctx, w, h } = fit($('chart'));
    ctx.clearRect(0, 0, w, h);
    const th = P.precessionTheory(sim.M, sim.a, sim.e);
    const nOrb = Math.max(5, sim.perihelia.length);
    const useArcsec = th * nOrb < 0.02;
    const unit = useArcsec ? ARCSEC : 180 / Math.PI, uname = useArcsec ? '″' : '°';
    const cum = (arr) => arr.map((phi, i) => (phi - arr[0] - 2 * Math.PI * i) * unit);
    const g = cum(sim.perihelia), nw = cum(sim.nwPerihelia);
    const ymax = Math.max(th * (nOrb - 1) * unit, ...g, 1e-12) * 1.1;
    const pad = { l: 34, r: 12, t: 14, b: 24 };
    const { X, Y } = axes(ctx, w, h, pad, [0, nOrb - 1], [-ymax * 0.08, ymax], 'số vòng', 'Δφ (' + uname + ')');
    ctx.strokeStyle = COL.muted; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(nOrb - 1), Y(th * (nOrb - 1) * unit)); ctx.stroke(); ctx.setLineDash([]);
    const series = (arr, col) => {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); arr.forEach((v, i) => { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); }); ctx.stroke();
      arr.forEach((v, i) => { ctx.beginPath(); ctx.arc(X(i), Y(v), 2.5, 0, 7); ctx.fill(); });
    };
    series(nw, COL.newton);
    series(g, COL.gr);
    ctx.fillStyle = COL.muted;
    ctx.fillText('GR (xanh) · Newton (xám) · lý thuyết 6πM/(a(1−e²)) (đứt nét)', pad.l + 6, pad.t + 8);
  }

  // ---------- Số liệu ----------
  function fmtSci(v, d = 3) {
    if (v == null || !isFinite(v)) return '—';
    if (v === 0) return '0';
    const a = Math.abs(v);
    return a >= 1e-3 && a < 1e5 ? v.toPrecision(d + 1).replace(/\.?0+$/, '') : v.toExponential(d);
  }
  function fmtBig(v) { return v >= 1e4 ? v.toExponential(1).replace('e+', '·10^') : Math.round(v).toLocaleString('vi-VN'); }
  function fmtLen(m) { return m < 1000 ? m.toFixed(0) + ' m' : m < 1e7 ? (m / 1000).toFixed(2) + ' km' : (m / P.AU).toPrecision(3) + ' AU'; }
  function fmtAngle(rad) {
    if (rad == null) return '—';
    const as = rad * ARCSEC;
    return Math.abs(as) < 60 ? fmtSci(as) + '″' : fmtSci(rad * 180 / Math.PI) + '°';
  }
  function fmtTime(sec) {
    const a = Math.abs(sec);
    if (a < 1e-3) return fmtSci(sec * 1e6) + ' µs';
    if (a < 120) return fmtSci(sec) + ' s';
    if (a < 7200) return fmtSci(sec / 60) + ' phút';
    if (a < 2 * 86400) return fmtSci(sec / 3600) + ' giờ';
    if (a < 2 * P.YEAR) return fmtSci(sec / 86400) + ' ngày';
    return fmtSci(sec / P.YEAR) + ' năm';
  }

  function stat(k, v, s) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }

  function updateStats() {
    if (!sim.gr) { $('stats').innerHTML = stat('Trạng thái', 'Không có quỹ đạo ổn định', 'Hãy giảm khối lượng hoặc độ lệch tâm'); return; }
    const [t, r, , ut] = sim.gr, D = sim.gr[6];
    const sec = P.AU_OVER_C;
    const meas = sim.measuredPrecession(), th = P.precessionTheory(sim.M, sim.a, sim.e);
    const nwp = sim.newtonPrecession();
    const lagTheory = 1.5 * sim.M / sim.a * sim.period * sec;
    const orbitsPerCentury = 100 * P.YEAR / (sim.period * sec);
    const G = P.christoffel(sim.M, r);
    $('stats').innerHTML = [
      stat('Số vòng · thời gian tọa độ t', sim.orbits + ' vòng', 't = ' + fmtTime(t * sec) + ' · τ = ' + fmtTime(sim.tau * sec)),
      stat('Đồng hồ Trái Đất chậm hơn (t − τ)', fmtTime(D * sec),
        sim.orbits ? 'mỗi vòng ' + fmtTime(D * sec / (t / sim.period)) + ' · bậc 1: 3M/2a·T = ' + fmtTime(lagTheory) : 'bậc 1: 3M/2a·T = ' + fmtTime(lagTheory) + '/vòng'),
      stat('Tiên động cận nhật / vòng (đo)', fmtAngle(meas),
        'lý thuyết 6πM/a(1−e²) = ' + fmtAngle(th) + (meas ? ' · tỉ số ' + (meas / th).toFixed(4) : '')),
      stat('Tiên động / thế kỷ', meas ? fmtAngle(meas * orbitsPerCentury) : fmtAngle(th * orbitsPerCentury) + ' (lt)',
        'Newton (nhiễu số): ' + fmtAngle(nwp) + '/vòng'),
      stat('Hằng số chuyển động', 'E = 1 − ' + fmtSci(1 - sim.k.E), 'L = ' + fmtSci(sim.k.L) + ' AU · uᵗ = dt/dτ = 1 + ' + fmtSci(ut - 1)),
      stat('Ràng buộc g<sub>μν</sub>uᵘuᵛ + 1', fmtSci(sim.normError(), 2), 'r = ' + fmtSci(r, 6) + ' AU'),
      stat('Christoffel tại r hiện tại', '<span class="mono">Γʳ<sub>tt</sub> = ' + fmtSci(G.r_tt) + '</span>',
        '<span class="mono">Γʳ<sub>φφ</sub> = ' + fmtSci(G.r_pp) + ' · Γᵗ<sub>tr</sub> = ' + fmtSci(G.t_tr) + '</span>'),
    ].join('');
  }

  function updateLabels() {
    const k = Math.pow(10, ui.massLog);
    $('massVal').textContent = k < 10 ? k.toFixed(2) : fmtBig(k);
    $('eccVal').textContent = ui.ecc.toFixed(4);
    $('speedVal').textContent = ui.speed;
    $('massNote').textContent = ui.massLog === 0 ? 'Giá trị thật — hiệu ứng GR quá nhỏ để thấy bằng mắt, xem số liệu.' :
      'Phóng đại để nhìn thấy hiệu ứng (M = ' + fmtSci(sim.M) + ' AU)';
    $('play').textContent = ui.running ? '⏸ Tạm dừng' : '▶ Chạy';
  }

  // ---------- Vòng lặp ----------
  let frame = 0;
  function loop() {
    if (ui.running && sim.gr && !sim.plunged) {
      for (let i = 0; i < ui.speed; i++) { sim.step(); pushTrail(); }
    }
    if (ui.autoRotate && !ui.dragging) ui.yaw += 0.0015;
    drawOrbit();
    ui.view3d === 'worldline' ? drawWorldline() : drawEmbedding();
    ui.chart === 'veff' ? drawVeff() : drawPeri();
    if (frame++ % 8 === 0) updateStats();
    requestAnimationFrame(loop);
  }

  // ---------- Sự kiện ----------
  $('play').onclick = () => { ui.running = !ui.running; updateLabels(); };
  $('reset').onclick = build;
  $('mass').oninput = (e) => { ui.massLog = +e.target.value; build(); };
  $('ecc').oninput = (e) => { ui.ecc = +e.target.value; build(); };
  $('speed').oninput = (e) => { ui.speed = +e.target.value; updateLabels(); };
  $('showNewton').onchange = (e) => { ui.showNewton = e.target.checked; };
  $('showPeri').onchange = (e) => { ui.showPeri = e.target.checked; };
  const PRESETS = { real: [0, P.EARTH.e, 10], amp: [5.7, 0.4, 12], strong: [6.35, 0.5, 8] };
  document.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => {
    const [m, e, sp] = PRESETS[b.dataset.preset];
    ui.massLog = m; ui.ecc = e; ui.speed = sp;
    $('mass').value = m; $('ecc').value = e; $('speed').value = sp;
    ui.zoom = 1; ui.chart = b.dataset.preset === 'real' ? 'peri' : 'veff'; syncTabs();
    build();
  });
  function syncTabs() {
    document.querySelectorAll('#view3dTabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.view3d));
    document.querySelectorAll('#chartTabs button').forEach((b) => b.classList.toggle('on', b.dataset.c === ui.chart));
    $('view3dTitle').textContent = ui.view3d === 'worldline' ? 'Worldline trong không-thời gian (x, y, t)' : 'Không gian cong: sơ đồ nhúng Flamm';
    $('chartTitle').textContent = ui.chart === 'veff' ? 'Thế hiệu dụng' : 'Dịch chuyển cận nhật tích lũy';
  }
  document.querySelectorAll('#view3dTabs button').forEach((b) => b.onclick = () => { ui.view3d = b.dataset.v; syncTabs(); });
  document.querySelectorAll('#chartTabs button').forEach((b) => b.onclick = () => { ui.chart = b.dataset.c; syncTabs(); });

  $('orbit').addEventListener('wheel', (e) => {
    e.preventDefault();
    ui.zoom = Math.min(400, Math.max(0.3, ui.zoom * Math.exp(-e.deltaY * 0.0015)));
  }, { passive: false });
  $('orbit').ondblclick = () => { ui.zoom = 1; };

  const v3 = $('view3d');
  let last = null;
  v3.addEventListener('pointerdown', (e) => { ui.dragging = true; ui.autoRotate = false; last = [e.clientX, e.clientY]; v3.setPointerCapture(e.pointerId); });
  v3.addEventListener('pointermove', (e) => {
    if (!ui.dragging) return;
    ui.yaw -= (e.clientX - last[0]) * 0.008;
    ui.pitch = Math.min(1.5, Math.max(-0.2, ui.pitch + (e.clientY - last[1]) * 0.006));
    last = [e.clientX, e.clientY];
  });
  v3.addEventListener('pointerup', () => { ui.dragging = false; });

  build();
  syncTabs();
  requestAnimationFrame(loop);
})();

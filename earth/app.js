(() => {
  const Orbit = window.Orbit;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");

  const TAU = Math.PI * 2;
  const PITCH = 1.75;
  const TURNS = 3;
  const HEIGHT = PITCH * TURNS;
  const CYCLE = 27;

  const TABLE = Orbit.build({ turns: TURNS, h: 0.004 });
  const N = TABLE.n;
  const ZS = new Float64Array(N);
  for (let i = 0; i < N; i++) ZS[i] = (TABLE.t[i] / TABLE.tTotal) * HEIGHT;

  const view = { w: 0, h: 0, dpr: 1, base: 100, scale: 100, zoom: 1, cx: 0, cy: 0, zc: HEIGHT / 2 };
  const cam = { yaw: 0.62, pitch: 0.33 };
  const trig = { cy: 1, sy: 0, cp: 1, sp: 0 };

  let paused = false;
  let showGrid = true;
  let dirty = true;
  let phase = 0.5;
  let lastTime = 0;
  let dragging = false;
  const dragLast = { x: 0, y: 0 };

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function updateTrig() {
    trig.cy = Math.cos(cam.yaw);
    trig.sy = Math.sin(cam.yaw);
    trig.cp = Math.cos(cam.pitch);
    trig.sp = Math.sin(cam.pitch);
  }

  function fit() {
    updateTrig();
    const extent = HEIGHT * trig.cp + 2 * 1.08 * trig.sp;
    const fitH = (view.h * 0.80) / extent;
    const fitW = (view.w * 0.68) / 2.12;
    view.base = Math.min(fitH, fitW);
    view.scale = view.base * view.zoom;
    view.cx = view.w * 0.6;
    view.cy = view.h * 0.52;
    view.zc = HEIGHT * 0.5;
  }

  function project(x, y, z) {
    const xr = -x * trig.sy + y * trig.cy;
    const yr = -trig.sp * (x * trig.cy + y * trig.sy) + trig.cp * (z - view.zc);
    const d = trig.cp * (x * trig.cy + y * trig.sy) + trig.sp * (z - view.zc);
    return { x: view.cx + xr * view.scale, y: view.cy - yr * view.scale, d: d };
  }

  function indexAtZ(z) {
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ZS[mid] < z) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function posAtZ(z) {
    const i = indexAtZ(z);
    if (i <= 0) return { x: TABLE.x[0], y: TABLE.y[0] };
    const z0 = ZS[i - 1];
    const z1 = ZS[i];
    const f = z1 > z0 ? clamp((z - z0) / (z1 - z0), 0, 1) : 0;
    return {
      x: TABLE.x[i - 1] + (TABLE.x[i] - TABLE.x[i - 1]) * f,
      y: TABLE.y[i - 1] + (TABLE.y[i] - TABLE.y[i - 1]) * f
    };
  }

  function drawBackground(g) {
    const grd = g.createRadialGradient(
      view.w * 0.58, view.h * 0.44, 0,
      view.w * 0.58, view.h * 0.44, Math.max(view.w, view.h) * 0.78
    );
    grd.addColorStop(0, "#081018");
    grd.addColorStop(0.6, "#050a10");
    grd.addColorStop(1, "#030407");
    g.fillStyle = grd;
    g.fillRect(0, 0, view.w, view.h);
  }

  function drawBaseGrid(g) {
    const seg = 80;
    g.lineWidth = 1;
    g.strokeStyle = "rgba(70, 120, 150, 0.16)";
    for (const r of [0.5, 1.5]) {
      g.beginPath();
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        const p = project(r * Math.cos(a), r * Math.sin(a), 0);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
    }

    g.strokeStyle = "rgba(90, 175, 215, 0.32)";
    g.lineWidth = 1.1;
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      const p = project(Math.cos(a), Math.sin(a), 0);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();

    g.strokeStyle = "rgba(70, 120, 150, 0.11)";
    g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const p0 = project(0.34 * Math.cos(a), 0.34 * Math.sin(a), 0);
      const p1 = project(1.6 * Math.cos(a), 1.6 * Math.sin(a), 0);
      g.beginPath();
      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.stroke();
    }
  }

  function drawDimWorldline(g) {
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const p = project(TABLE.x[i], TABLE.y[i], ZS[i]);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokeStyle = "rgba(70, 140, 175, 0.20)";
    g.lineWidth = 1;
    g.stroke();
  }

  function drawSunAxis(g) {
    const p0 = project(0, 0, 0);
    const p1 = project(0, 0, HEIGHT);

    g.lineCap = "butt";
    g.strokeStyle = "rgba(255, 155, 70, 0.09)";
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(p0.x, p0.y);
    g.lineTo(p1.x, p1.y);
    g.stroke();

    g.strokeStyle = "rgba(255, 170, 90, 0.2)";
    g.lineWidth = 3.2;
    g.stroke();

    g.strokeStyle = "rgba(255, 205, 140, 0.72)";
    g.lineWidth = 1.1;
    g.stroke();

    g.strokeStyle = "rgba(255, 205, 140, 0.7)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p1.x, p1.y + 2);
    g.lineTo(p1.x, p1.y - 14);
    g.stroke();
    g.beginPath();
    g.moveTo(p1.x - 4, p1.y - 8);
    g.lineTo(p1.x, p1.y - 15);
    g.lineTo(p1.x + 4, p1.y - 8);
    g.stroke();

    g.strokeStyle = "rgba(255, 195, 120, 0.45)";
    for (let k = 1; k <= TURNS; k++) {
      const p = project(0, 0, k * PITCH);
      g.beginPath();
      g.moveTo(p.x - 4, p.y);
      g.lineTo(p.x + 4, p.y);
      g.stroke();
    }
  }

  function drawStatic() {
    const d = view.dpr;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, layer.width, layer.height);
    lctx.setTransform(d, 0, 0, d, 0, 0);

    drawBackground(lctx);
    if (showGrid) drawBaseGrid(lctx);
    drawDimWorldline(lctx);
    drawSunAxis(lctx);
  }

  function tag(g, text, x, y, align, color, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textBaseline = "middle";
    const pad = 5;
    const tw = g.measureText(text).width;
    const bx = align === "right" ? x - tw - pad * 2 : align === "center" ? x - tw / 2 - pad : x;
    g.fillStyle = "rgba(4, 6, 10, 0.78)";
    g.fillRect(bx, y - 9, tw + pad * 2, 18);
    g.fillStyle = color;
    g.fillText(text, bx + pad, y);
    g.restore();
  }

  function drawTrail(idx) {
    if (idx < 1) return;
    const CH = 36;
    const fade = Math.min(1, (1 - phase) / 0.05, phase / 0.02);

    for (let s = 0; s < idx; s += CH) {
      const a = s;
      const b = Math.min(idx, s + CH);
      const rec = b / Math.max(1, idx);
      let dep = 0;
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const p = project(TABLE.x[i], TABLE.y[i], ZS[i]);
        if (i === a) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        dep += p.d;
      }
      const dn = clamp((dep / (b - a + 1) + 1.8) / 3.6, 0, 1);
      const alpha = (0.16 + 0.7 * rec) * (0.72 + 0.28 * dn) * fade;
      const r = Math.round(50 + 80 * rec);
      const g = Math.round(115 + 115 * rec);
      const bl = Math.round(150 + 105 * rec);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.1 + 1 * rec;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  function bead(x, y, r, inner, glow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    grd.addColorStop(0, glow);
    grd.addColorStop(0.3, glow);
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawLabels(pE, fade) {
    const pTop = project(0, 0, HEIGHT);
    const pBottom = project(0, 0, 0);
    tag(ctx, "time", pTop.x, pTop.y - 30, "center", "#9fb0c2", 1);

    for (let k = 1; k <= TURNS; k++) {
      const p = project(0, 0, k * PITCH);
      tag(ctx, k + " yr", p.x + 13, p.y, "left", "#8a97a8", 0.95);
    }

    const pSunLbl = project(0, 0, 0.18 * HEIGHT);
    tag(ctx, "Sun's worldline", pSunLbl.x - 16, pSunLbl.y, "right", "#c9a26a", 0.9);

    const pSpace = project(TABLE.x[0], TABLE.y[0], 0);
    tag(ctx, "space at t = 0", pSpace.x, pSpace.y + 26, "center", "#7f8b99", 0.9);

    tag(ctx, "Earth", pE.x, pE.y - 20, "center", "#bfefff", fade);
  }

  function render(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (!paused) phase = (phase + dt / CYCLE) % 1;

    if (dirty) {
      drawStatic();
      dirty = false;
    }

    const d = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(d, 0, 0, d, 0, 0);

    const zNow = phase * HEIGHT;
    const idx = indexAtZ(zNow);
    const pos = posAtZ(zNow);
    const pE = project(pos.x, pos.y, zNow);
    const pS = project(0, 0, zNow);

    const fade = Math.min(1, phase / 0.006, (1 - phase) / 0.045);
    const trailIdx = clamp(idx, 0, N - 1);

    drawTrail(trailIdx);

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = `rgba(255, 210, 140, ${0.42 * fade})`;
    ctx.beginPath();
    ctx.moveTo(pS.x, pS.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.stroke();
    ctx.restore();

    if (pS.d < pE.d) {
      bead(pS.x, pS.y, 5.5, "#fff3d6", "rgba(255, 160, 70, 0.5)", fade);
      bead(pE.x, pE.y, 5.5, "#e6faff", "rgba(90, 200, 255, 0.55)", fade);
    } else {
      bead(pE.x, pE.y, 5.5, "#e6faff", "rgba(90, 200, 255, 0.55)", fade);
      bead(pS.x, pS.y, 5.5, "#fff3d6", "rgba(255, 160, 70, 0.5)", fade);
    }

    drawLabels(pE, fade);
    requestAnimationFrame(render);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = view.w + "px";
    canvas.style.height = view.h + "px";
    layer.width = canvas.width;
    layer.height = canvas.height;
    fit();
    dirty = true;
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragLast.x = e.clientX;
    dragLast.y = e.clientY;
    canvas.classList.add("dragging");
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragLast.x;
    const dy = e.clientY - dragLast.y;
    dragLast.x = e.clientX;
    dragLast.y = e.clientY;
    cam.yaw += dx * 0.006;
    cam.pitch = clamp(cam.pitch + dy * 0.004, 0.07, 1.12);
    fit();
    dirty = true;
  });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.classList.remove("dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.0012), 0.45, 4);
    view.scale = view.base * view.zoom;
    dirty = true;
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      paused = !paused;
      e.preventDefault();
    } else if (e.key === "r" || e.key === "R") {
      cam.yaw = 0.62;
      cam.pitch = 0.33;
      view.zoom = 1;
      phase = 0;
      fit();
      dirty = true;
    } else if (e.key === "g" || e.key === "G") {
      showGrid = !showGrid;
      dirty = true;
    }
  });

  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(render);
})();

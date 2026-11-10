(() => {
  const G = window.Geodesic;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");
  const focusEl = document.getElementById("focus");

  const TAU = Math.PI * 2;
  const VIEW_R = 9.2;
  const X_START = 26;
  const B_MAX = 8.1;
  const B_STEP = 0.3;

  const view = { w: 0, h: 0, dpr: 1, base: 25, scale: 25, zoom: 1, ox: 0, oy: 0 };
  const pointer = { x: 0, y: 0, inside: false };
  const dragLast = { x: 0, y: 0 };

  let showGrid = true;
  let showSphere = true;
  let showRefs = false;
  let paused = false;
  let dragging = false;
  let dirty = true;
  let hovered = -1;
  let simTime = 0;
  let lastTime = 0;

  const rays = [];
  const paths = { escaped: new Path2D(), captured: new Path2D(), critical: new Path2D() };
  const refPath = new Path2D();

  function buildRays() {
    const count = Math.round((2 * B_MAX) / B_STEP) + 1;
    for (let i = 0; i < count; i++) {
      const b = -B_MAX + i * B_STEP;
      const ray = G.trace(b, { xStart: X_START, rStop: 70, phiMax: 4 * Math.PI });
      if (!ray) continue;

      const n = ray.points.length / 2;
      const cum = new Float64Array(n);
      for (let k = 1; k < n; k++) {
        cum[k] = cum[k - 1] + Math.hypot(
          ray.points[2 * k] - ray.points[2 * k - 2],
          ray.points[2 * k + 1] - ray.points[2 * k - 1]
        );
      }
      ray.cum = cum;
      ray.length = n > 0 ? cum[n - 1] : 0;
      ray.phase = Math.random();

      const nearCritical = Math.abs(Math.abs(b) - G.B_CRIT) < B_STEP * 1.4;
      ray.kind = nearCritical || ray.fate === "trapped" ? "critical" : ray.fate;

      rays.push(ray);
      const p = paths[ray.kind];
      p.moveTo(ray.points[0], ray.points[1]);
      for (let k = 2; k < ray.points.length; k += 2) p.lineTo(ray.points[k], ray.points[k + 1]);
    }

    for (let i = 0; i < rays.length; i += 4) {
      const b = rays[i].b;
      refPath.moveTo(X_START, b);
      refPath.lineTo(-X_START, b);
    }
  }

  function toScreenX(x) {
    return view.w / 2 + view.ox + x * view.scale;
  }

  function toScreenY(y) {
    return view.h / 2 + view.oy - y * view.scale;
  }

  function updateView() {
    view.scale = view.base * view.zoom;
  }

  function drawGrid() {
    const g = lctx;
    const s = view.scale;
    g.lineWidth = 0.7 / s;
    g.strokeStyle = "rgba(58, 92, 122, 0.16)";
    g.beginPath();
    for (const r of [2, 4, 6, 8, 10, 15, 20, 26]) {
      g.moveTo(r, 0);
      g.arc(0, 0, r, 0, TAU);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      g.moveTo(1.15 * Math.cos(a), 1.15 * Math.sin(a));
      g.lineTo(26 * Math.cos(a), 26 * Math.sin(a));
    }
    g.stroke();
  }

  function drawRefs() {
    const g = lctx;
    const s = view.scale;
    g.save();
    g.setLineDash([3 / s, 7 / s]);
    g.lineWidth = 0.8 / s;
    g.strokeStyle = "rgba(120, 150, 180, 0.18)";
    g.stroke(refPath);
    g.restore();
  }

  function drawRays() {
    const g = lctx;
    const s = view.scale;
    g.lineCap = "round";
    g.lineJoin = "round";

    g.lineWidth = 5 / s;
    g.strokeStyle = "rgba(255, 200, 90, 0.06)";
    g.stroke(paths.critical);

    g.lineWidth = 1.1 / s;
    g.strokeStyle = "rgba(80, 190, 225, 0.30)";
    g.stroke(paths.escaped);
    g.strokeStyle = "rgba(255, 95, 80, 0.22)";
    g.stroke(paths.captured);

    g.lineWidth = 1.4 / s;
    g.strokeStyle = "rgba(255, 200, 90, 0.9)";
    g.stroke(paths.critical);
  }

  function drawBlackHole() {
    const g = lctx;
    const s = view.scale;

    const glow = g.createRadialGradient(0, 0, G.RS, 0, 0, 2.8);
    glow.addColorStop(0, "rgba(255, 140, 70, 0.22)");
    glow.addColorStop(0.35, "rgba(255, 120, 60, 0.07)");
    glow.addColorStop(1, "rgba(255, 120, 60, 0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, 2.8, 0, TAU);
    g.fill();

    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(0, 0, G.RS, 0, TAU);
    g.fill();
    g.lineWidth = 0.8 / s;
    g.strokeStyle = "rgba(255, 150, 90, 0.5)";
    g.stroke();

    if (showSphere) {
      g.save();
      g.setLineDash([4 / s, 5 / s]);
      g.lineWidth = 1 / s;
      g.strokeStyle = "rgba(255, 210, 120, 0.6)";
      g.beginPath();
      g.arc(0, 0, 1.5, 0, TAU);
      g.stroke();
      g.restore();
    }
  }

  function tag(g, text, wx, wy, dx, dy, align) {
    const sx = toScreenX(wx);
    const sy = toScreenY(wy);
    const tx = sx + dx;
    const ty = sy + dy;

    g.strokeStyle = "rgba(130, 145, 165, 0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(tx, ty);
    g.stroke();
    g.fillStyle = "rgba(160, 175, 195, 0.6)";
    g.beginPath();
    g.arc(sx, sy, 1.6, 0, TAU);
    g.fill();

    const pad = 5;
    const tw = g.measureText(text).width;
    const bx = align === "right" ? tx - tw - pad * 2 : tx;
    const by = ty - 9;
    g.fillStyle = "rgba(4, 6, 10, 0.8)";
    g.fillRect(bx, by, tw + pad * 2, 18);
    g.fillStyle = "#8492a4";
    g.textAlign = "left";
    g.fillText(text, bx + pad, ty);
  }

  function drawLabels() {
    const g = lctx;
    const d = view.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textBaseline = "middle";
    tag(g, "horizon  r = r\u209B", -0.94, -0.34, -14, 34, "right");
    tag(g, "photon sphere  r = 1.5 r\u209B", 0.75, 1.3, 18, -28, "left");
  }

  function drawStatic() {
    const d = view.dpr;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.fillStyle = "#04060a";
    lctx.fillRect(0, 0, layer.width, layer.height);

    const s = view.scale * d;
    lctx.setTransform(s, 0, 0, -s, (view.w / 2 + view.ox) * d, (view.h / 2 + view.oy) * d);

    if (showGrid) drawGrid();
    if (showRefs) drawRefs();
    drawRays();
    drawBlackHole();
    drawLabels();
  }

  function pointAt(ray, f) {
    const pts = ray.points;
    const cum = ray.cum;
    const n = cum.length;
    if (n < 2) return null;
    const target = Math.max(0, Math.min(1, f)) * cum[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const prev = cum[i - 1];
    const seg = cum[i] - prev || 1;
    const t = (target - prev) / seg;
    const x0 = pts[2 * (i - 1)];
    const y0 = pts[2 * (i - 1) + 1];
    const x1 = pts[2 * i];
    const y1 = pts[2 * i + 1];
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  }

  function drawDots() {
    const speed = 26;
    for (const ray of rays) {
      if (ray.length <= 0) continue;
      const f = ((simTime * speed) / ray.length + ray.phase) % 1;
      const p = pointAt(ray, f);
      if (!p) continue;
      const a = 0.85 * Math.min(1, f * 14, (1 - f) * 14);
      if (a <= 0.01) continue;
      if (ray.kind === "critical") ctx.fillStyle = `rgba(255, 210, 110, ${a})`;
      else if (ray.kind === "captured") ctx.fillStyle = `rgba(255, 120, 100, ${a})`;
      else ctx.fillStyle = `rgba(130, 215, 240, ${a})`;
      ctx.beginPath();
      ctx.arc(toScreenX(p.x), toScreenY(p.y), 1.5, 0, TAU);
      ctx.fill();
    }
  }

  function drawHighlight(ray) {
    const pts = ray.points;
    ctx.strokeStyle = "rgba(240, 248, 255, 0.95)";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(toScreenX(pts[0]), toScreenY(pts[1]));
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(toScreenX(pts[i]), toScreenY(pts[i + 1]));
    }
    ctx.stroke();
  }

  function drawOverlay() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    const d = view.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    drawDots();
    if (hovered >= 0) drawHighlight(rays[hovered]);
  }

  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    if (i < 0) {
      focusEl.innerHTML = "hover a ray";
      return;
    }
    const ray = rays[i];
    let detail;
    if (ray.fate === "captured") {
      detail = "hits the horizon";
    } else {
      const fate = ray.fate === "trapped" ? "orbits near r = 1.5 r\u209B" : "escapes";
      detail = `periapsis ${ray.minR.toFixed(2)} r<sub>s</sub> &nbsp;\u00b7&nbsp; ${fate}`;
    }
    focusEl.innerHTML = `b = <b>${Math.abs(ray.b).toFixed(2)}</b> r<sub>s</sub>`
      + ` &nbsp;\u00b7&nbsp; ${detail}`;
  }

  function updateHover() {
    if (!pointer.inside || dragging) {
      setHover(-1);
      return;
    }
    const wx = (pointer.x - view.w / 2 - view.ox) / view.scale;
    const wy = (view.h / 2 + view.oy - pointer.y) / view.scale;
    const thr = 10 / view.scale;
    const thr2 = thr * thr;
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < rays.length; k++) {
      const p = rays[k].points;
      for (let i = 0; i < p.length; i += 6) {
        const dx = p[i] - wx;
        const dy = p[i + 1] - wy;
        const dd = dx * dx + dy * dy;
        if (dd < bestD) {
          bestD = dd;
          best = k;
        }
      }
    }
    if (bestD > thr2) best = -1;
    setHover(best);
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
    view.base = (Math.min(view.w, view.h) * 0.42) / VIEW_R;
    updateView();
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
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    if (dragging) {
      view.ox += e.clientX - dragLast.x;
      view.oy += e.clientY - dragLast.y;
      dragLast.x = e.clientX;
      dragLast.y = e.clientY;
      dirty = true;
    } else {
      updateHover();
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.classList.remove("dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    updateHover();
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (!dragging) setHover(-1);
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0012);
    const nz = Math.min(12, Math.max(0.3, view.zoom * k));
    const mx = e.clientX;
    const my = e.clientY;
    const wx = (mx - view.w / 2 - view.ox) / view.scale;
    const wy = (view.h / 2 + view.oy - my) / view.scale;
    view.zoom = nz;
    updateView();
    view.ox = mx - view.w / 2 - wx * view.scale;
    view.oy = my - view.h / 2 + wy * view.scale;
    dirty = true;
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      paused = !paused;
      e.preventDefault();
    } else if (e.key === "r" || e.key === "R") {
      view.zoom = 1;
      view.ox = 0;
      view.oy = 0;
      updateView();
      dirty = true;
    } else if (e.key === "g" || e.key === "G") {
      showGrid = !showGrid;
      dirty = true;
    } else if (e.key === "p" || e.key === "P") {
      showSphere = !showSphere;
      dirty = true;
    } else if (e.key === "d" || e.key === "D") {
      showRefs = !showRefs;
      dirty = true;
    }
  });

  window.addEventListener("resize", resize);

  function frame(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (!paused) simTime += dt;
    if (dirty) {
      drawStatic();
      dirty = false;
    }
    drawOverlay();
    requestAnimationFrame(frame);
  }

  buildRays();
  resize();
  requestAnimationFrame(frame);
})();

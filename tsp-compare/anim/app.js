// Giao diện minh họa: mỗi lần bấm “Bước tiếp” chạy đúng một bước của thuật toán (xem steps.js).
(function () {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const sel = document.getElementById('case');
  const btnStart = document.getElementById('start');
  const btnNext = document.getElementById('next');
  const btnReset = document.getElementById('reset');
  const elTitle = document.getElementById('title');
  const elText = document.getElementById('text');
  const elStats = document.getElementById('stats');

  const LAYER_COLORS = ['#c0392b', '#e67e22', '#27ae60', '#2980b9', '#16a085', '#d35400'];
  const HILL_COLOR = '#8e44ad';

  let cases = window.animCases.CASES;
  let gen = null;
  let state = null;
  let P = null;

  cases.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = c.name;
    sel.appendChild(o);
  });

  // Chuyển tọa độ [0,100] sang canvas, có lề.
  function toCanvas(p) {
    const m = 40, s = (cv.width - 2 * m) / 100;
    return [m + p[0] * s, cv.height - (m + p[1] * s)];
  }

  function drawPoly(idxs, color, width, dash) {
    if (!idxs || idxs.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    idxs.forEach((v, t) => {
      const [x, y] = toCanvas(P[v]);
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawTour(tour, color, width) {
    if (!tour || tour.length < 2) return;
    drawPoly(tour.concat([tour[0]]), color, width);
  }

  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!P) return;
    const s = state || {};

    // phase 1: vẽ các lớp (đường khép kín mờ)
    if (s.layers) {
      s.layers.forEach((L, k) => {
        const col = LAYER_COLORS[Math.min(k, LAYER_COLORS.length - 1)];
        if (s.phase === 1) drawPoly(L.concat([L[0]]), col, 1.5, [6, 4]);
      });
    }

    // cạnh mạng: cạnh vành đai tô màu riêng, cạnh thường màu nhạt
    if (s.edges) {
      const belt = new Set((s.beltEdges || []).map(([a, b]) => Math.min(a, b) + ',' + Math.max(a, b)));
      s.edges.forEach(([a, b]) => {
        const isBelt = belt.has(Math.min(a, b) + ',' + Math.max(a, b));
        const [x1, y1] = toCanvas(P[a]), [x2, y2] = toCanvas(P[b]);
        ctx.save();
        ctx.strokeStyle = isBelt ? '#e67e22' : '#c9c6bd';
        ctx.lineWidth = isBelt ? 4 : 1.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
      });
    }

    // tour hiện tại
    if (s.tour) drawTour(s.tour, '#555', 1.6);

    // chuỗi chừa lại (đỉnh → ... → r_0)
    if (s.spine && s.phase >= 2) drawPoly(s.spine, '#f1c40f', 2.5, [4, 3]);

    // điểm
    P.forEach((p, i) => {
      const [x, y] = toCanvas(p);
      let col = '#999', r = 5, shape = 'dot';
      if (s.layers) {
        const k = s.layers.findIndex(L => L.includes(i));
        if (k >= 0) col = LAYER_COLORS[Math.min(k, LAYER_COLORS.length - 1)];
        else if (s.peak !== i) col = HILL_COLOR;
      }
      if (s.peak === i) { col = '#111'; shape = 'star'; r = 9; }
      if (s.fakes && s.fakes.includes(i)) {
        ctx.save(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
      }
      if (s.reserved && s.reserved.includes(i)) { col = '#f1c40f'; shape = 'square'; r = 8; }
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
      if (shape === 'star') drawStar(x, y, r);
      else if (shape === 'square') { ctx.fillRect(x - r / 2, y - r / 2, r, r); ctx.strokeRect(x - r / 2, y - r / 2, r, r); }
      else { ctx.beginPath(); ctx.arc(x, y, r / 2 + 1, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
    });
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? r : r / 2.2;
      const a = -Math.PI / 2 + k * Math.PI / 5;
      const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function showStep(st) {
    state = st;
    if (st.P) P = st.P;
    elTitle.textContent = `Bước ${st.phase}: ${st.title}`;
    elText.textContent = st.text || '';
    const parts = [];
    if (st.length !== undefined) parts.push(`độ dài: ${st.length.toFixed(2)}`);
    if (st.angle !== undefined) parts.push(`góc tia: ${st.angle}°`);
    if (st.iter !== undefined && st.phase === 5) parts.push(`vòng ILS: ${st.iter}`);
    if (st.accepted !== undefined) parts.push(st.accepted ? 'nhận ứng viên' : 'bỏ ứng viên');
    if (st.fakes && st.phase === 2) parts.push(`đồi giả: ${st.fakes.length}`);
    elStats.textContent = parts.join(' · ');
    draw();
  }

  function start() {
    const c = cases[Number(sel.value)];
    P = c.points;
    gen = c.edges
      ? window.netPipeline.run(P, c.edges, { iters: 150, seed: 1, minBelt: c.minBelt })
      : window.animSteps.animate(P, { iters: 150, seed: 1, minBelt: c.minBelt });
    state = null;
    const r = gen.next();
    if (r.done) { btnNext.disabled = true; return; }
    showStep(r.value);
    btnNext.disabled = false;
  }

  function next() {
    if (!gen) return;
    const r = gen.next();
    if (r.done) { btnNext.disabled = true; return; }
    showStep(r.value);
    if (r.value.phase === 6) btnNext.disabled = true;
  }

  function reset() {
    gen = null; state = null; P = null;
    elTitle.textContent = 'Chọn test case rồi bấm “Bắt đầu”.';
    elText.textContent = ''; elStats.textContent = '';
    btnNext.disabled = true;
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

  btnStart.addEventListener('click', start);
  btnNext.addEventListener('click', next);
  btnReset.addEventListener('click', reset);
  sel.addEventListener('change', reset);
  reset();
})();

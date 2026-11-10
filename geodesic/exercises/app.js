/* app.js — giao diện học: điều hướng, editor, chạy test, gợi ý, minh họa */
(function () {
  'use strict';
  const { EXERCISES: EX } = window.GR_COURSE;
  const runner = window.GR_RUNNER;
  const $ = (id) => document.getElementById(id);

  // ---------- Lưu trữ cục bộ (có thể bị chặn → bỏ qua) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('gr-course:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('gr-course:' + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
  };
  let done = new Set(store.get('done', []));
  let cur = 0, hintsShown = 0, stopAnim = null;
  const libCache = {};
  const getLib = (i) => libCache[i] || (libCache[i] = runner.buildLib(window.GR_COURSE, i));

  // ---------- Editor ----------
  let editor;
  if (window.CodeMirror) {
    const cm = CodeMirror.fromTextArea($('code'), {
      mode: 'javascript', theme: 'material-darker', lineNumbers: true, indentUnit: 2, tabSize: 2,
      matchBrackets: true, lineWrapping: false,
      extraKeys: {
        'Ctrl-Enter': () => run(), 'Cmd-Enter': () => run(),
        Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ')),
      },
    });
    editor = { get: () => cm.getValue(), set: (v) => { cm.setValue(v); cm.clearHistory(); }, refresh: () => cm.refresh() };
  } else {
    const ta = $('code');
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });
    editor = { get: () => ta.value, set: (v) => { ta.value = v; }, refresh() {} };
  }
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });

  // ---------- Điều hướng ----------
  function renderNav() {
    const list = $('list');
    list.innerHTML = '';
    let lastMod = null;
    EX.forEach((ex, i) => {
      if (ex.module !== lastMod) {
        lastMod = ex.module;
        const m = document.createElement('div');
        m.className = 'mod'; m.textContent = ex.module;
        list.appendChild(m);
      }
      const b = document.createElement('button');
      b.className = 'item' + (i === cur ? ' on' : '') + (done.has(ex.id) ? ' done' : '');
      b.innerHTML = '<span class="st">' + (done.has(ex.id) ? '✓' : ex.playground ? '★' : '○') + '</span><span></span>';
      b.lastChild.textContent = (i + 1) + '. ' + ex.title;
      b.onclick = () => go(i);
      list.appendChild(b);
    });
    const total = EX.filter((e) => !e.playground).length;
    const n = EX.filter((e) => !e.playground && done.has(e.id)).length;
    $('progressBar').style.width = (100 * n / total) + '%';
    $('progressText').textContent = n + ' / ' + total + ' bài đã hoàn thành';
  }

  function renderMath(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false,
      });
    }
  }

  function go(i) {
    if (i < 0 || i >= EX.length) return;
    saveCode();
    cur = i;
    const ex = EX[i];
    if (location.hash.slice(1) !== ex.id) history.replaceState(null, '', '#' + ex.id);
    $('crumb').textContent = ex.module;
    $('title').textContent = (i + 1) + '. ' + ex.title;
    $('theory').innerHTML = ex.theory;
    $('task').innerHTML = ex.task;
    renderMath($('theory')); renderMath($('task'));
    hintsShown = 0; $('hints').innerHTML = '';
    $('hint').disabled = !ex.hints.length;
    $('solution').disabled = !ex.solution;
    $('run').textContent = ex.playground ? '▶ Chạy' : '▶ Chạy & kiểm tra';
    $('prev').disabled = i === 0; $('next').disabled = i === EX.length - 1;
    editor.set(store.get('code:' + ex.id, ex.starter));
    $('results').innerHTML = '<div class="muted">' + (ex.playground ? 'Bấm <b>Chạy</b> (Ctrl+Enter).' :
      'Bấm <b>Chạy &amp; kiểm tra</b> (Ctrl+Enter) để chạy ' + ex.tests.length + ' test.') + '</div>';
    $('console').hidden = true;
    clearViz('Chạy code để xem minh họa.');
    renderNav();
    $('theoryPane').scrollTop = 0;
    if (window.innerWidth <= 1280) window.scrollTo(0, 0);
    setTimeout(() => editor.refresh(), 0);
  }

  function saveCode() {
    const ex = EX[cur];
    if (ex) store.set('code:' + ex.id, editor.get());
  }

  // ---------- Chạy ----------
  function makeConsole(lines) {
    const fmt = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v, (k, x) => typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(10) : x); } catch (e) { return String(v); } })();
    const push = (prefix) => (...a) => lines.push(prefix + a.map(fmt).join(' '));
    return { log: push(''), info: push(''), warn: push('⚠ '), error: push('✗ ') };
  }
  function showConsole(lines) {
    const c = $('console');
    c.hidden = !lines.length;
    c.textContent = lines.slice(0, 500).join('\n') + (lines.length > 500 ? '\n… (' + (lines.length - 500) + ' dòng nữa)' : '');
  }

  function run() {
    const ex = EX[cur];
    saveCode();
    const lines = [], con = makeConsole(lines), lib = getLib(cur), code = editor.get();
    if (stopAnim) { stopAnim(); stopAnim = null; }

    if (ex.playground) {
      const plot = makePlot($('viz'));
      try {
        runner.compile(code, [], lib, con, plot);
        $('results').innerHTML = '<div class="summary ok">Đã chạy xong.</div>';
      } catch (e) {
        $('results').innerHTML = '<div class="summary err"></div>';
        $('results').firstChild.textContent = 'Lỗi: ' + e.message;
      }
      showConsole(lines);
      return;
    }

    const res = runner.runTests(ex, code, lib, con);
    const box = $('results');
    box.innerHTML = '';
    if (res.compileError) {
      box.innerHTML = '<div class="summary err"></div>';
      box.firstChild.textContent = 'Lỗi cú pháp / khi chạy: ' + res.compileError;
      showConsole(lines);
      clearViz('Sửa lỗi để xem minh họa.');
      return;
    }
    const passed = res.results.filter((r) => r.pass).length, all = passed === res.results.length;
    const sum = document.createElement('div');
    sum.className = 'summary ' + (all ? 'ok' : 'err');
    sum.textContent = all ? '🎉 Qua hết ' + passed + ' test!' : passed + ' / ' + res.results.length + ' test đạt';
    box.appendChild(sum);
    res.results.forEach((r) => {
      const d = document.createElement('div');
      d.className = 'res ' + (r.pass ? 'pass' : 'fail');
      d.innerHTML = '<span class="ic">' + (r.pass ? '✓' : '✗') + '</span><div><div></div><div class="msg"></div></div>';
      d.querySelector('div > div').textContent = r.name;
      if (!r.pass) d.querySelector('.msg').textContent = r.message;
      box.appendChild(d);
    });
    if (all && !done.has(ex.id)) { done.add(ex.id); store.set('done', [...done]); renderNav(); }

    const complete = ex.exports.every((n) => typeof res.api[n] === 'function');
    if (ex.visualize && complete) {
      try { ex.visualize(makePlot($('viz')), res.api, lib); }
      catch (e) { lines.push('✗ Minh họa lỗi: ' + e.message); clearViz('Minh họa lỗi — xem console.'); }
    } else {
      clearViz(complete ? 'Bài này không có minh họa.' : 'Định nghĩa đủ các hàm để xem minh họa.');
    }
    showConsole(lines);
  }

  // ---------- Gợi ý & lời giải ----------
  $('hint').onclick = () => {
    const ex = EX[cur];
    if (hintsShown >= ex.hints.length) return;
    const d = document.createElement('div');
    d.className = 'hint';
    d.textContent = '💡 ' + ex.hints[hintsShown++];
    $('hints').appendChild(d);
    if (hintsShown >= ex.hints.length) $('hint').disabled = true;
  };
  $('solution').onclick = () => {
    const ex = EX[cur];
    if (!confirm('Xem lời giải tham khảo? Hãy thử thêm một chút nếu bạn còn hứng!')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="hint">Lời giải tham khảo — so sánh với code của bạn:</div><pre></pre>' +
      '<button class="btn">Chép vào editor</button>';
    wrap.querySelector('pre').textContent = ex.solution;
    wrap.querySelector('button').onclick = () => { editor.set(ex.solution); saveCode(); };
    $('hints').appendChild(wrap);
    $('solution').disabled = true;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('resetCode').onclick = () => {
    if (confirm('Xóa code hiện tại và khôi phục code khởi đầu?')) { editor.set(EX[cur].starter); saveCode(); }
  };
  $('run').onclick = run;
  $('prev').onclick = () => go(cur - 1);
  $('next').onclick = () => go(cur + 1);
  window.addEventListener('beforeunload', saveCode);
  window.addEventListener('hashchange', () => {
    const i = EX.findIndex((e) => e.id === location.hash.slice(1));
    if (i >= 0 && i !== cur) go(i);
  });

  // ---------- Bộ vẽ ----------
  const COLORS = { a: '#4fd1ff', muted: '#7d8aa5', warn: '#ffb44d', text: '#dfe7f5', grid: '#273555' };
  const PALETTE = ['#4fd1ff', '#ff7a90', '#5be3a1', '#ffd166', '#b392ff', '#ff9f43'];

  function sizeCanvas(c) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function clearViz(msg) {
    if (stopAnim) { stopAnim(); stopAnim = null; }
    const { ctx, w, h } = sizeCanvas($('viz'));
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.muted; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(msg, w / 2, h / 2);
  }
  function niceStep(span) {
    const raw = span / 6, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  function makePlot(canvas) {
    const { ctx, w, h } = sizeCanvas(canvas);
    const pad = { l: 46, r: 14, t: 14, b: 32 };
    let X = (x) => x, Y = (y) => y, S = 1;

    const plot = {
      ctx, w, h, colors: COLORS, palette: PALETTE,
      frame(o = {}) {
        ctx.clearRect(0, 0, w, h);
        let [x0, x1] = o.xr || [0, 1], [y0, y1] = o.yr || [0, 1];
        const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
        if (o.equal) {
          const sx = pw / (x1 - x0), sy = ph / (y1 - y0);
          if (sx > sy) { const c = (x0 + x1) / 2, half = pw / sy / 2; x0 = c - half; x1 = c + half; }
          else { const c = (y0 + y1) / 2, half = ph / sx / 2; y0 = c - half; y1 = c + half; }
        }
        X = (x) => pad.l + (x - x0) / (x1 - x0) * pw;
        Y = (y) => pad.t + (1 - (y - y0) / (y1 - y0)) * ph;
        S = pw / (x1 - x0);
        if (o.axes === false) return plot;
        ctx.font = '11px system-ui'; ctx.lineWidth = 1;
        const tick = (a, b) => { const st = niceStep(b - a); const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9 * st; v += st) out.push(+v.toPrecision(12)); return out; };
        ctx.strokeStyle = '#18223a'; ctx.fillStyle = COLORS.muted;
        if (o.xticks !== false) tick(x0, x1).forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), h - pad.b); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(String(v), X(v), h - pad.b + 14); });
        tick(y0, y1).forEach((v) => { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(v), pad.l - 6, Y(v) + 4); });
        ctx.strokeStyle = COLORS.grid; ctx.strokeRect(pad.l, pad.t, pw, ph);
        ctx.textAlign = 'right'; if (o.xl) ctx.fillText(o.xl, w - pad.r, h - 4);
        ctx.textAlign = 'left'; if (o.yl) ctx.fillText(o.yl, 4, 11);
        return plot;
      },
      line(pts, color = COLORS.a, o = {}) {
        if (!pts || pts.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = o.width || 1.8; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
        ctx.setLineDash(o.dash || []); ctx.lineJoin = 'round';
        ctx.beginPath();
        let pen = false;
        pts.forEach(([x, y]) => {
          if (!isFinite(x) || !isFinite(y)) { pen = false; return; }
          pen ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); pen = true;
        });
        ctx.stroke(); ctx.restore();
      },
      dot(x, y, color = COLORS.a, r = 3) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 7); ctx.fill(); },
      circle(x, y, r, color = COLORS.grid) { ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(X(x), Y(y), Math.abs(r * S), 0, 7); ctx.stroke(); },
      rect(x, y, wd, ht, color) { ctx.fillStyle = color; const a = Y(y), b = Y(y + ht); ctx.fillRect(X(x), Math.min(a, b), wd * S, Math.abs(b - a)); },
      text(s, x, y, o = {}) { ctx.fillStyle = o.color || COLORS.text; ctx.font = (o.size || 12) + 'px system-ui'; ctx.textAlign = 'left'; ctx.fillText(s, X(x), Y(y)); },
      sun(x, y) {
        const g = ctx.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), 18);
        g.addColorStop(0, 'rgba(255,215,110,.9)'); g.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(y), 18, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffcc4d'; ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 7); ctx.fill();
      },
      legend(items) {
        ctx.font = '12px system-ui'; ctx.textAlign = 'left';
        const wMax = Math.max(...items.map(([s]) => ctx.measureText(s).width)) + 30;
        const x = w - pad.r - wMax - 6, y = pad.t + 6;
        ctx.fillStyle = 'rgba(8,11,20,.82)'; ctx.fillRect(x, y, wMax + 4, items.length * 18 + 8);
        items.forEach(([s, c], i) => { ctx.fillStyle = c; ctx.fillRect(x + 8, y + 10 + i * 18, 12, 4); ctx.fillStyle = COLORS.text; ctx.fillText(s, x + 26, y + 16 + i * 18); });
      },
      animate(fn) {
        let alive = true, id;
        const tick = () => { if (!alive) return; try { fn(); } catch (e) { alive = false; showConsole(['✗ Minh họa lỗi: ' + e.message]); return; } id = requestAnimationFrame(tick); };
        if (stopAnim) stopAnim();
        stopAnim = () => { alive = false; cancelAnimationFrame(id); };
        id = requestAnimationFrame(tick);
      },
    };
    return plot;
  }

  // ---------- Khởi động ----------
  const start = EX.findIndex((e) => e.id === location.hash.slice(1));
  cur = -1;
  go(start >= 0 ? start : Math.max(0, EX.findIndex((e) => !done.has(e.id))));
})();

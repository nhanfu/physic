/*
 * runner.js — Biên dịch code người học, dựng `lib`, chạy test.
 * Dùng chung cho trình duyệt (app.js) và Node (tools/verify.js).
 */
(function (root) {
  'use strict';

  // Chạy code trong một hàm riêng; chỉ `lib`, `console` (và `plot` ở sân chơi) được truyền vào.
  function compile(code, exportNames, lib, consoleObj, plot) {
    const ret = exportNames.map((n) => JSON.stringify(n) + ': typeof ' + n + " !== 'undefined' ? " + n + ' : undefined').join(', ');
    const fn = new Function('lib', 'console', 'plot', '"use strict";\n' + code + '\n;return { ' + ret + ' };');
    return fn(lib, consoleObj, plot);
  }

  // lib cho bài thứ `index` = BASE_LIB + lời giải tham khảo của mọi bài trước đó
  function buildLib(course, index) {
    const lib = Object.assign({}, course.BASE_LIB);
    const quiet = { log() {}, warn() {}, error() {} };
    for (let i = 0; i < index; i++) {
      const ex = course.EXERCISES[i];
      if (!ex.solution) continue;
      Object.assign(lib, compile(ex.solution, ex.exports, lib, quiet));
    }
    return lib;
  }

  function fmt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : Math.abs(v) < 1e-3 || Math.abs(v) > 1e6 ? v.toExponential(6) : v.toPrecision(10);
    if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
    return String(v);
  }

  const t = {
    ok(cond, msg) { if (!cond) throw new Error(msg); },
    equal(a, b, label) { if (a !== b) throw new Error(label + ': mong đợi ' + fmt(b) + ', nhận ' + fmt(a)); },
    close(a, b, tol, label) {
      if (typeof a !== 'number' || Number.isNaN(a) || !(Math.abs(a - b) <= tol)) {
        throw new Error(label + ': mong đợi ' + fmt(b) + ' ± ' + fmt(tol) + ', nhận ' + fmt(a));
      }
    },
    arrClose(a, b, tol, label) {
      if (!a || typeof a.length !== 'number' || a.length !== b.length) throw new Error(label + ': mong đợi mảng ' + b.length + ' phần tử, nhận ' + fmt(a));
      for (let i = 0; i < b.length; i++) t.close(a[i], b[i], tol, label + '[' + i + ']');
    },
  };

  // Trả về { compileError, results: [{ name, pass, message, ms }] }
  function runTests(ex, code, lib, consoleObj) {
    let api;
    try {
      api = compile(code, ex.exports, lib, consoleObj);
    } catch (e) {
      return { compileError: (e && e.name ? e.name + ': ' : '') + (e && e.message), results: [] };
    }
    const missing = ex.exports.filter((n) => typeof api[n] !== 'function');
    const results = ex.tests.map((test) => {
      const t0 = Date.now();
      try {
        if (missing.length) throw new Error('Chưa định nghĩa: ' + missing.join(', '));
        test.run(api, lib, t);
        return { name: test.name, pass: true, ms: Date.now() - t0 };
      } catch (e) {
        return { name: test.name, pass: false, message: (e && e.message) || String(e), ms: Date.now() - t0 };
      }
    });
    return { api, results };
  }

  const api = { compile, buildLib, runTests };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GR_RUNNER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Orbit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const C = 299792.458;
  const GM = 1.32712440018e11;
  const AU = 1.495978707e8;
  const MU = GM / (C * C * AU);
  const RS = 2 * MU;
  const ECC = 0.0167086;

  function build(opts) {
    opts = opts || {};
    const e = opts.e == null ? ECC : opts.e;
    const mu = opts.mu == null ? MU : opts.mu;
    const rs = opts.rs == null ? 2 * mu : opts.rs;
    const turns = opts.turns == null ? 3 : opts.turns;
    const h0 = opts.h == null ? 0.004 : opts.h;

    const L = Math.sqrt(mu * (1 - e * e));
    const n = Math.max(64, Math.round((turns * 2 * Math.PI) / h0));
    const h = (turns * 2 * Math.PI) / n;

    let u = 1 / (1 - e);
    let w = 0;
    let phi = 0;
    let t = 0;
    const E = Math.sqrt((1 - rs * u) * (1 + L * L * u * u));

    const ax = new Float64Array(n + 1);
    const ay = new Float64Array(n + 1);
    const at = new Float64Array(n + 1);
    const au = new Float64Array(n + 1);

    const acc = (u) => mu / (L * L) + 1.5 * rs * u * u - u;
    const dt = (u) => E / (L * u * u * (1 - rs * u));

    for (let i = 0; i <= n; i++) {
      const r = 1 / u;
      ax[i] = r * Math.cos(phi);
      ay[i] = r * Math.sin(phi);
      at[i] = t;
      au[i] = u;
      if (i === n) break;

      const k1u = w;
      const k1w = acc(u);
      const k1t = dt(u);
      const k2u = w + 0.5 * h * k1w;
      const k2w = acc(u + 0.5 * h * k1u);
      const k2t = dt(u + 0.5 * h * k1u);
      const k3u = w + 0.5 * h * k2w;
      const k3w = acc(u + 0.5 * h * k2u);
      const k3t = dt(u + 0.5 * h * k2u);
      const k4u = w + h * k3w;
      const k4w = acc(u + h * k3u);
      const k4t = dt(u + h * k3u);

      u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
      w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      t += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      phi += h;
    }

    const precession = (3 * Math.PI * rs) / (1 - e * e);
    return {
      x: ax,
      y: ay,
      t: at,
      u: au,
      n: n + 1,
      turns: turns,
      e: e,
      mu: mu,
      rs: rs,
      L: L,
      E: E,
      tTotal: at[n],
      precession: precession,
      precessionArcsecPerCentury: precession * 206264.806 * 100
    };
  }

  return { C: C, GM: GM, AU: AU, MU: MU, RS: RS, ECC: ECC, build: build };
});

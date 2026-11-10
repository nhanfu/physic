(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Geodesic = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const RS = 1;
  const M = RS / 2;
  const B_CRIT = 3 * Math.sqrt(3) * M;

  function accel(u) {
    return 1.5 * RS * u * u - u;
  }

  function trace(b, opts) {
    opts = opts || {};
    const xStart = opts.xStart == null ? 26 : opts.xStart;
    const rStop = opts.rStop == null ? 70 : opts.rStop;
    const phiMax = opts.phiMax == null ? 4 * Math.PI : opts.phiMax;
    const maxSteps = opts.maxSteps == null ? 40000 : opts.maxSteps;

    const side = b < 0 ? -1 : 1;
    const ba = Math.abs(b);
    if (ba < 1e-6) return null;
    const r0 = Math.hypot(xStart, ba);
    const phi0 = Math.atan2(ba, xStart);
    const u0 = 1 / r0;
    const w2 = 1 / (ba * ba) - u0 * u0 * (1 - RS * u0);
    if (!(w2 > 0)) return null;

    let u = u0;
    let w = Math.sqrt(w2);
    let phi = phi0;
    let minR = r0;
    let fate = "trapped";

    const pts = [];
    function push() {
      const r = 1 / u;
      pts.push(r * Math.cos(phi), side * r * Math.sin(phi));
    }

    push();

    for (let i = 0; i < maxSteps; i++) {
      const h = Math.min(0.015, 0.02 / (1 + 25 * u * u));

      const k1u = w;
      const k1w = accel(u);
      const k2u = w + 0.5 * h * k1w;
      const k2w = accel(u + 0.5 * h * k1u);
      const k3u = w + 0.5 * h * k2w;
      const k3w = accel(u + 0.5 * h * k2u);
      const k4u = w + h * k3w;
      const k4w = accel(u + h * k3u);

      u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
      w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      phi += h;

      if (u >= 1 / RS) {
        u = 1 / RS;
        minR = Math.min(minR, RS);
        push();
        fate = "captured";
        break;
      }
      if (u <= 0) {
        fate = "escaped";
        break;
      }
      if (u < 1 / rStop && w < 0) {
        minR = Math.min(minR, 1 / u);
        push();
        fate = "escaped";
        break;
      }
      if (phi - phi0 > phiMax) {
        minR = Math.min(minR, 1 / u);
        push();
        fate = "trapped";
        break;
      }

      minR = Math.min(minR, 1 / u);
      push();
    }

    let length = 0;
    for (let i = 2; i < pts.length; i += 2) {
      length += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    }

    return { b: b, fate: fate, minR: minR, points: pts, length: length };
  }

  return { RS: RS, M: M, B_CRIT: B_CRIT, accel: accel, trace: trace };
});

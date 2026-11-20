// Image processing on RGBA arrays (Uint8ClampedArray). No DOM, checked in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ImgLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // "#rrggbb" or "rgb(r, g, b)" / "rgba(...)" -> [r, g, b], otherwise null
  function parseCssColor(s) {
    if (typeof s !== "string") return null;
    const t = s.trim();
    let m = t.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = t.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
    if (m) {
      const a = [Number(m[1]), Number(m[2]), Number(m[3])];
      return a.every((v) => v <= 255) ? a : null;
    }
    return null;
  }

  // Brightness and contrast, both -100..100. Modifies data in place.
  function adjust(data, brightness, contrast) {
    const b = brightness * 2.55;
    const c = contrast * 2.55;
    const f = (259 * (c + 255)) / (255 * (259 - c));
    for (let i = 0; i < data.length; i += 4) {
      for (let k = 0; k < 3; k++) data[i + k] = clamp255(f * (data[i + k] - 128) + 128 + b);
    }
  }

  function grayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.round(lum(data[i], data[i + 1], data[i + 2]));
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  // Xerox: everything darker than the threshold becomes dark, the rest light.
  function threshold(data, t, dark, light) {
    for (let i = 0; i < data.length; i += 4) {
      const c = lum(data[i], data[i + 1], data[i + 2]) < t ? dark : light;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  }

  // Duotone: brightness 0..255 blends from dark to light.
  function duotone(data, dark, light) {
    for (let i = 0; i < data.length; i += 4) {
      const k = lum(data[i], data[i + 1], data[i + 2]) / 255;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(dark[c] + (light[c] - dark[c]) * k);
    }
  }

  // Dot radius so that the ink coverage fraction equals f (0..1).
  // Up to pi/4 the dots do not touch; beyond that they grow until they cover the cell completely.
  function dotRadius(cell, f) {
    if (f <= 0) return 0;
    const t = Math.PI / 4;
    if (f <= t) return cell * Math.sqrt(f / Math.PI);
    return cell * (0.5 + (Math.SQRT1_2 - 0.5) * (Math.min(f, 1) - t) / (1 - t));
  }

  // Halftone: a dot grid at angle (degrees). Returns a new RGBA array (alpha 255).
  function halftone(src, w, h, cell, angle, dark, light) {
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < src.length; i += 4, p++) gray[p] = lum(src[i], src[i + 1], src[i + 2]);

    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const cache = new Map();

    function cellCoverage(ci, cj) {
      const key = ci + "," + cj;
      let f = cache.get(key);
      if (f !== undefined) return f;
      const cu = (ci + 0.5) * cell, cv = (cj + 0.5) * cell;
      const cx = cu * cos - cv * sin;
      const cy = cu * sin + cv * cos;
      const half = cell / 2;
      const x0 = Math.min(w - 1, Math.max(0, Math.floor(cx - half)));
      const x1 = Math.min(w - 1, Math.max(0, Math.ceil(cx + half)));
      const y0 = Math.min(h - 1, Math.max(0, Math.floor(cy - half)));
      const y1 = Math.min(h - 1, Math.max(0, Math.ceil(cy + half)));
      let sum = 0, n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { sum += gray[y * w + x]; n++; }
      f = 1 - sum / n / 255;
      cache.set(key, f);
      return f;
    }

    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x * cos + y * sin;
        const v = -x * sin + y * cos;
        const ci = Math.floor(u / cell), cj = Math.floor(v / cell);
        const r = dotRadius(cell, cellCoverage(ci, cj));
        const du = u - (ci + 0.5) * cell, dv = v - (cj + 0.5) * cell;
        const c = du * du + dv * dv <= r * r ? dark : light;
        const o = (y * w + x) * 4;
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
      }
    }
    return out;
  }

  return { parseCssColor, adjust, grayscale, threshold, duotone, dotRadius, halftone };
});

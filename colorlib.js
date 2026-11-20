// Color math and palette extraction. No DOM, checked in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ColorLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)));

  // "#rgb", "#rrggbb", "rgb(r, g, b)", "hsl(h, s%, l%)" -> [r, g, b] or null
  function parseColor(input) {
    if (typeof input !== "string") return null;
    const s = input.trim().toLowerCase();
    let m = s.match(/^#([0-9a-f]{3})$/);
    if (m) return m[1].split("").map((c) => parseInt(c + c, 16));
    m = s.match(/^#([0-9a-f]{6})$/);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
    m = s.match(/^rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)$/);
    if (m) {
      const v = [m[1], m[2], m[3]].map(Number);
      return v.every((n) => n <= 255) ? v : null;
    }
    m = s.match(/^hsl\(\s*(-?\d+(?:\.\d+)?)(?:deg)?\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%\s*\)$/);
    if (m) {
      const h = Number(m[1]), sat = Number(m[2]), l = Number(m[3]);
      return sat <= 100 && l <= 100 ? hslToRgb(h, sat, l) : null;
    }
    return null;
  }

  function toHex(rgb) {
    return "#" + rgb.map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
  }

  // h in degrees, s and l in percent
  function rgbToHsl(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0, s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map((v) => clamp255((v + m) * 255));
  }

  // WCAG 2.x relative luminance
  function luminance(rgb) {
    const lin = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // AA: 4.5 normal text, 3 large text. AAA: 7 and 4.5.
  function wcag(ratio) {
    return { aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5 };
  }

  // Median cut on an RGBA array: [{ rgb, share }] sorted by share, shares sum to 1. Transparent pixels are skipped.
  function medianCut(data, k) {
    const px = [];
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] >= 128) px.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (!px.length || !(k >= 1)) return [];
    let boxes = [px];
    while (boxes.length < k) {
      let best = -1, bestRange = 0, bestCh = 0;
      boxes.forEach((box, bi) => {
        if (box.length < 2) return;
        for (let ch = 0; ch < 3; ch++) {
          let lo = 255, hi = 0;
          for (const p of box) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
          if (hi - lo > bestRange) { bestRange = hi - lo; best = bi; bestCh = ch; }
        }
      });
      if (best < 0) break; // every box is a single color
      const box = boxes[best].slice().sort((p, q) => p[bestCh] - q[bestCh]);
      // split where the channel value changes, as close to the median as possible, so identical colors never end up in both halves
      let cut = -1;
      for (let i = 1; i < box.length; i++) {
        if (box[i][bestCh] !== box[i - 1][bestCh] && (cut < 0 || Math.abs(i - box.length / 2) < Math.abs(cut - box.length / 2))) cut = i;
      }
      boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
    }
    const total = px.length;
    return boxes.map((box) => {
      const sum = [0, 0, 0];
      for (const p of box) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
      return { rgb: sum.map((v) => clamp255(v / box.length)), share: box.length / total };
    }).sort((a, b) => b.share - a.share);
  }

  return { parseColor, toHex, rgbToHsl, hslToRgb, luminance, contrast, wcag, medianCut };
});

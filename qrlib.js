// QR code matrix and SVG output on top of the vendored qrcode-generator 2.0.4 (MIT). No DOM, checked in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./vendor/qrcode-generator-2.0.4.js"));
  else root.QrLib = factory(root.qrcode);
})(typeof self !== "undefined" ? self : this, function (qrcode) {
  "use strict";

  const LEVELS = ["L", "M", "Q", "H"];
  if (qrcode && qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"]; // non-ASCII text as UTF-8

  // -> { ok: true, size, modules: boolean[][] } or { ok: false, error }
  function matrix(text, level) {
    if (!qrcode) return { ok: false, error: "The QR library did not load." };
    if (typeof text !== "string" || !text) return { ok: false, error: "Type some text first." };
    if (LEVELS.indexOf(level) < 0) return { ok: false, error: "Unknown error correction level." };
    try {
      const qr = qrcode(0, level); // type number 0 = smallest version that fits
      qr.addData(text);
      qr.make();
      const size = qr.getModuleCount();
      const modules = [];
      for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) row.push(qr.isDark(r, c));
        modules.push(row);
      }
      return { ok: true, size, modules };
    } catch (e) {
      return { ok: false, error: "Too much text for a QR code at this error correction level." };
    }
  }

  // One <path> with a square per dark module, quiet zone of `margin` modules around it.
  function toSvg(m, margin, fg, bg) {
    const n = m.size + margin * 2;
    let d = "";
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        if (m.modules[r][c]) d += "M" + (c + margin) + " " + (r + margin) + "h1v1h-1z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges">' +
      '<rect width="' + n + '" height="' + n + '" fill="' + bg + '"/><path d="' + d + '" fill="' + fg + '"/></svg>';
  }

  return { LEVELS, matrix, toSvg };
});

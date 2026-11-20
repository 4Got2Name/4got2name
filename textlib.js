// Encodings and the password generator. No DOM, checked in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TextLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ok = (value) => ({ ok: true, value });
  const fail = (error) => ({ ok: false, error });

  function bytesToBinary(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return s;
  }

  function utf8Decode(bytes) {
    try { return ok(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (e) { return fail("That is not valid UTF-8 text."); }
  }

  function base64EncodeUtf8(str) {
    return btoa(bytesToBinary(new TextEncoder().encode(str)));
  }

  // Accepts standard and URL-safe base64, with or without padding.
  function base64DecodeUtf8(input) {
    const clean = String(input).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return fail("That is not base64.");
    let bin;
    try { bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4)); }
    catch (e) { return fail("That is not base64."); }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return utf8Decode(bytes);
  }

  function hexOf(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
    return s;
  }

  function hexEncodeUtf8(str) { return hexOf(new TextEncoder().encode(str)); }

  function hexDecodeUtf8(input) {
    const clean = String(input).replace(/\s+/g, "").replace(/^0x/i, "");
    if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) return fail("That is not hex (an even number of characters 0-9, a-f).");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return utf8Decode(bytes);
  }

  function urlEncode(str) { return encodeURIComponent(str); }
  function urlDecode(str) {
    try { return ok(decodeURIComponent(str)); } catch (e) { return fail("Invalid %XX sequence."); }
  }

  // Uniform character choice without modulo bias: bytes that do not fit evenly into the charset are discarded.
  function randomString(len, charset, randomBytes) {
    const n = charset.length;
    if (!Number.isInteger(len) || len < 1 || n < 1 || n > 256) throw new RangeError("Invalid parameters");
    const limit = 256 - (256 % n);
    let out = "";
    while (out.length < len) {
      const bytes = randomBytes(Math.max(16, (len - out.length) * 2));
      for (let i = 0; i < bytes.length && out.length < len; i++) {
        if (bytes[i] < limit) out += charset[bytes[i] % n];
      }
    }
    return out;
  }


  // Pretty-print or minify JSON. opts: { minify, indent (number of spaces or "\t"), sortKeys }.
  // Numbers are parsed as JS doubles, so integers beyond 2^53 lose precision.
  function jsonFormat(text, opts) {
    const o = opts || {};
    if (typeof text !== "string" || !text.trim()) return fail("Paste some JSON first.");
    let value;
    try { value = JSON.parse(text); }
    catch (e) { return fail(String(e.message || "Invalid JSON.")); }
    if (o.sortKeys) value = sortKeysDeep(value);
    return ok(o.minify ? JSON.stringify(value) : JSON.stringify(value, null, o.indent === "\t" ? "\t" : (Number.isInteger(o.indent) && o.indent > 0 && o.indent <= 8 ? o.indent : 2)));
  }

  function sortKeysDeep(v) {
    if (Array.isArray(v)) return v.map(sortKeysDeep);
    if (v && typeof v === "object") {
      const out = {};
      Object.keys(v).sort().forEach((k) => { out[k] = sortKeysDeep(v[k]); });
      return out;
    }
    return v;
  }

  return { jsonFormat, base64EncodeUtf8, base64DecodeUtf8, hexOf, hexEncodeUtf8, hexDecodeUtf8,
    urlEncode, urlDecode, randomString };
});

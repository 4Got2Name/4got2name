(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const INK = "#0d0d0d";
  const PAPER = "#efe6cf";

  async function copyText(text, note) {
    try { await navigator.clipboard.writeText(text); note("Copied."); }
    catch (e) { note("The browser blocked copying. Select the text manually."); }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const bytesOf = (s) => new TextEncoder().encode(s).length;
  const charsOf = (s) => Array.from(s).length;
  const frame = (fn) => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); }; };

  /* ---------- tabs ---------- */
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panes = Array.from(document.querySelectorAll("[data-pane]"));
  function showTab(id, remember) {
    if (!panes.some((p) => p.dataset.pane === id)) id = "enc";
    panes.forEach((p) => { p.hidden = p.dataset.pane !== id; });
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.tab === id)));
    if (remember) { try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// or sandbox */ } }
  }
  tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab, true)));
  showTab(location.hash.slice(1), false);

  /* ---------- encoder ---------- */
  const encIn = $("#enc-in");
  const encOut = $("#enc-out");
  const encNote = $("#enc-note");
  let fmt = "b64", dir = "enc", encResult = null;
  const FMT_NAME = { b64: "Base64", hex: "Hex", url: "URL" };
  const ok = (value) => ({ ok: true, value });
  const CODECS = {
    b64: { enc: (s) => ok(TextLib.base64EncodeUtf8(s)), dec: TextLib.base64DecodeUtf8 },
    hex: { enc: (s) => ok(TextLib.hexEncodeUtf8(s)), dec: TextLib.hexDecodeUtf8 },
    url: { enc: (s) => ok(TextLib.urlEncode(s)), dec: TextLib.urlDecode }
  };

  function runEncoder() {
    const s = encIn.value;
    $("#enc-in-n").textContent = charsOf(s) + " chars · " + bytesOf(s) + " bytes";
    $("#enc-out-h").textContent = "Result: " + FMT_NAME[fmt] + (dir === "enc" ? " encoded" : " decoded");
    encResult = null;
    if (!s) { encOut.className = "out"; encOut.textContent = ""; $("#enc-out-n").textContent = ""; encNote.textContent = ""; return; }
    const r = CODECS[fmt][dir](s);
    if (!r.ok) {
      encOut.className = "out err";
      encOut.textContent = r.error;
      $("#enc-out-n").textContent = "";
      encNote.textContent = r.error;
      return;
    }
    encResult = r.value;
    encOut.className = "out";
    encOut.textContent = r.value;
    $("#enc-out-n").textContent = charsOf(r.value) + " chars · " + bytesOf(r.value) + " bytes";
    encNote.textContent = "";
  }
  function setPressed(sel, attr, value) {
    document.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
  }
  document.querySelectorAll("[data-fmt]").forEach((b) => b.addEventListener("click", () => { fmt = b.dataset.fmt; setPressed("[data-fmt]", "fmt", fmt); runEncoder(); }));
  document.querySelectorAll("[data-dir]").forEach((b) => b.addEventListener("click", () => { dir = b.dataset.dir; setPressed("[data-dir]", "dir", dir); runEncoder(); }));
  encIn.addEventListener("input", runEncoder);
  $("#enc-swap").addEventListener("click", () => {
    if (encResult !== null) encIn.value = encResult;
    dir = dir === "enc" ? "dec" : "enc";
    setPressed("[data-dir]", "dir", dir);
    runEncoder();
  });
  $("#enc-clear").addEventListener("click", () => { encIn.value = ""; runEncoder(); encIn.focus(); });
  $("#enc-copy").addEventListener("click", () => { if (encResult) copyText(encResult, (t) => { encNote.textContent = t; }); });
  runEncoder();

  /* ---------- QR code ---------- */
  const qrIn = $("#qr-in");
  const qrPrev = $("#qr-preview");
  const qrNote = $("#qr-note");
  let qrMatrix = null;
  const runQr = frame(() => {
    const text = qrIn.value;
    qrMatrix = null;
    $("#qr-svg").disabled = true;
    $("#qr-png").disabled = true;
    if (!text) { Site.unset(qrPrev, "The code appears here."); qrNote.textContent = ""; return; }
    const m = QrLib.matrix(text, $("#qr-ecc").value);
    if (!m.ok) { Site.unset(qrPrev, m.error); qrNote.textContent = m.error; return; }
    qrMatrix = m;
    qrPrev.innerHTML = QrLib.toSvg(m, 4, INK, PAPER); // built from numbers and fixed colors only
    const svg = qrPrev.querySelector("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code for the text you entered");
    qrNote.textContent = m.size + "×" + m.size + " modules. Test-scan it before you print it.";
    $("#qr-svg").disabled = false;
    $("#qr-png").disabled = false;
  });
  qrIn.addEventListener("input", runQr);
  $("#qr-ecc").addEventListener("change", runQr);
  $("#qr-svg").addEventListener("click", () => {
    if (qrMatrix) download(new Blob([QrLib.toSvg(qrMatrix, 4, INK, PAPER)], { type: "image/svg+xml" }), "4got2name-qr.svg");
  });
  $("#qr-png").addEventListener("click", () => {
    if (!qrMatrix) return;
    const margin = 4, n = qrMatrix.size + margin * 2, scale = Math.max(4, Math.floor(1024 / n));
    const c = document.createElement("canvas");
    c.width = c.height = n * scale;
    const ctx = c.getContext("2d");
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = INK;
    for (let r = 0; r < qrMatrix.size; r++) for (let col = 0; col < qrMatrix.size; col++) {
      if (qrMatrix.modules[r][col]) ctx.fillRect((col + margin) * scale, (r + margin) * scale, scale, scale);
    }
    c.toBlob((b) => { if (b) download(b, "4got2name-qr.png"); }, "image/png");
  });

  /* ---------- colors ---------- */
  const colIn = $("#col-in");
  const colPick = $("#col-pick");
  const colOut = $("#col-out");
  function valueRow(label) {
    const row = document.createElement("div");
    row.className = "value-row";
    const b = document.createElement("b");
    b.textContent = label;
    const code = document.createElement("code");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy " + label);
    btn.addEventListener("click", () => copyText(code.textContent, (t) => { btn.textContent = t; setTimeout(() => { btn.textContent = "Copy"; }, 1200); }));
    row.append(b, code, btn);
    colOut.append(row);
    return code;
  }
  const rows = { hex: valueRow("HEX"), rgb: valueRow("RGB"), hsl: valueRow("HSL") };
  function runColor() {
    const rgb = ColorLib.parseColor(colIn.value);
    if (!rgb) {
      Object.values(rows).forEach((c) => { c.textContent = "-"; });
      rows.hex.textContent = "Not a color I can read. Try #d9a23a, rgb(217, 162, 58) or hsl(39, 68%, 54%).";
      return;
    }
    const hsl = ColorLib.rgbToHsl(rgb);
    rows.hex.textContent = ColorLib.toHex(rgb);
    rows.rgb.textContent = "rgb(" + rgb.join(", ") + ")";
    rows.hsl.textContent = "hsl(" + hsl[0] + ", " + hsl[1] + "%, " + hsl[2] + "%)";
    colPick.value = ColorLib.toHex(rgb);
  }
  colIn.addEventListener("input", runColor);
  colPick.addEventListener("input", () => { colIn.value = colPick.value; runColor(); });
  runColor();

  const fgIn = $("#fg-in"), bgIn = $("#bg-in"), fgPick = $("#fg-pick"), bgPick = $("#bg-pick");
  function badge(label, pass) {
    const s = document.createElement("span");
    s.className = "badge " + (pass ? "pass" : "fail");
    s.textContent = label + ": " + (pass ? "pass" : "fail");
    return s;
  }
  function runContrast() {
    const fg = ColorLib.parseColor(fgIn.value), bg = ColorLib.parseColor(bgIn.value);
    const out = $("#ct-result");
    if (!fg || !bg) { out.replaceChildren(Object.assign(document.createElement("p"), { className: "unset", textContent: "Enter two valid colors (#hex, rgb() or hsl())." })); return; }
    fgPick.value = ColorLib.toHex(fg);
    bgPick.value = ColorLib.toHex(bg);
    const sample = $("#ct-sample");
    sample.style.color = ColorLib.toHex(fg);
    sample.style.background = ColorLib.toHex(bg);
    const ratio = ColorLib.contrast(fg, bg);
    const w = ColorLib.wcag(ratio);
    const big = document.createElement("p");
    big.className = "ratio";
    big.textContent = (Math.floor(ratio * 100) / 100).toFixed(2) + ":1"; // truncated, not rounded up, so a near miss is never shown as a pass
    const list = document.createElement("div");
    list.className = "badges";
    list.append(badge("AA normal text", w.aaNormal), badge("AA large text", w.aaLarge), badge("AAA normal text", w.aaaNormal), badge("AAA large text", w.aaaLarge));
    out.replaceChildren(big, list);
  }
  fgIn.addEventListener("input", runContrast);
  bgIn.addEventListener("input", runContrast);
  fgPick.addEventListener("input", () => { fgIn.value = fgPick.value; runContrast(); });
  bgPick.addEventListener("input", () => { bgIn.value = bgPick.value; runContrast(); });
  $("#ct-swap").addEventListener("click", () => { const t = fgIn.value; fgIn.value = bgIn.value; bgIn.value = t; runContrast(); });
  runContrast();

  /* ---------- JSON ---------- */
  const jsonIn = $("#json-in");
  const jsonOut = $("#json-out");
  const jsonNote = $("#json-note");
  let jsonResult = null;
  function jsonOpts(minify) {
    const v = $("#json-indent").value;
    return { minify, indent: v === "tab" ? "\t" : Number(v), sortKeys: $("#json-sort").checked };
  }
  function runJson(minify) {
    const s = jsonIn.value;
    $("#json-in-n").textContent = charsOf(s) + " chars";
    jsonResult = null;
    if (!s.trim()) { jsonOut.className = "out"; jsonOut.textContent = ""; jsonNote.textContent = ""; $("#json-out-n").textContent = ""; return; }
    const r = TextLib.jsonFormat(s, jsonOpts(minify));
    if (!r.ok) { jsonOut.className = "out err"; jsonOut.textContent = r.error; jsonNote.textContent = "Invalid JSON."; $("#json-out-n").textContent = ""; return; }
    jsonResult = r.value;
    jsonOut.className = "out";
    jsonOut.textContent = r.value;
    jsonNote.textContent = "Valid JSON.";
    $("#json-out-n").textContent = charsOf(r.value) + " chars";
  }
  jsonIn.addEventListener("input", () => runJson(false));
  $("#json-fmt").addEventListener("click", () => runJson(false));
  $("#json-min").addEventListener("click", () => runJson(true));
  $("#json-indent").addEventListener("change", () => runJson(false));
  $("#json-sort").addEventListener("change", () => runJson(false));
  $("#json-copy").addEventListener("click", () => { if (jsonResult) copyText(jsonResult, (t) => { jsonNote.textContent = t; }); });

  /* ---------- palette from photo ---------- */
  const palFile = $("#pal-file");
  const palOut = $("#pal-out");
  const palNote = $("#pal-note");
  let palData = null; // RGBA of the downscaled photo
  function renderPalette() {
    if (!palData) return;
    const colors = ColorLib.medianCut(palData, Number($("#pal-n").value));
    palOut.replaceChildren();
    colors.forEach((c) => {
      const hex = ColorLib.toHex(c.rgb);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = hex;
      b.style.color = ColorLib.contrast(c.rgb, [13, 13, 13]) >= ColorLib.contrast(c.rgb, [240, 232, 208]) ? INK : "#f0e8d0";
      b.setAttribute("aria-label", "Copy " + hex);
      const h = document.createElement("strong");
      h.textContent = hex;
      const p = document.createElement("span");
      p.textContent = Math.max(1, Math.round(c.share * 100)) + "%";
      b.append(h, p);
      b.addEventListener("click", () => copyText(hex, (t) => { palNote.textContent = t === "Copied." ? "Copied " + hex : t; }));
      palOut.append(b);
    });
  }
  $("#pal-n").addEventListener("input", () => { $("#pal-n-o").textContent = $("#pal-n").value; renderPalette(); });
  palFile.addEventListener("change", () => {
    const file = palFile.files && palFile.files[0];
    if (!file || !/^image\//.test(file.type)) { palNote.textContent = "That is not an image."; return; }
    palNote.textContent = "Loading...";
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) { palNote.textContent = "Could not read the image size."; return; }
      // smooth preview for the eyes, tiny copy for sampling
      const show = $("#pal-img");
      const ps = Math.min(1, 480 / Math.max(nw, nh));
      show.width = Math.max(1, Math.round(nw * ps));
      show.height = Math.max(1, Math.round(nh * ps));
      show.getContext("2d").drawImage(img, 0, 0, show.width, show.height);
      show.hidden = false;
      $("#pal-empty").hidden = true;
      const ss = Math.min(1, 100 / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * ss)), h = Math.max(1, Math.round(nh * ss));
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d", { willReadFrequently: true });
      tctx.drawImage(img, 0, 0, w, h);
      palData = tctx.getImageData(0, 0, w, h).data;
      palNote.textContent = "Click a swatch to copy its hex.";
      renderPalette();
    };
    img.onerror = () => { URL.revokeObjectURL(url); palNote.textContent = "Could not open this image."; };
    img.src = url;
  });

  /* ---------- passwords ---------- */
  const SETS = [
    ["#p-lower", "abcdefghijklmnopqrstuvwxyz"],
    ["#p-upper", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["#p-digit", "0123456789"],
    ["#p-sym", "!@#$%^&*-_=+"]
  ];
  const passLen = $("#pass-len");
  const passOut = $("#pass-out");
  passLen.addEventListener("input", () => { $("#pass-len-o").textContent = passLen.value; });

  function randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }
  $("#pass-go").addEventListener("click", () => {
    const charset = SETS.filter(([id]) => $(id).checked).map(([, s]) => s).join("");
    if (!charset) { passOut.className = "out err"; passOut.textContent = "Pick at least one character set."; return; }
    if (!(window.crypto && crypto.getRandomValues)) { passOut.className = "out err"; passOut.textContent = "crypto.getRandomValues is not available."; return; }
    const len = Number(passLen.value);
    passOut.className = "out";
    passOut.textContent = TextLib.randomString(len, charset, randomBytes);
    $("#pass-note").textContent = "About " + Math.floor(len * Math.log2(charset.length)) + " bits of entropy.";
  });
  $("#pass-copy").addEventListener("click", () => {
    if (!passOut.textContent || passOut.classList.contains("err")) return;
    copyText(passOut.textContent, (t) => { $("#pass-note").textContent = t; });
  });
})();

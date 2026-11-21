(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const INK = "#0d0d0d";
  const PAPER = "#efe6cf";

  // Neutrals, the current site accent, then a spectrum from yellow round to pink plus two earth tones (no pure red: red stays in the logo).
  const PALETTE = [
    { c: INK, label: "ink" },
    { c: "#3a3a3a", label: "charcoal" },
    { c: "#8c8c8c", label: "grey" },
    { c: "#ffffff", label: "white" },
    { accent: true, label: "current site accent" },
    { c: "#f5cf2e", label: "yellow" },
    { c: "#f08a24", label: "orange" },
    { c: "#a6d63a", label: "lime" },
    { c: "#37b45b", label: "green" },
    { c: "#1fb5a4", label: "teal" },
    { c: "#3fb7ea", label: "cyan" },
    { c: "#3f78e0", label: "blue" },
    { c: "#5648c9", label: "indigo" },
    { c: "#9b5cd6", label: "violet" },
    { c: "#dd4fb1", label: "magenta" },
    { c: "#f6a0c0", label: "pink" },
    { c: "#8a5a3b", label: "brown" },
    { c: "#e4bc92", label: "skin" }
  ];

  const BACKGROUNDS = [
    { c: PAPER, label: "paper" },
    { c: "#ffffff", label: "white" },
    { c: "#d9caa3", label: "sand" },
    { c: "#bfe3f2", label: "sky" },
    { c: "#cfe8c8", label: "mint" },
    { c: "#f3c9d4", label: "rose" },
    { c: "#8c8c8c", label: "grey" },
    { c: "#2b2b2b", label: "charcoal" },
    { c: "#14213d", label: "navy" },
    { c: INK, label: "black" }
  ];

  const canvas = $("#paint");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const W = canvas.width, H = canvas.height;
  const MAX_UNDO = 10; // 960x640 RGBA is about 2.4 MB per snapshot

  let tool = "pen";
  let stampId = window.Figures ? window.Figures.list[0].id : null;
  let size = 5;
  let swatch = PALETTE[0];
  let bg = PAPER;
  let drawing = false;
  let last = null;
  let prevMid = null;
  let strokeColor = INK;
  let sprayTimer = 0;
  const undoStack = [];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // The canvas keeps only the strokes (transparent elsewhere); the background color is the CSS background behind it,
  // so changing it never touches the drawing and the eraser really erases.
  function whiten() { ctx.clearRect(0, 0, W, H); }
  function snapshot() {
    undoStack.push({ img: ctx.getImageData(0, 0, W, H), bg });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.min(W, Math.max(0, ((e.clientX - r.left) * W) / r.width)),
      Math.min(H, Math.max(0, ((e.clientY - r.top) * H) / r.height))
    ];
  }
  function currentColor() {
    if (tool === "eraser") return "#000"; // any opaque color: destination-out only uses the alpha
    if (swatch.accent) return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d9a23a";
    return swatch.c;
  }
  function lineWidth() { return tool === "eraser" ? size * 2.5 : size; }
  function sprayAt(x, y) {
    ctx.fillStyle = strokeColor;
    Lib.sprayPoints(x, y, size * 2.2, Math.ceil(size * 2.5), Math.random)
      .forEach((p) => ctx.fillRect(p[0], p[1], 1.7, 1.7));
  }

  // A stamp is a doodle from figures.js drawn as a stroke in the current color, slightly rotated like a hand-placed sticker.
  function stampAt(x, y) {
    const fig = window.Figures && window.Figures.byId[stampId];
    if (!fig) return;
    const sc = (30 + size * 8) / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.3);
    ctx.scale(sc, sc);
    ctx.translate(-50, -50);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4.5 / sc;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(fig.d));
    ctx.restore();
  }

  whiten();

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    snapshot();
    strokeColor = currentColor();
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    if (tool === "stamp") { const sp = pos(e); stampAt(sp[0], sp[1]); return; }
    drawing = true;
    const p = pos(e);
    last = p;
    prevMid = p;
    if (tool === "spray") {
      sprayAt(p[0], p[1]);
      sprayTimer = setInterval(() => sprayAt(last[0], last[1]), 35);
    } else {
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(p[0], p[1], lineWidth() / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const cur = pos(e);
    if (tool === "spray") {
      const dist = Math.hypot(cur[0] - last[0], cur[1] - last[1]);
      const n = Math.max(1, Math.ceil(dist / (size * 1.2)));
      for (let i = 1; i <= n; i++) {
        sprayAt(last[0] + ((cur[0] - last[0]) * i) / n, last[1] + ((cur[1] - last[1]) * i) / n);
      }
    } else {
      // smoothing: a curve through the midpoints of neighbouring points
      const mid = [(last[0] + cur[0]) / 2, (last[1] + cur[1]) / 2];
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth();
      ctx.beginPath();
      ctx.moveTo(prevMid[0], prevMid[1]);
      ctx.quadraticCurveTo(last[0], last[1], mid[0], mid[1]);
      ctx.stroke();
      prevMid = mid;
    }
    last = cur;
  });

  function stop() {
    if (!drawing) return;
    drawing = false;
    clearInterval(sprayTimer);
    if (tool !== "spray" && prevMid && last) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth();
      ctx.beginPath();
      ctx.moveTo(prevMid[0], prevMid[1]);
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
    last = null;
    prevMid = null;
  }
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("lostpointercapture", stop);

  document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
    tool = b.dataset.tool;
    document.querySelectorAll("[data-tool]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    document.querySelectorAll("[data-stamp]").forEach((o) => o.setAttribute("aria-pressed", String(tool === "stamp" && o.dataset.stamp === stampId)));
  }));
  document.querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => {
    size = Number(b.dataset.size);
    document.querySelectorAll("[data-size]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  }));

  function setPressed(box, el) {
    box.querySelectorAll("button, .custom").forEach((o) => {
      o.setAttribute("aria-pressed", String(o === el));
      o.classList.toggle("on", o === el);
    });
  }

  // A round swatch that opens the browser's color picker; it shows a rainbow until a color is chosen.
  function customPicker(box, label, initial, onPick) {
    const wrap = document.createElement("label");
    wrap.className = "custom";
    wrap.title = label;
    const input = document.createElement("input");
    input.type = "color";
    input.value = initial;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      wrap.style.background = input.value;
      setPressed(box, wrap);
      onPick(input.value);
    });
    wrap.append(input);
    box.append(wrap);
  }

  const pal = $("#palette");
  PALETTE.forEach((sw, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = sw.accent ? "var(--accent)" : sw.c;
    b.setAttribute("aria-label", "Color: " + sw.label);
    b.title = sw.label;
    b.addEventListener("click", () => {
      swatch = sw;
      if (tool === "eraser") {
        tool = "pen";
        document.querySelectorAll("[data-tool]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.tool === "pen")));
      }
      setPressed(pal, b);
    });
    pal.append(b);
  });
  customPicker(pal, "Custom color", "#f08a24", (value) => {
    swatch = { c: value, label: "custom" };
    if (tool === "eraser") {
      tool = "pen";
      document.querySelectorAll("[data-tool]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.tool === "pen")));
    }
  });
  setPressed(pal, pal.querySelector("button"));

  const bgBox = $("#bgpalette");
  function setBg(value, el) {
    bg = value;
    canvas.style.background = value;
    if (el !== undefined) setPressed(bgBox, el);
  }
  const bgButtons = [];
  BACKGROUNDS.forEach((sw) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = sw.c;
    b.setAttribute("aria-label", "Background: " + sw.label);
    b.title = sw.label;
    b.addEventListener("click", () => { snapshot(); setBg(sw.c, b); });
    bgBox.append(b);
    bgButtons.push({ b, c: sw.c });
  });
  customPicker(bgBox, "Custom background", "#bfe3f2", (value) => setBg(value));
  setPressed(bgBox, bgBox.querySelector("button"));

  const stampBox = $("#stamps");
  const NS = "http://www.w3.org/2000/svg";
  if (window.Figures) {
    window.Figures.list.forEach((fig) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Stamp: " + fig.label);
      b.title = fig.label;
      b.dataset.stamp = fig.id;
      b.setAttribute("aria-pressed", "false");
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", fig.d);
      svg.append(p);
      b.append(svg);
      b.addEventListener("click", () => {
        stampId = fig.id;
        tool = "stamp";
        document.querySelectorAll("[data-tool]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.tool === "stamp")));
        stampBox.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      });
      stampBox.append(b);
    });
  }

  $("#undo").addEventListener("click", () => {
    const prev = undoStack.pop();
    if (!prev) return;
    ctx.putImageData(prev.img, 0, 0);
    const match = bgButtons.find((x) => x.c === prev.bg);
    setBg(prev.bg, match ? match.b : null);
  });
  $("#clear").addEventListener("click", () => { snapshot(); whiten(); });
  $("#save").addEventListener("click", () => {
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d");
    octx.fillStyle = bg;
    octx.fillRect(0, 0, W, H);
    octx.drawImage(canvas, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "4got2name-paint.png";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  });
})();

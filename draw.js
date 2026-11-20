(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const INK = "#0d0d0d";
  const PAPER = "#efe6cf";

  // The site's own limited palette: ink, grey, sand, the current accent, paper, plus the four muted music accents.
  const PALETTE = [
    { c: INK, label: "ink" },
    { c: "#6b6b6b", label: "grey" },
    { c: "#b8ad92", label: "sand" },
    { accent: true, label: "current site accent" },
    { c: "#9d93c7", label: "periwinkle" },
    { c: "#7fb3b0", label: "teal" },
    { c: "#a3b36b", label: "moss" },
    { c: "#c9674a", label: "rust" },
    { c: PAPER, label: "paper" }
  ];

  const canvas = $("#paint");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const W = canvas.width, H = canvas.height;
  const MAX_UNDO = 10; // 960x640 RGBA is about 2.4 MB per snapshot

  let tool = "pen";
  let stampId = window.Figures ? window.Figures.list[0].id : null;
  let size = 5;
  let swatch = PALETTE[0];
  let drawing = false;
  let last = null;
  let prevMid = null;
  let strokeColor = INK;
  let sprayTimer = 0;
  const undoStack = [];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function whiten() { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); }
  function snapshot() {
    undoStack.push(ctx.getImageData(0, 0, W, H));
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
    if (tool === "eraser") return PAPER;
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

  const pal = $("#palette");
  PALETTE.forEach((sw, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = sw.accent ? "var(--accent)" : sw.c;
    b.setAttribute("aria-label", "Color: " + sw.label);
    b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => {
      swatch = sw;
      if (tool === "eraser") {
        tool = "pen";
        document.querySelectorAll("[data-tool]").forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.tool === "pen")));
      }
      pal.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    });
    pal.append(b);
  });

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
    if (prev) ctx.putImageData(prev, 0, 0);
  });
  $("#clear").addEventListener("click", () => { snapshot(); whiten(); });
  $("#save").addEventListener("click", () => {
    canvas.toBlob((blob) => {
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

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const MAX_SIDE = 1200;
  const INK = [13, 13, 13];
  const PAPER = [239, 230, 207];
  const ACCENT_FALLBACK = [217, 162, 58];

  const out = $("#out");
  const ctx = out.getContext("2d");
  const empty = $("#empty");
  const stage = $("#stage");
  const msg = $("#msg");
  const saveBtn = $("#save");

  const DEFAULTS = { mode: "halftone", brightness: 0, contrast: 0, threshold: 128, cell: 8, angle: 45, light: "paper" };
  const state = Object.assign({}, DEFAULTS);
  let base = null; // scaled-down original: { data, width, height }
  let queued = false;

  function lightColor() {
    if (state.light === "accent") {
      const c = ImgLib.parseCssColor(getComputedStyle(document.documentElement).getPropertyValue("--accent"));
      return c || ACCENT_FALLBACK;
    }
    return PAPER;
  }

  function render() {
    if (!base) return;
    const { width: w, height: h } = base;
    const data = new Uint8ClampedArray(base.data);
    ImgLib.adjust(data, state.brightness, state.contrast);
    let res = data;
    switch (state.mode) {
      case "gray": ImgLib.grayscale(data); break;
      case "xerox": ImgLib.threshold(data, state.threshold, INK, lightColor()); break;
      case "duotone": ImgLib.duotone(data, INK, lightColor()); break;
      case "halftone": res = ImgLib.halftone(data, w, h, state.cell, state.angle, INK, lightColor()); break;
      default: break; // original: brightness and contrast only
    }
    ctx.putImageData(new ImageData(res, w, h), 0, 0);
  }

  function schedule() {
    if (queued || !base) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }

  function syncVisibility() {
    document.querySelectorAll("[data-for]").forEach((el) => {
      el.hidden = el.dataset.for.split(" ").indexOf(state.mode) === -1;
    });
  }

  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { msg.textContent = "That is not an image."; return; }
    msg.textContent = "Loading...";
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) { msg.textContent = "Could not read the image size."; return; }
      const s = Math.min(1, MAX_SIDE / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * s));
      const h = Math.max(1, Math.round(nh * s));
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d", { willReadFrequently: true });
      tctx.fillStyle = "rgb(" + PAPER.join(",") + ")"; // transparency becomes paper
      tctx.fillRect(0, 0, w, h);
      tctx.drawImage(img, 0, 0, w, h);
      const id = tctx.getImageData(0, 0, w, h);
      base = { data: id.data, width: w, height: h };
      out.width = w;
      out.height = h;
      out.hidden = false;
      empty.hidden = true;
      saveBtn.disabled = false;
      msg.textContent = s < 1 ? "Scaled down to " + w + "×" + h + " for speed." : "Size " + w + "×" + h + ".";
      render();
    };
    img.onerror = () => { URL.revokeObjectURL(url); msg.textContent = "Could not open this image."; };
    img.src = url;
  }

  $("#file").addEventListener("change", (e) => loadFile(e.target.files && e.target.files[0]));

  stage.addEventListener("dragover", (e) => { e.preventDefault(); stage.classList.add("drop-on"); });
  stage.addEventListener("dragleave", () => stage.classList.remove("drop-on"));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.classList.remove("drop-on");
    loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
    state.mode = r.value;
    syncVisibility();
    schedule();
  }));

  ["brightness", "contrast", "threshold", "cell", "angle"].forEach((id) => {
    const input = $("#" + id);
    const output = $("#" + id + "-o");
    input.addEventListener("input", () => {
      state[id] = Number(input.value);
      output.textContent = input.value;
      schedule();
    });
  });
  $("#light").addEventListener("change", (e) => { state.light = e.target.value; schedule(); });

  $("#reset").addEventListener("click", () => {
    Object.assign(state, DEFAULTS);
    ["brightness", "contrast", "threshold", "cell", "angle"].forEach((id) => {
      $("#" + id).value = String(DEFAULTS[id]);
      $("#" + id + "-o").textContent = String(DEFAULTS[id]);
    });
    $("#light").value = DEFAULTS.light;
    document.querySelector('input[name="mode"][value="' + DEFAULTS.mode + '"]').checked = true;
    syncVisibility();
    schedule();
  });

  saveBtn.addEventListener("click", () => {
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "4got2name-lab.png";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  });

  syncVisibility();
})();

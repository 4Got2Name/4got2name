// Shared by all pages. Loaded in <head> without defer so the accent is restored before first paint.
(function () {
  "use strict";

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HEX = /^#[0-9a-f]{6}$/i;

  function sstore(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage may be blocked */ } }
  function sload(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  // Theme: "paint" (default) or "gta". It has to survive page changes, so it is kept in four places and read in this order:
  // ?theme= in the URL (internal links carry it), window.name (lives as long as the tab), localStorage, sessionStorage.
  // The URL and window.name still work when a host blocks storage or gives every page its own storage.
  const THEMES = ["paint", "gta"];
  const NAME_PREFIX = "4g2n-theme:";
  const okTheme = (v) => (THEMES.indexOf(v) >= 0 ? v : null);
  function fromUrl() { try { return okTheme(new URLSearchParams(location.search).get("theme")); } catch (e) { return null; } }
  function fromName() { try { return window.name.indexOf(NAME_PREFIX) === 0 ? okTheme(window.name.slice(NAME_PREFIX.length)) : null; } catch (e) { return null; } }
  function fromLocal() { try { return okTheme(localStorage.getItem("theme")); } catch (e) { return null; } }
  function fromSession() { return okTheme(sload("theme")); }
  function readTheme() { return fromUrl() || fromName() || fromLocal() || fromSession(); }
  function writeTheme(v) {
    try { localStorage.setItem("theme", v); } catch (e) { /* blocked */ }
    sstore("theme", v);
    try { if (!window.name || window.name.indexOf(NAME_PREFIX) === 0) window.name = NAME_PREFIX + v; } catch (e) { /* blocked */ }
  }
  let chosen = readTheme();           // null until the visitor has picked a theme at least once
  let theme = chosen || "paint";
  root.dataset.theme = theme;
  if (chosen) writeTheme(theme);

  const savedAccent = sload("accent");
  if (theme === "paint" && savedAccent && HEX.test(savedAccent)) root.style.setProperty("--accent", savedAccent);

  function applyTheme(name) {
    theme = name;
    root.dataset.theme = name;
    // GTA mode has a fixed white accent from CSS; paint mode gets its last tint back
    const a = sload("accent");
    if (name === "paint" && a && HEX.test(a)) root.style.setProperty("--accent", a);
    else root.style.removeProperty("--accent");
    syncThemeButton();
    decorateLinks();
  }

  // Internal page links carry the current theme, so it follows the visitor even when nothing can be stored.
  function decorateLinks() {
    if (!chosen) return;
    document.querySelectorAll("a[href]").forEach((a) => {
      try {
        const u = new URL(a.getAttribute("href"), location.href);
        if (u.protocol !== location.protocol || u.host !== location.host) return;
        if (!/(\.html?|\/)$/.test(u.pathname)) return;
        u.searchParams.set("theme", theme);
        a.href = u.href;
      } catch (e) { /* not a URL we can rewrite */ }
    });
  }

  window.Site = {
    reduceMotion: reduce,
    get theme() { return theme; },
    setTheme(name) {
      if (!okTheme(name)) return;
      chosen = name;
      writeTheme(name);
      try {
        const u = new URL(location.href);
        if (u.searchParams.has("theme")) { u.searchParams.set("theme", name); history.replaceState(history.state, "", u.href); }
      } catch (e) { /* replaceState can be blocked */ }
      applyTheme(name);
    },
    setAccent(hex) {
      if (!HEX.test(hex) || theme !== "paint") return;
      root.style.setProperty("--accent", hex);
      sstore("accent", hex);
    },
    // Empty state: an explanation instead of invented content
    unset(el, text) {
      const p = document.createElement("p");
      p.className = "unset";
      p.textContent = text;
      el.replaceChildren(p);
    },
    externalLink(href, text, cls) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "btn" + (cls ? " " + cls : "");
      return a;
    }
  };

  /* ---------- slow accent drift: orange -> green -> blue (the CSS transition on --accent makes each step a smooth fade) ---------- */
  const DRIFT = ["#c9674a", "#7fae5f", "#5f90c9"];
  const DRIFT_MS = 9000;
  function startDrift() {
    const page = document.body && document.body.dataset.page;
    // music sets its own tint per channel, paint reads the accent as an ink color: neither should change by itself
    if (reduce || page === "music" || page === "draw") return;
    let i = DRIFT.indexOf((root.style.getPropertyValue("--accent") || "").trim().toLowerCase());
    setInterval(() => {
      if (theme !== "paint") return;
      i = (i + 1) % DRIFT.length;
      window.Site.setAccent(DRIFT[i]);
    }, DRIFT_MS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startDrift);
  else startDrift();

  /* ---------- background scenes (drawn once, cross-faded by CSS) ---------- */
  function rng(seed) { // mulberry32: the same sky on every visit
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const f1 = (n) => n.toFixed(1);

  // Per-page backgrounds. Each entry: [figure id, x, y, size, rotation, color (a = accent, b = teal, c = periwinkle), opacity]
  const SCENES = {
    home: [ // night, Halloween
      ["moon", 1010, 170, 190, 15, "a"], ["star", 120, 150, 60, 0, "c"], ["star", 330, 90, 36, 15, "a"], ["star", 640, 60, 44, -10, "b"],
      ["star", 880, 330, 34, 10, "c"], ["star", 1130, 420, 40, 0, "a"], ["star", 90, 420, 38, -12, "b"],
      ["bat", 260, 230, 90, -10, "c"], ["bat", 760, 140, 70, 8, "c"], ["bat", 1100, 560, 80, -8, "b"], ["bat", 60, 620, 70, 12, "c"],
      ["pumpkin", 140, 710, 150, -5, "a"], ["pumpkin", 1110, 730, 130, 6, "a"], ["ghost", 330, 690, 120, 6, "b"],
      ["tree", 900, 690, 210, 0, "c"], ["spiral", 640, 760, 80, 0, "b"]
    ],
    music: [
      ["note", 90, 140, 90, -10, "a"], ["note", 1120, 120, 80, 12, "c"], ["note", 200, 420, 70, 8, "b"], ["note", 1090, 430, 90, -8, "a"], ["note", 640, 50, 60, 5, "c"],
      ["guitar", 120, 660, 230, -12, "a"], ["guitar", 1090, 690, 200, 14, "b"], ["vinyl", 640, 740, 150, 0, "c"],
      ["star", 330, 120, 46, 10, "b"], ["star", 860, 90, 40, -10, "a"], ["star", 70, 380, 34, 0, "c"], ["star", 1150, 300, 38, 12, "b"], ["star", 500, 770, 36, 0, "a"],
      ["bolt", 940, 330, 70, 14, "a"], ["spiral", 330, 720, 80, 0, "b"]
    ],
    projects: [ // graffiti
      ["drip", 300, 70, 220, 0, "a"], ["drip", 900, 70, 200, 0, "b"], ["crown", 110, 180, 120, -12, "a"], ["skull", 1120, 250, 140, 10, "c"],
      ["spraycan", 100, 470, 160, -8, "b"], ["spraycan", 1130, 560, 150, 10, "a"], ["pistol", 230, 700, 150, -10, "c"], ["pistol", 1000, 740, 130, 12, "b"],
      ["arrow", 640, 770, 120, 0, "a"], ["brace", 1170, 420, 90, 0, "c"], ["bolt", 70, 330, 70, -10, "a"], ["star", 640, 40, 40, 0, "b"]
    ],
    draw: [
      ["spraycan", 110, 200, 160, -10, "a"], ["rainbow", 1050, 180, 200, 0, "b"], ["sun", 100, 620, 150, 0, "a"], ["heart", 1110, 640, 110, 10, "c"],
      ["star", 330, 60, 44, 10, "c"], ["star", 880, 740, 40, -8, "a"], ["spiral", 640, 760, 90, 0, "b"], ["drip", 260, 70, 200, 0, "c"], ["cloud", 1130, 430, 120, 0, "b"], ["eye", 70, 430, 80, 0, "c"]
    ],
    lab: [
      ["camera", 120, 170, 160, -8, "a"], ["camera", 1090, 700, 150, 8, "c"], ["film", 1100, 150, 200, 6, "b"], ["film", 150, 700, 190, -6, "a"],
      ["eye", 70, 430, 90, 0, "c"], ["eye", 1140, 440, 90, 0, "b"], ["spiral", 640, 50, 70, 0, "a"], ["star", 330, 760, 40, 0, "b"], ["star", 900, 60, 40, 10, "c"]
    ],
    tools: [
      ["gear", 110, 150, 170, 0, "a"], ["gear", 1100, 700, 190, 10, "b"], ["gear", 230, 300, 80, 0, "c"], ["lock", 1110, 190, 120, 6, "c"], ["lock", 130, 690, 110, -6, "a"],
      ["brace", 70, 450, 120, 0, "b"], ["brace", 1150, 440, 120, 0, "a"], ["bolt", 640, 50, 60, 10, "c"], ["skull", 900, 760, 80, 0, "b"]
    ]
  };
  const COLOR = { a: "var(--accent)", b: "var(--c2)", c: "var(--c3)" };

  // Smaller filler doodles scattered between the main drawings so the background never looks empty.
  const POOLS = {
    home: ["star", "bat", "ghost", "pumpkin", "moon", "skull", "spiral", "bolt"],
    music: ["note", "star", "bolt", "heart", "vinyl", "spiral", "rainbow", "guitar"],
    projects: ["drip", "bolt", "skull", "crown", "arrow", "spraycan", "star", "brace", "eye"],
    draw: ["star", "heart", "sun", "rainbow", "cloud", "spiral", "spraycan", "bolt", "eye"],
    lab: ["eye", "star", "camera", "film", "spiral", "sun", "bolt"],
    tools: ["gear", "lock", "brace", "bolt", "arrow", "eye", "skull", "star"]
  };
  const TINY = ["M30 50 H70 M50 30 V70", "M20 60 L80 40", "M10 50 q15 -25 30 0 t30 0 t30 0"]; // cross, dash, squiggle

  function fillers(page, placed, r) {
    const pool = POOLS[page] || POOLS.home;
    const keys = ["a", "b", "c"];
    const items = [];
    for (let tries = 0; tries < 900 && items.length < 42; tries++) {
      const x = 30 + r() * 1140, y = 30 + r() * 740, size = 26 + r() * 30;
      const clear = placed.concat(items).every((p) => Math.hypot(p[1] - x, p[2] - y) > (p[3] + size) * 0.55 + 8);
      if (!clear) continue;
      items.push([pool[Math.floor(r() * pool.length)], x, y, size, (r() - 0.5) * 50, keys[Math.floor(r() * 3)]]);
    }
    return items;
  }

  function paintScene(page) {
    const r = rng(11);
    let dots = "";
    for (let i = 0; i < 220; i++) {
      dots += '<circle cx="' + f1(r() * 1200) + '" cy="' + f1(r() * 800) + '" r="' + f1(1 + r() * 1.8) +
        '" style="fill:' + (i % 3 ? "var(--accent)" : "var(--c2)") + '" opacity="0.28"/>';
    }
    const main = SCENES[page] || SCENES.home;
    const g = (items) => items.map(([id, x, y, size, rot, col]) => {
      const fig = window.Figures && window.Figures.byId[id];
      if (!fig) return "";
      return '<g transform="translate(' + f1(x) + " " + f1(y) + ") rotate(" + f1(rot) + ") scale(" + f1(size / 100) + ') translate(-50 -50)" style="stroke:' + COLOR[col] + '"><path d="' + fig.d + '"/></g>';
    }).join("");
    let tiny = "";
    for (let i = 0; i < 46; i++) {
      const sz = 14 + r() * 14;
      tiny += '<g transform="translate(' + f1(r() * 1200) + " " + f1(r() * 800) + ") rotate(" + f1((r() - 0.5) * 90) + ") scale(" + f1(sz / 100) + ') translate(-50 -50)" style="stroke:' + COLOR[["a", "b", "c"][i % 3]] + '"><path d="' + TINY[i % 3] + '"/></g>';
    }
    let tag = "";
    if (page === "projects") {
      tag = '<text x="620" y="690" transform="rotate(-6 620 690)" text-anchor="middle" font-size="64" style="font-family:var(--display);stroke:var(--accent)" stroke-width="3" fill="none">4GOT2NAME</text>' +
        '<text x="880" y="150" transform="rotate(5 880 150)" text-anchor="middle" font-size="34" style="font-family:var(--display);stroke:var(--c3)" stroke-width="2" fill="none">WAS HERE</text>';
    }
    const base = 'fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#wobble)"';
    return '<svg class="s-paint" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + dots +
      '<g ' + base + '><g opacity="0.3">' + g(fillers(page, main, r)) + tiny + '</g><g opacity="0.55">' + g(main) + tag + "</g></g></svg>";
  }

  function buildScenes() {
    const defs = document.createElement("div");
    defs.setAttribute("aria-hidden", "true");
    defs.innerHTML = '<svg width="0" height="0" style="position:absolute"><filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="wobble-s" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    const scene = document.createElement("div");
    scene.className = "scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = paintScene(document.body.dataset.page);
    const gta = document.createElement("div");
    gta.className = "gta-scene";
    gta.setAttribute("aria-hidden", "true");
    gta.innerHTML = gtaScene();
    document.body.prepend(scene, gta, defs);
  }

  /* ---------- GTA 6 style scene: sunset sky (CSS), striped sun, palm silhouettes ---------- */
  function palm(x, baseY, h, lean, fill) {
    const cx = x + lean, cy = baseY - h;
    const trunk = '<path d="M' + x + " " + baseY + " Q" + f1(x + lean * 0.15) + " " + f1(baseY - h * 0.55) + " " + f1(cx) + " " + f1(cy) +
      '" fill="none" stroke="' + fill + '" stroke-width="' + f1(h * 0.045) + '" stroke-linecap="round"/>';
    const angles = [-172, -148, -124, -100, -76, -52, -28, -6, 14, 166];
    let fr = "";
    angles.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, L = h * (0.36 + 0.07 * ((i * 7) % 3)), ca = Math.cos(a), sa = Math.sin(a);
      const ex = cx + ca * L, ey = cy + sa * L + L * 0.38;
      const c1x = cx + ca * L * 0.5, c1y = cy + sa * L * 0.5 - L * 0.3;
      const w = L * 0.17, c2x = c1x - sa * w, c2y = c1y + ca * w;
      fr += '<path d="M' + f1(cx) + " " + f1(cy) + " Q" + f1(c1x) + " " + f1(c1y) + " " + f1(ex) + " " + f1(ey) +
        " Q" + f1(c2x) + " " + f1(c2y) + " " + f1(cx) + " " + f1(cy) + 'Z" fill="' + fill + '"/>';
    });
    return trunk + fr + '<circle cx="' + f1(cx - 6) + '" cy="' + f1(cy + 8) + '" r="' + f1(h * 0.018) + '" fill="' + fill + '"/><circle cx="' + f1(cx + 7) + '" cy="' + f1(cy + 9) + '" r="' + f1(h * 0.018) + '" fill="' + fill + '"/>';
  }
  function gtaScene() {
    let bars = "";
    for (let i = 0; i < 7; i++) { // sun stripes get thicker toward the bottom
      const y = 520 + i * 24, t = 3 + i * 2.2;
      bars += '<rect x="380" y="' + f1(y) + '" width="440" height="' + f1(t) + '" fill="#000"/>';
    }
    return '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="gsun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd35a"/><stop offset="0.55" stop-color="#ff8f5a"/><stop offset="1" stop-color="#ff3f8e"/></linearGradient>' +
      '<linearGradient id="gground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a47"/><stop offset="1" stop-color="#0c0219"/></linearGradient>' +
      '<mask id="gmask"><rect width="1200" height="800" fill="#fff"/>' + bars + "</mask></defs>" +
      '<circle cx="600" cy="520" r="210" fill="url(#gsun)" mask="url(#gmask)"/>' +
      palm(330, 650, 250, -26, "#220a3b") + palm(900, 660, 230, 30, "#220a3b") +
      '<path d="M0 660 Q260 620 600 650 T1200 640 V800 H0Z" fill="url(#gground)"/>' +
      palm(120, 760, 640, 70, "#10031c") + palm(1085, 770, 680, -80, "#10031c") + "</svg>";
  }

  let themeBtn = null;
  function syncThemeButton() {
    if (!themeBtn) return;
    const gta = theme === "gta";
    themeBtn.textContent = gta ? "Back to Paint" : "GTA 6 mode";
    themeBtn.setAttribute("aria-pressed", gta ? "true" : "false");
  }
  function themeToggle() {
    const top = document.querySelector(".top");
    if (!top) return;
    themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "themebtn";
    themeBtn.addEventListener("click", () => window.Site.setTheme(theme === "gta" ? "paint" : "gta"));
    top.append(themeBtn);
    syncThemeButton();
  }

  /* ---------- ticker ---------- */
  function ticker() {
    const el = document.getElementById("ticker");
    if (!el) return;
    const cfg = window.SITE_CONFIG || {};
    const lines = Array.isArray(cfg.ticker) ? cfg.ticker.filter((s) => typeof s === "string" && s.trim()) : [];
    if (!lines.length) return;
    const text = lines.join(" ✦ ") + " ✦ ";
    const track = document.createElement("div");
    track.className = "track";
    for (let i = 0; i < 2; i++) {
      const s = document.createElement("span");
      s.textContent = text.repeat(3);
      track.append(s);
    }
    el.append(track);
  }

  /* ---------- footer clock: the visitor's own time zone ---------- */
  function clock() {
    const t = document.getElementById("clock");
    const z = document.getElementById("tz");
    if (!t) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
      if (z) z.textContent = "(" + (fmt.resolvedOptions().timeZone || "local time") + ")";
    } catch (e) { return; }
    function tick() {
      const d = new Date();
      t.textContent = fmt.format(d);
      t.dateTime = d.toISOString();
    }
    tick();
    setInterval(tick, 1000);
  }

  function intro() {
    if (reduce || document.body.dataset.page !== "home" || sload("intro")) return;
    sstore("intro", "1");
    const box = document.createElement("div");
    box.className = "intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Loading");
    box.innerHTML =
      '<div class="intro-card"><img src="assets/logo-main.png" alt="" width="110" height="110">' +
      "<p>Loading...</p>" +
      '<div class="bar"><i></i></div><button type="button">Skip</button></div>';
    document.body.append(box);
    let done = false;
    function close() {
      if (done) return;
      done = true;
      box.classList.add("out");
      setTimeout(() => box.remove(), 400);
    }
    box.querySelector("button").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    setTimeout(close, 1500);
    box.querySelector("button").focus({ preventScroll: true });
  }

  window.addEventListener("pageshow", (e) => { // restored from the back/forward cache: re-read the choice
    const t = e.persisted && readTheme();
    if (t && t !== theme) { chosen = t; applyTheme(t); }
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "theme" && okTheme(e.newValue) && e.newValue !== theme) { chosen = e.newValue; applyTheme(e.newValue); }
  });

  document.addEventListener("DOMContentLoaded", () => {
    buildScenes();
    themeToggle();
    decorateLinks();
    ticker();
    clock();
    intro();
  });
})();

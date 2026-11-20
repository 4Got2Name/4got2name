(function () {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const hub = document.getElementById("hub");
  const names = { spotify: "Spotify", soundcloud: "SoundCloud", pinterest: "Pinterest", github: "GitHub", youtube: "YouTube", discord: "Discord" };
  const profiles = cfg.profiles || {};
  const NS = "http://www.w3.org/2000/svg";

  Object.keys(names).forEach((key) => {
    const href = Lib.safeHttps(profiles[key]);
    const mark = window.Figures && window.Figures.marks[key];
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "social";
    a.setAttribute("aria-label", names[key] + " (opens in a new tab)");
    a.title = names[key];
    if (mark) {
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", mark.d);
      path.setAttribute("fill", mark.color);
      a.style.setProperty("--brand", mark.color);
      svg.append(path);
      a.append(svg);
    } else {
      a.textContent = names[key]; // no drawing for this key: fall back to a text link
    }
    hub.append(a);
  });
})();

(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};
  const $ = (sel) => document.querySelector(sel);

  // Channels come from config.music.channels (label, playlist URL, accent). A channel without a valid playlist shows an empty state.
  const CHANNELS = Lib.parseChannels(cfg.music && cfg.music.channels);
  const FALLBACK_ACCENT = "#d9a23a";

  const list = $("#channels");
  const note = $("#ch-note");
  const player = $("#player");
  const screen = $("#static");
  let current = -1;
  let request = 0;
  let staticToken = 0;

  function staticBurst(canvas, ms) {
    if (Site.reduceMotion) return Promise.resolve();
    const my = ++staticToken;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const end = performance.now() + ms;
    canvas.hidden = false;
    return new Promise((resolve) => {
      (function frame() {
        if (my !== staticToken) { resolve(); return; } // a newer burst took over
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = 30 + Math.floor(Math.random() * 90); // muted grey, no harsh white flashes
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        if (performance.now() < end) requestAnimationFrame(frame);
        else { canvas.hidden = true; resolve(); }
      })();
    });
  }

  async function setChannel(i) {
    const idx = (i + CHANNELS.length) % CHANNELS.length;
    const ch = CHANNELS[idx];
    const req = ++request;
    current = idx;
    Site.setAccent(ch.accent || FALLBACK_ACCENT);
    list.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(k === idx)));
    note.textContent = "Channel " + (idx + 1) + " · " + ch.label;

    await staticBurst(screen, 450);
    if (req !== request) return;

    if (!ch.id) { Site.unset(player, "This channel has no valid playlist link yet."); return; }
    const frame = document.createElement("iframe");
    frame.src = "https://open.spotify.com/embed/playlist/" + ch.id + "?theme=0";
    frame.title = "Spotify playlist: " + ch.label;
    frame.allow = "encrypted-media";
    frame.loading = "lazy";
    player.replaceChildren(frame);
  }

  // My own tracks (SoundCloud players) from config.music.own, then a "coming soon" line.
  const own = $("#own");
  if (own) {
    const tracks = Lib.parseTracks(cfg.music && cfg.music.own);
    tracks.forEach((t) => {
      const box = document.createElement("div");
      box.className = "track";
      const frame = document.createElement("iframe");
      frame.src = t.embed;
      frame.title = "SoundCloud: " + t.label;
      frame.loading = "lazy";
      frame.allow = "autoplay";
      box.append(frame);
      own.append(box);
    });
    const soon = document.createElement("p");
    soon.className = "unset";
    soon.textContent = "More tracks: coming soon.";
    own.append(soon);
  }

  if (!CHANNELS.length) { Site.unset(player, "No channels configured."); return; }
  Site.unset(player, "The screen is off. Flip a channel.");
  CHANNELS.forEach((ch, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i + 1) + " " + ch.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => setChannel(i));
    list.append(b);
  });
  $("#ch-prev").addEventListener("click", () => setChannel(current < 0 ? CHANNELS.length - 1 : current - 1));
  $("#ch-next").addEventListener("click", () => setChannel(current + 1));
})();

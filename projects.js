(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};
  const $ = (sel) => document.querySelector(sel);

  async function initGithub() {
    const box = $("#gh-list");
    const user = cfg.github && cfg.github.user;
    if (!Lib.isGithubUser(user)) { Site.unset(box, "GitHub profile is not connected yet."); return; }

    const name = user.trim();
    const profileUrl = "https://github.com/" + encodeURIComponent(name);
    // Repositories are hidden until there is something to show: set github.showRepos to true in config.js to turn the live list back on.
    if (!(cfg.github && cfg.github.showRepos === true)) {
      Site.unset(box, "Coming soon (maybe).");
      box.append(Site.externalLink(profileUrl, "My GitHub", "pin-link"));
      return;
    }
    Site.unset(box, "Loading repositories...");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch(
        "https://api.github.com/users/" + encodeURIComponent(name) + "/repos?sort=pushed&per_page=50",
        { headers: { Accept: "application/vnd.github+json" }, signal: ctl.signal }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const repos = Lib.pickRepos(await res.json(), 6);
      if (!repos.length) {
        Site.unset(box, "Nothing here yet, but soon.");
        box.append(Site.externalLink(profileUrl, "My GitHub", "pin-link"));
        return;
      }
      const ul = document.createElement("ul");
      repos.forEach((r) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = r.html_url;
        a.textContent = r.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.append(a);
        if (r.description) {
          const p = document.createElement("p");
          p.textContent = r.description;
          li.append(p);
        }
        if (r.language) {
          const s = document.createElement("small");
          s.textContent = r.language;
          li.append(s);
        }
        ul.append(li);
      });
      box.replaceChildren(ul);
    } catch (e) {
      Site.unset(box, "Could not load repositories (GitHub rate limit or network).");
      box.append(Site.externalLink(profileUrl, "Open GitHub", "pin-link"));
    } finally {
      clearTimeout(timer);
    }
  }

  function initYoutube() {
    const box = $("#yt-body");
    const channelId = cfg.youtube && cfg.youtube.channelId;
    const videoId = Lib.youtubeVideoId(cfg.youtube && cfg.youtube.video);
    const list = Lib.youtubeUploadsPlaylistId(channelId);
    const profile = Lib.safeHttps(cfg.profiles && cfg.profiles.youtube);
    if (!videoId && !list) {
      Site.unset(box, "The video is not connected yet (video link needed).");
      if (profile) box.append(Site.externalLink(profile, "Open the channel on YouTube", "pin-link"));
      return;
    }
    const frame = document.createElement("iframe");
    frame.src = videoId
      ? "https://www.youtube-nocookie.com/embed/" + videoId
      : "https://www.youtube-nocookie.com/embed/videoseries?list=" + list;
    frame.title = videoId ? "Video" : "Videos from the channel";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin"; // the player refuses to start (error 153) when it gets no referrer
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    const p = document.createElement("p");
    const link = list ? Site.externalLink("https://www.youtube.com/channel/" + channelId.trim() + "?sub_confirmation=1", "Subscribe to the channel") : null;
    if (link) p.append(link);
    box.replaceChildren(frame, p);
  }

  // One embed at a time. Pinterest's script turns <a data-pin-do="embedBoard"> into a board widget.
  let pinScriptLoaded = false;
  function renderBoard(board) {
    const box = $("#pin-embed");
    const embed = document.createElement("a");
    embed.href = board.url;
    embed.setAttribute("data-pin-do", "embedBoard");
    // The widget sizes itself to its container, so the panel gets an explicit width: the board width plus the panel padding.
    const avail = Math.floor(box.parentElement.clientWidth - 24);
    const width = Math.max(200, Math.min(640, avail));
    box.style.width = width + 24 + "px";
    embed.setAttribute("data-pin-board-width", String(width));
    embed.setAttribute("data-pin-scale-height", "320");
    embed.setAttribute("data-pin-scale-width", "80");
    embed.textContent = board.label + " on Pinterest";
    box.replaceChildren(embed);
    // Re-render on later switches: PinUtils.build if the script exposes it, otherwise load the script again.
    if (pinScriptLoaded && window.PinUtils && typeof window.PinUtils.build === "function") {
      window.PinUtils.build(box);
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://assets.pinterest.com/js/pinit.js";
    document.body.append(script);
    pinScriptLoaded = true;
  }

  function initPins() {
    const box = $("#pin-embed");
    const boxes = $("#boards");
    const boards = Lib.parseBoards(cfg.pinterest && cfg.pinterest.boards);
    if (!boards.length) {
      boxes.hidden = true;
      Site.unset(box, "No Pinterest boards are connected yet (a link to a specific board is needed).");
      return;
    }
    boards.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.setAttribute("aria-pressed", String(i === 0));
      btn.addEventListener("click", () => {
        boxes.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === btn)));
        renderBoard(b);
      });
      boxes.append(btn);
    });
    renderBoard(boards[0]);
  }

  initGithub();
  initYoutube();
  initPins();
})();

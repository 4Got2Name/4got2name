// Pure functions with no DOM: links, config validation, GitHub, spray. Checked separately in Node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Lib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const HEX = /^#[0-9a-f]{6}$/i;

  function parseSpotifyPlaylistId(input) {
    if (typeof input !== "string") return null;
    const s = input.trim();
    const m = s.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]{22})(?:[?/#]|$)/);
    if (m) return m[1];
    return /^[A-Za-z0-9]{22}$/.test(s) ? s : null;
  }

  // Channel ID UC... -> uploads playlist ID UU...
  function youtubeUploadsPlaylistId(channelId) {
    if (typeof channelId !== "string") return null;
    const s = channelId.trim();
    return /^UC[\w-]{22}$/.test(s) ? "UU" + s.slice(2) : null;
  }

  function isGithubUser(name) {
    return typeof name === "string" && /^[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/.test(name.trim());
  }

  function safeHttps(url) {
    if (typeof url !== "string") return null;
    try {
      const u = new URL(url.trim());
      return u.protocol === "https:" ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  function pinterestBoardUrl(input) {
    const href = safeHttps(input);
    if (!href) return null;
    const u = new URL(href);
    const hostOk = u.hostname === "pinterest.com" || u.hostname.endsWith(".pinterest.com");
    const parts = u.pathname.split("/").filter(Boolean);
    return hostOk && parts.length >= 2 ? u.href : null;
  }

  // config.music.channels -> [{ label, id (playlist ID or null), accent (hex or null) }], at most 8
  function parseChannels(list) {
    if (!Array.isArray(list)) return [];
    return list.map((c) => {
      if (!c || typeof c !== "object" || typeof c.label !== "string" || !c.label.trim()) return null;
      const accent = typeof c.accent === "string" && HEX.test(c.accent.trim()) ? c.accent.trim() : null;
      return { label: c.label.trim().slice(0, 40), id: parseSpotifyPlaylistId(c.playlist), accent };
    }).filter(Boolean).slice(0, 8);
  }

  // config.pinterest.boards -> [{ label, url }] with only valid board URLs, at most 12
  function parseBoards(list) {
    if (!Array.isArray(list)) return [];
    return list.map((b) => {
      if (!b || typeof b !== "object" || typeof b.label !== "string" || !b.label.trim()) return null;
      const url = pinterestBoardUrl(b.url);
      return url ? { label: b.label.trim().slice(0, 40), url } : null;
    }).filter(Boolean).slice(0, 12);
  }

  // Empty repositories (size 0), forks and archived ones are not shown.
  function pickRepos(repos, max) {
    if (!Array.isArray(repos)) return [];
    return repos
      .filter((r) => r && !r.fork && !r.archived && r.size > 0 &&
        typeof r.html_url === "string" && r.html_url.indexOf("https://github.com/") === 0)
      .sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)))
      .slice(0, max);
  }

  // https://soundcloud.com/<user>/<track> -> player URL for an iframe, or null for anything else.
  function soundcloudEmbedUrl(url) {
    if (typeof url !== "string") return null;
    let u;
    try { u = new URL(url.trim()); } catch (e) { return null; }
    if (u.protocol !== "https:" || (u.hostname !== "soundcloud.com" && u.hostname !== "www.soundcloud.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) return null;
    const canonical = "https://soundcloud.com/" + parts[0] + "/" + parts[1];
    return "https://w.soundcloud.com/player/?url=" + encodeURIComponent(canonical) +
      "&color=%23c9674a&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false";
  }

  // [{label, url}] -> [{label, url, embed}], dropping entries that are not a valid SoundCloud track link.
  function parseTracks(list) {
    if (!Array.isArray(list)) return [];
    return list.map((t) => {
      if (!t || typeof t.label !== "string" || !t.label.trim()) return null;
      const embed = soundcloudEmbedUrl(t.url);
      return embed ? { label: t.label.trim(), url: t.url.trim(), embed } : null;
    }).filter(Boolean);
  }

  // Spray dots spread evenly over a circle of radius r. rand is a 0..1 function (replaced in tests).
  function sprayPoints(cx, cy, r, count, rand) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = r * Math.sqrt(rand());
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    return pts;
  }

  return { parseSpotifyPlaylistId, youtubeUploadsPlaylistId, isGithubUser, safeHttps,
    pinterestBoardUrl, parseChannels, parseBoards, pickRepos, sprayPoints, soundcloudEmbedUrl, parseTracks };
});

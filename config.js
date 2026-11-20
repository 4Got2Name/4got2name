// The one place where your data lives. null / missing = not set yet (the site shows an empty state, never an invented value).
// Never put secrets here: every visitor can read this file.
//
// Sources
//  - Profile links: https://linktr.ee/4got2name, read 2026-11-19. TikTok and X are deliberately left out.
//    SoundCloud and Telegram are on Linktree without links, so they are not here either.
//  - Playlists, YouTube channel ID and Pinterest boards: sent by you on 2026-11-19.
//  - Playlist titles: read from the Spotify playlist pages on 2026-11-19 (owner: 4Got2Name).
window.SITE_CONFIG = {
  profiles: {
    spotify: "https://open.spotify.com/user/31cwnss4wi5dngsqivc2yvbmpfmy", // without the ?si= tracking parameter
    pinterest: "https://www.pinterest.com/4got2name/", // derived from your board links (user name 4got2name)
    github: "https://github.com/4got2name",
    youtube: "https://www.youtube.com/@4got2name",
    soundcloud: "https://soundcloud.com/4got2name", // sent by you on 2026-11-21
    discord: "https://discord.com/users/1238444074130735106"
  },

  // Text for the scrolling strip at the top of every page.
  ticker: [
    "ALLEGEDLY VIBE-CODED",
    "SOME PEOPLE CLAIM CLAUDE MADE THIS SITE",
    "THE DEFENDANT DENIES EVERYTHING",
    "100% HAND-MADE (WITH ASSISTANCE)",
    "FORGOT TO NAME IT, REMEMBERED TO SHIP IT",
    "NO COMMENT ON THE AI RUMORS"
  ],

  music: {
    // Your own tracks, shown on the Music page as SoundCloud players (links sent by you on 2026-11-21).
    // The labels are my reading of the URL slugs: fix them if the real titles differ.
    own: [
      { label: "Deep Down Low (tekk)", url: "https://soundcloud.com/4got2name/deep-down-low-tekk" },
      { label: "Crash Your Sound (tekk)", url: "https://soundcloud.com/4got2name/crash-your-sound-tekk" }
    ],
    // label = playlist title on Spotify. accent = my design choice: muted tones of similar brightness so switching never flashes.
    channels: [
      { label: "Rap (cloud/emo)", playlist: "https://open.spotify.com/playlist/7EAI7qzHgKelGSQt6Iqyv5", accent: "#9d93c7" },
      { label: "Rock/Metal/Indie/Punk", playlist: "https://open.spotify.com/playlist/4utJp17dAY3NnzvM8mXj13", accent: "#c9674a" },
      { label: "HARDTEKK MIX", playlist: "https://open.spotify.com/playlist/6ccJlCna1ZPmhsElZgrmXn", accent: "#a3b36b" },
      { label: "EDM House", playlist: "https://open.spotify.com/playlist/65Vpu7LntCJFohvTFdLfC9", accent: "#7fb3b0" }
    ]
  },

  pinterest: {
    boards: [
      { label: "Frutiger Aero", url: "https://www.pinterest.com/4got2name/frutiger-aero/" },
      { label: "Countryside", url: "https://www.pinterest.com/4got2name/countryside/" },
      { label: "Impressionism", url: "https://www.pinterest.com/4got2name/impressionism/" },
      { label: "VHS Effect", url: "https://www.pinterest.com/4got2name/vhs-effect/" },
      { label: "Expressionism", url: "https://www.pinterest.com/4got2name/expressionism/" }
    ]
  },

  github: {
    user: "4got2name",
    showRepos: false // false = show "Coming soon (maybe)"; true = load the repository list live from GitHub
  },

  youtube: {
    // Channel ID as you sent it. Format is valid (UC + 22 characters), but I could not open YouTube to confirm it exists.
    channelId: "UCCy2IPyHOAbft-Yca44GcJg"
  }
};

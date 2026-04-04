// ============================================================
// CodeStreak Enforcer — Background Service Worker
// Handles focus mode state, tab monitoring, and site blocking
// ============================================================

// ─── Blocked Sites List ─────────────────────────────────────
// Comprehensive list of distracting domains to block during focus mode.
// Covers social media, entertainment, gaming, news, and time-wasters.
const DEFAULT_BLOCKED_SITES = [
  // Social Media
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  "instagram.com",
  "www.instagram.com",
  "tiktok.com",
  "www.tiktok.com",
  "snapchat.com",
  "www.snapchat.com",
  "pinterest.com",
  "www.pinterest.com",
  "linkedin.com",
  "www.linkedin.com",
  "tumblr.com",
  "www.tumblr.com",
  "threads.net",
  "www.threads.net",
  "mastodon.social",
  "bsky.app",

  // Video & Streaming
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "netflix.com",
  "www.netflix.com",
  "hulu.com",
  "www.hulu.com",
  "disneyplus.com",
  "www.disneyplus.com",
  "primevideo.com",
  "www.primevideo.com",
  "hbomax.com",
  "www.hbomax.com",
  "twitch.tv",
  "www.twitch.tv",
  "crunchyroll.com",
  "www.crunchyroll.com",
  "hotstar.com",
  "www.hotstar.com",
  "jiocinema.com",
  "www.jiocinema.com",
  "sonyliv.com",
  "www.sonyliv.com",
  "zee5.com",
  "www.zee5.com",
  "voot.com",
  "www.voot.com",
  "dailymotion.com",
  "www.dailymotion.com",

  // Reddit & Forums
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
  "9gag.com",
  "www.9gag.com",
  "imgur.com",
  "www.imgur.com",
  "quora.com",
  "www.quora.com",
  "4chan.org",
  "www.4chan.org",

  // Gaming
  "store.steampowered.com",
  "steamcommunity.com",
  "epicgames.com",
  "www.epicgames.com",
  "roblox.com",
  "www.roblox.com",
  "miniclip.com",
  "www.miniclip.com",
  "poki.com",
  "www.poki.com",
  "crazygames.com",
  "www.crazygames.com",
  "chess.com",
  "www.chess.com",
  "lichess.org",

  // News & Gossip (time-sinks)
  "buzzfeed.com",
  "www.buzzfeed.com",
  "boredpanda.com",
  "www.boredpanda.com",
  "tmz.com",
  "www.tmz.com",
  "ladbible.com",
  "www.ladbible.com",

  // Messaging / Chat (non-work)
  "web.whatsapp.com",
  "web.telegram.org",
  "discord.com",
  "www.discord.com",

  // Shopping
  "amazon.com",
  "www.amazon.com",
  "amazon.in",
  "www.amazon.in",
  "flipkart.com",
  "www.flipkart.com",
  "ebay.com",
  "www.ebay.com",
  "myntra.com",
  "www.myntra.com",
  "ajio.com",
  "www.ajio.com",
  "meesho.com",
  "www.meesho.com",

  // Other Distractions
  "spotify.com",
  "open.spotify.com",
  "soundcloud.com",
  "www.soundcloud.com",
  "medium.com"  // can be distracting browsing
];

// ─── Whitelisted Study/Coding Sites ─────────────────────────
// These are NEVER blocked, even if a pattern matches.
const WHITELISTED_SITES = [
  // Coding Platforms
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "codepen.io",
  "replit.com",
  "codesandbox.io",
  "jsfiddle.net",
  "stackblitz.com",

  // Documentation
  "developer.mozilla.org",
  "devdocs.io",
  "docs.google.com",
  "docs.microsoft.com",
  "learn.microsoft.com",
  "cloud.google.com",
  "docs.aws.amazon.com",
  "docs.python.org",
  "nodejs.org",
  "reactjs.org",
  "react.dev",
  "vuejs.org",
  "angular.io",
  "developer.chrome.com",
  "web.dev",

  // Learning Platforms
  "coursera.org",
  "udemy.com",
  "edx.org",
  "khanacademy.org",
  "freecodecamp.org",
  "codecademy.com",
  "leetcode.com",
  "hackerrank.com",
  "codechef.com",
  "codeforces.com",
  "geeksforgeeks.org",
  "w3schools.com",
  "scrimba.com",
  "frontendmasters.com",
  "pluralsight.com",
  "skillshare.com",
  "brilliant.org",
  "mit.edu",
  "stanford.edu",
  "nptel.ac.in",
  "unacademy.com",

  // Developer Communities (productive)
  "stackoverflow.com",
  "stackexchange.com",
  "dev.to",
  "hashnode.dev",
  "hackernoon.com",

  // Research & Reference
  "wikipedia.org",
  "scholar.google.com",
  "arxiv.org",
  "researchgate.net",
  "sci-hub.se",

  // AI & Tools
  "chat.openai.com",
  "chatgpt.com",
  "gemini.google.com",
  "claude.ai",
  "copilot.microsoft.com",
  "notion.so",
  "figma.com",
  "canva.com",

  // Package Registries
  "npmjs.com",
  "pypi.org",
  "crates.io",
  "pub.dev",
  "packagist.org",
  "rubygems.org",
  "mvnrepository.com"
];


// ─── Initialization ─────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusMode: false,
    startTime: null,
    blockedSites: DEFAULT_BLOCKED_SITES,
    whitelistedSites: WHITELISTED_SITES,
    blockedAttempts: 0,
    totalSessions: 0,
    totalFocusTime: 0,

    // Backend integration settings (set via extension options page)
    apiBaseUrl: "http://localhost:5000",
    jwtToken: "",
    autoVerifyOnStop: true
  });
  console.log("[CodeStreak] Extension installed. Defaults initialized.");
});


// ─── Helper: Check if URL should be blocked ─────────────────
function extractHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isDomainMatch(hostname, domain) {
  // Exact match or subdomain match
  return hostname === domain || hostname.endsWith("." + domain);
}

function isWhitelisted(hostname, whitelist) {
  return whitelist.some(wl => isDomainMatch(hostname, wl));
}

function isBlocked(hostname, blockedList) {
  return blockedList.some(bl => isDomainMatch(hostname, bl));
}

async function shouldBlockUrl(url) {
  const hostname = extractHostname(url);
  if (!hostname) return false;

  const data = await chrome.storage.local.get([
    "focusMode",
    "blockedSites",
    "whitelistedSites"
  ]);

  if (!data.focusMode) return false;

  const whitelist = data.whitelistedSites || WHITELISTED_SITES;
  if (isWhitelisted(hostname, whitelist)) return false;

  const blockedList = data.blockedSites || DEFAULT_BLOCKED_SITES;
  return isBlocked(hostname, blockedList);
}

// ─── Backend Sync Helpers ───────────────────────────────────
async function getBackendConfig() {
  const data = await chrome.storage.local.get([
    "apiBaseUrl",
    "jwtToken",
    "autoVerifyOnStop"
  ]);

  const apiBaseUrl = (data.apiBaseUrl || "http://localhost:5000").replace(/\/+$/, "");
  const jwtToken = data.jwtToken || "";
  const autoVerifyOnStop = data.autoVerifyOnStop !== false;

  return { apiBaseUrl, jwtToken, autoVerifyOnStop };
}

async function fetchAuthed(cfg, path, { method, body } = {}) {
  if (!cfg.jwtToken) {
    throw new Error("Missing JWT token. Set it in the extension options page.");
  }

  const url = `${cfg.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.jwtToken}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && data.message) || res.statusText;
    throw new Error(message || `Request failed (${res.status})`);
  }

  return data;
}

async function syncFocusAndMaybeVerify(elapsedMs) {
  const cfg = await getBackendConfig();
  if (!cfg.jwtToken) return; // user not configured yet

  await fetchAuthed(cfg, "/api/focus/session", {
    method: "POST",
    body: { elapsedMs }
  });

  if (cfg.autoVerifyOnStop) {
    // PRD endpoint alias: POST /api/check (currently backed by /api/github/check)
    await fetchAuthed(cfg, "/api/check", { method: "POST", body: {} });
  }
}


// ─── Tab Monitoring ─────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const block = await shouldBlockUrl(tab.url);
    if (block) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: showBlockOverlay
        });
        // Increment blocked attempts
        const data = await chrome.storage.local.get(["blockedAttempts"]);
        await chrome.storage.local.set({
          blockedAttempts: (data.blockedAttempts || 0) + 1
        });
        console.log(`[CodeStreak] Blocked: ${tab.url}`);
      } catch (err) {
        console.warn("[CodeStreak] Could not inject overlay:", err);
      }
    }
  }
});

// Also check when a tab is activated (switched to)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const block = await shouldBlockUrl(tab.url);
      if (block) {
        await chrome.scripting.executeScript({
          target: { tabId: activeInfo.tabId },
          func: showBlockOverlay
        });
        const data = await chrome.storage.local.get(["blockedAttempts"]);
        await chrome.storage.local.set({
          blockedAttempts: (data.blockedAttempts || 0) + 1
        });
      }
    }
  } catch (err) {
    console.warn("[CodeStreak] Tab activate check failed:", err);
  }
});


// ─── Injected Function: Show Block Overlay ──────────────────
function showBlockOverlay() {
  // Prevent duplicate overlays
  if (document.getElementById("codestreak-block-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "codestreak-block-overlay";
  overlay.innerHTML = `
    <div class="cse-overlay-bg"></div>
    <div class="cse-overlay-content">
      <div class="cse-icon">🛡️</div>
      <h1 class="cse-title">Stay Focused!</h1>
      <p class="cse-subtitle">This site is blocked during your focus session.</p>
      <div class="cse-divider"></div>
      <p class="cse-message">Get back to coding. Every minute counts.</p>
      <div class="cse-pulse-ring"></div>
    </div>
  `;

  // Inline styles to guarantee visibility regardless of page CSS
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    pointer-events: all !important;
  `;

  const bg = overlay.querySelector(".cse-overlay-bg");
  bg.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, #0a0a0a 0%, #0d1117 40%, #010d05 100%);
    opacity: 0.97;
  `;

  const content = overlay.querySelector(".cse-overlay-content");
  content.style.cssText = `
    position: relative;
    text-align: center;
    color: #e6edf3;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    animation: cse-fadeIn 0.5s ease-out;
    max-width: 480px;
    padding: 40px;
  `;

  const icon = overlay.querySelector(".cse-icon");
  icon.style.cssText = `
    font-size: 72px;
    margin-bottom: 16px;
    animation: cse-bounce 2s infinite;
  `;

  const title = overlay.querySelector(".cse-title");
  title.style.cssText = `
    font-size: 36px;
    font-weight: 700;
    color: #00ff88;
    margin: 0 0 8px 0;
    text-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
    letter-spacing: -0.5px;
  `;

  const subtitle = overlay.querySelector(".cse-subtitle");
  subtitle.style.cssText = `
    font-size: 16px;
    color: #8b949e;
    margin: 0 0 24px 0;
    line-height: 1.5;
  `;

  const divider = overlay.querySelector(".cse-divider");
  divider.style.cssText = `
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, transparent, #00ff88, transparent);
    margin: 0 auto 24px auto;
    border-radius: 2px;
  `;

  const message = overlay.querySelector(".cse-message");
  message.style.cssText = `
    font-size: 14px;
    color: #58a6ff;
    margin: 0;
    font-style: italic;
  `;

  const pulseRing = overlay.querySelector(".cse-pulse-ring");
  pulseRing.style.cssText = `
    position: absolute;
    width: 200px;
    height: 200px;
    border: 2px solid rgba(0, 255, 136, 0.2);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: cse-pulse 3s ease-out infinite;
    pointer-events: none;
  `;

  // Inject keyframe animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes cse-fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes cse-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes cse-pulse {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
      100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
    }
  `;
  overlay.appendChild(style);

  // Prevent scrolling
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  document.documentElement.appendChild(overlay);
}


// ─── Message Handling (Popup ↔ Background) ──────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_FOCUS") {
    const now = Date.now();
    chrome.storage.local.get(["totalSessions"], (data) => {
      chrome.storage.local.set({
        focusMode: true,
        startTime: now,
        blockedAttempts: 0,
        totalSessions: (data.totalSessions || 0) + 1
      }, () => {
        console.log("[CodeStreak] Focus mode STARTED");
        // Block any currently open distracting tabs
        blockExistingTabs();
        sendResponse({ success: true, startTime: now });
      });
    });
    return true; // async response
  }

  if (message.action === "STOP_FOCUS") {
    chrome.storage.local.get(["startTime", "totalFocusTime"], (data) => {
      const elapsed = data.startTime ? Date.now() - data.startTime : 0;
      chrome.storage.local.set({
        focusMode: false,
        startTime: null,
        totalFocusTime: (data.totalFocusTime || 0) + elapsed
      }, () => {
        console.log("[CodeStreak] Focus mode STOPPED. Session:", elapsed, "ms");
        // Remove overlays from all tabs
        removeAllOverlays();

        // Fire-and-forget: sync this session to the backend and optionally verify streak.
        syncFocusAndMaybeVerify(elapsed).catch((err) => {
          console.warn("[CodeStreak] Backend sync failed:", err);
        });

        sendResponse({ success: true, elapsed });
      });
    });
    return true;
  }

  if (message.action === "GET_STATUS") {
    chrome.storage.local.get([
      "focusMode", "startTime", "blockedAttempts",
      "totalSessions", "totalFocusTime"
    ], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.action === "GET_SITES") {
    chrome.storage.local.get(["blockedSites", "whitelistedSites"], (data) => {
      sendResponse({
        blockedSites: data.blockedSites || DEFAULT_BLOCKED_SITES,
        whitelistedSites: data.whitelistedSites || WHITELISTED_SITES
      });
    });
    return true;
  }

  if (message.action === "UPDATE_BLOCKED_SITES") {
    chrome.storage.local.set({ blockedSites: message.sites }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "UPDATE_WHITELISTED_SITES") {
    chrome.storage.local.set({ whitelistedSites: message.sites }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "GET_STREAK_STATS") {
    getBackendConfig().then((cfg) => {
      if (!cfg.jwtToken) {
        sendResponse({ error: "Not authenticated" });
        return;
      }
      
      fetchAuthed(cfg, "/api/auth/me")
        .then((userProfile) => {
          if (!userProfile || !userProfile.githubUsername) {
            sendResponse({ error: "GitHub username not set" });
            return;
          }
          return fetchAuthed(cfg, `/api/streak/live/${userProfile.githubUsername}`);
        })
        .then((stats) => {
          if (stats) {
            sendResponse(stats);
          }
        })
        .catch((err) => {
          sendResponse({ error: err.message });
        });
    });
    return true;
  }

  if (message.action === "SET_EXTENSION_AUTH") {
    const jwtToken =
      typeof message.jwtToken === "string" ? message.jwtToken.trim() : "";

    if (!jwtToken) {
      sendResponse({ success: false, message: "Invalid token" });
      return true;
    }

    const nextState = { jwtToken };
    if (typeof message.apiBaseUrl === "string") {
      const apiBaseUrl = message.apiBaseUrl.trim().replace(/\/+$/, "");
      if (apiBaseUrl) {
        nextState.apiBaseUrl = apiBaseUrl;
      }
    }

    chrome.storage.local.set(nextState, () => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          message: chrome.runtime.lastError.message || "Failed to save auth",
        });
        return;
      }
      sendResponse({ success: true });
    });

    return true;
  }
});


// ─── Block existing open tabs when focus starts ─────────────
async function blockExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url) {
      const block = await shouldBlockUrl(tab.url);
      if (block) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showBlockOverlay
          });
        } catch (err) {
          // Can't inject into chrome:// or edge:// pages
        }
      }
    }
  }
}


// ─── Remove overlays from all tabs when focus stops ─────────
async function removeAllOverlays() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const overlay = document.getElementById("codestreak-block-overlay");
          if (overlay) overlay.remove();
          document.documentElement.style.overflow = "";
          document.body.style.overflow = "";
        }
      });
    } catch (err) {
      // Ignore tabs we can't inject into
    }
  }
}

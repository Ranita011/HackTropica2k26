// ============================================================
// CodeStreak Enforcer — Content Script
// Runs on all pages. Checks focus mode and injects overlay
// on blocked sites when navigated via SPA or direct load.
// ============================================================

(function () {
  "use strict";

  let elapsedTimerInterval = null;
  let sessionStartTime = null;

  const isLocalWebApp =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Check if this page should be blocked on initial load
  chrome.storage.local.get(
    ["focusMode", "blockedSites", "whitelistedSites"],
    (data) => {
      if (!data.focusMode) return;

      const hostname = window.location.hostname.toLowerCase();
      const blockedSites = data.blockedSites || [];
      const whitelistedSites = data.whitelistedSites || [];

      // Check whitelist first
      const isWhitelisted = whitelistedSites.some(
        (wl) => hostname === wl || hostname.endsWith("." + wl)
      );
      if (isWhitelisted) return;

      // Check blocked list
      const isBlocked = blockedSites.some(
        (bl) => hostname === bl || hostname.endsWith("." + bl)
      );
      if (isBlocked) {
        injectOverlay();
      }
    }
  );

  // Listen for messages from background to remove overlay
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "REMOVE_OVERLAY") {
      const overlay = document.getElementById("codestreak-block-overlay");
      if (overlay) {
        overlay.style.animation = "cse-fadeOut 0.3s ease-in forwards";
        setTimeout(() => {
          overlay.remove();
          setPageScrollLocked(false);
        }, 300);
      }
      stopElapsedTimer();
      sendResponse({ success: true });
    }
    if (message.action === "SHOW_OVERLAY") {
      injectOverlay();
      sendResponse({ success: true });
    }
  });

  // Web app bridge: allows localhost dashboard to push JWT into extension storage.
  if (isLocalWebApp) {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== "codestreak-web") return;
      if (data.type !== "CODESTREAK_SET_AUTH") return;

      const requestId = data.requestId;
      const payload = data.payload || {};

      const respondToWeb = (success, error = "") => {
        window.postMessage(
          {
            source: "codestreak-extension",
            type: "CODESTREAK_SET_AUTH_RESULT",
            requestId,
            success,
            ...(success ? {} : { error: error || "Unknown error" }),
          },
          "*"
        );
      };

      // If extension context is not available (disabled/reloaded), fail fast.
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        respondToWeb(false, "Extension unavailable. Reload the extension.");
        return;
      }

      try {
        chrome.runtime.sendMessage(
          {
            action: "SET_EXTENSION_AUTH",
            jwtToken: payload.jwtToken,
            apiBaseUrl: payload.apiBaseUrl,
          },
          (response) => {
            let success = false;
            let error = "Unknown error";

            if (chrome.runtime.lastError) {
              error = chrome.runtime.lastError.message || "Extension unavailable";
            } else if (response && response.success) {
              success = true;
              error = "";
            } else if (response && typeof response.message === "string") {
              error = response.message;
            }

            respondToWeb(success, error);
          }
        );
      } catch (err) {
        respondToWeb(false, err?.message || "Extension bridge error");
      }
    });
  }

  function injectOverlay() {
    // Prevent duplicate
    if (document.getElementById("codestreak-block-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "codestreak-block-overlay";
    overlay.className = "cse-block-overlay";
    overlay.innerHTML = `
      <div class="cse-overlay-bg"></div>
      <div class="cse-overlay-content">
        <div class="cse-shield-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" 
                  fill="url(#shield-grad)" stroke="#00ff88" stroke-width="0.5"/>
            <path d="M10 15.5L7.5 13L6.09 14.41L10 18.33L18 10.33L16.59 8.92L10 15.5Z" 
                  fill="#00ff88"/>
            <defs>
              <linearGradient id="shield-grad" x1="3" y1="2" x2="21" y2="24">
                <stop offset="0%" stop-color="rgba(0,255,136,0.15)"/>
                <stop offset="100%" stop-color="rgba(0,255,136,0.05)"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 class="cse-block-title">Stay Focused!</h1>
        <p class="cse-block-subtitle">This site is blocked during your focus session.</p>
        <div class="cse-block-divider"></div>
        <p class="cse-block-quote">Every line of code brings you closer to your goal.</p>
        <div class="cse-block-timer" id="cse-elapsed-timer">00:00:00</div>
        <p class="cse-block-timer-label">Focus Time Elapsed</p>
      </div>
    `;

    document.documentElement.appendChild(overlay);
    setPageScrollLocked(true);

    // Start updating the elapsed timer
    stopElapsedTimer();
    resolveSessionStartTime((startTime) => {
      sessionStartTime = startTime;
      renderElapsedTime(sessionStartTime);
      elapsedTimerInterval = setInterval(() => {
        renderElapsedTime(sessionStartTime);
      }, 1000);
    });
  }

  function stopElapsedTimer() {
    if (elapsedTimerInterval) {
      clearInterval(elapsedTimerInterval);
      elapsedTimerInterval = null;
    }
    sessionStartTime = null;
  }

  function setPageScrollLocked(locked) {
    const value = locked ? "hidden" : "";
    document.documentElement.style.overflow = value;

    if (document.body) {
      document.body.style.overflow = value;
      return;
    }

    if (locked) {
      // body might not exist at document_start; apply when DOM is ready
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          if (document.body) {
            document.body.style.overflow = "hidden";
          }
        },
        { once: true }
      );
    }
  }

  function resolveSessionStartTime(done) {
    const maxAttempts = 8;
    let attempts = 0;

    const tryResolve = () => {
      attempts += 1;

      chrome.runtime.sendMessage({ action: "GET_STATUS" }, (status) => {
        const statusStart = Number(status && status.startTime);
        if (Number.isFinite(statusStart) && statusStart > 0) {
          done(statusStart);
          return;
        }

        chrome.storage.local.get(["startTime"], (data) => {
          const localStart = Number(data && data.startTime);
          if (Number.isFinite(localStart) && localStart > 0) {
            done(localStart);
            return;
          }

          if (attempts < maxAttempts) {
            setTimeout(tryResolve, 250);
            return;
          }

          done(Date.now());
        });
      });
    };

    tryResolve();
  }

  function renderElapsedTime(startTime) {
    const el = document.getElementById("cse-elapsed-timer");
    if (!el) return;
    if (!Number.isFinite(startTime) || startTime <= 0) return;

    const elapsed = Math.max(0, Date.now() - startTime);
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    el.textContent =
      String(hours).padStart(2, "0") +
      ":" +
      String(mins).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0");
  }
})();

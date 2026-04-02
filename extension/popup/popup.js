// ============================================================
// CodeStreak Enforcer — Popup Script
// Controls focus mode, timer display, stats, and site lists
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // ─── DOM Elements ───────────────────────────────────────
  const focusBtn = document.getElementById("focusBtn");
  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const timerValue = document.getElementById("timerValue");
  const timerRing = document.getElementById("timerRing");
  const timerProgress = document.getElementById("timerProgress");
  const statusBadge = document.getElementById("statusBadge");
  const blockedCount = document.getElementById("blockedCount");
  const sessionCount = document.getElementById("sessionCount");
  const totalTime = document.getElementById("totalTime");

  // Sites lists
  const blockedSitesList = document.getElementById("blockedSitesList");
  const allowedSitesList = document.getElementById("allowedSitesList");
  const addBlockedInput = document.getElementById("addBlockedInput");
  const addBlockedBtn = document.getElementById("addBlockedBtn");
  const addAllowedInput = document.getElementById("addAllowedInput");
  const addAllowedBtn = document.getElementById("addAllowedBtn");

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");

  let timerInterval = null;
  let currentStartTime = null;

  // ─── Initialize ─────────────────────────────────────────
  loadStatus();
  loadSites();

  // ─── Timer Logic ────────────────────────────────────────
  function startTimer(startTime) {
    currentStartTime = startTime;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => updateTimerDisplay(startTime), 1000);
    updateTimerDisplay(startTime);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerValue.textContent = "00:00:00";
    timerProgress.style.strokeDashoffset = "553";
  }

  function updateTimerDisplay(startTime) {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    timerValue.textContent =
      String(hours).padStart(2, "0") +
      ":" +
      String(mins).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0");

    // Animate the ring — full circle = 1 hour cycle
    const totalSecs = hours * 3600 + mins * 60 + secs;
    const progress = (totalSecs % 3600) / 3600;
    const circumference = 553; // 2 * PI * 88
    timerProgress.style.strokeDashoffset =
      circumference - progress * circumference;
  }

  // ─── Load Status ────────────────────────────────────────
  function loadStatus() {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
      if (!response) return;

      updateStats(response);

      if (response.focusMode && response.startTime) {
        setActiveUI(true);
        startTimer(response.startTime);
      } else {
        setActiveUI(false);
      }
    });
  }

  function updateStats(data) {
    blockedCount.textContent = data.blockedAttempts || 0;
    sessionCount.textContent = data.totalSessions || 0;

    const totalMs = data.totalFocusTime || 0;
    const totalHours = totalMs / 3600000;
    if (totalHours >= 1) {
      totalTime.textContent = totalHours.toFixed(1) + "h";
    } else {
      const totalMins = Math.floor(totalMs / 60000);
      totalTime.textContent = totalMins + "m";
    }
  }

  // ─── UI State Toggle ───────────────────────────────────
  function setActiveUI(active) {
    if (active) {
      focusBtn.classList.add("active");
      btnText.textContent = "Stop Focus Mode";
      btnIcon.textContent = "■";
      timerRing.classList.add("active");
      statusBadge.classList.add("active");
      statusBadge.querySelector(".status-text").textContent = "Focusing";
    } else {
      focusBtn.classList.remove("active");
      btnText.textContent = "Start Focus Mode";
      btnIcon.textContent = "▶";
      timerRing.classList.remove("active");
      statusBadge.classList.remove("active");
      statusBadge.querySelector(".status-text").textContent = "Inactive";
    }
  }

  // ─── Focus Button Handler ──────────────────────────────
  focusBtn.addEventListener("click", () => {
    const isActive = focusBtn.classList.contains("active");

    if (isActive) {
      // Stop focus
      chrome.runtime.sendMessage({ action: "STOP_FOCUS" }, (response) => {
        if (response && response.success) {
          setActiveUI(false);
          stopTimer();
          loadStatus(); // Refresh stats
        }
      });
    } else {
      // Start focus
      chrome.runtime.sendMessage({ action: "START_FOCUS" }, (response) => {
        if (response && response.success) {
          setActiveUI(true);
          startTimer(response.startTime);
          loadStatus();
        }
      });
    }
  });

  // ─── Tabs Switching ─────────────────────────────────────
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tabName = btn.dataset.tab;
      document.querySelectorAll(".tab-content").forEach((tc) => {
        tc.classList.remove("active");
      });
      document.getElementById("tab-" + tabName).classList.add("active");
    });
  });

  // ─── Sites Management ──────────────────────────────────
  function loadSites() {
    chrome.runtime.sendMessage({ action: "GET_SITES" }, (response) => {
      if (!response) return;
      renderSitesList(
        blockedSitesList,
        response.blockedSites || [],
        "blocked"
      );
      renderSitesList(
        allowedSitesList,
        response.whitelistedSites || [],
        "allowed"
      );
    });
  }

  function renderSitesList(container, sites, type) {
    container.innerHTML = "";

    // Deduplicate — show base domain only (remove www. variants)
    const uniqueDomains = [
      ...new Set(
        sites.map((s) => s.replace(/^www\./, "")).filter((s) => s.length > 0)
      ),
    ];

    uniqueDomains.sort().forEach((domain) => {
      const item = document.createElement("div");
      item.className = "site-item";

      const domainSpan = document.createElement("span");
      domainSpan.className = "site-domain";
      domainSpan.textContent = domain;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-site-btn";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove " + domain;
      removeBtn.addEventListener("click", () => {
        removeSite(domain, type);
      });

      item.appendChild(domainSpan);
      item.appendChild(removeBtn);
      container.appendChild(item);
    });
  }

  function addSite(domain, type) {
    domain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!domain || !domain.includes(".")) return;

    const action =
      type === "blocked" ? "GET_SITES" : "GET_SITES";

    chrome.runtime.sendMessage({ action: "GET_SITES" }, (response) => {
      if (!response) return;

      let sites =
        type === "blocked"
          ? [...(response.blockedSites || [])]
          : [...(response.whitelistedSites || [])];

      // Add both bare and www. versions for blocked sites
      if (!sites.includes(domain)) {
        sites.push(domain);
      }
      const wwwDomain = "www." + domain;
      if (!sites.includes(wwwDomain) && !domain.startsWith("www.")) {
        sites.push(wwwDomain);
      }

      const updateAction =
        type === "blocked"
          ? "UPDATE_BLOCKED_SITES"
          : "UPDATE_WHITELISTED_SITES";
      const key = type === "blocked" ? "sites" : "sites";

      chrome.runtime.sendMessage(
        { action: updateAction, sites },
        () => {
          loadSites();
        }
      );
    });
  }

  function removeSite(domain, type) {
    chrome.runtime.sendMessage({ action: "GET_SITES" }, (response) => {
      if (!response) return;

      let sites =
        type === "blocked"
          ? [...(response.blockedSites || [])]
          : [...(response.whitelistedSites || [])];

      // Remove both bare and www. versions
      sites = sites.filter(
        (s) => s !== domain && s !== "www." + domain && s !== domain.replace(/^www\./, "")
      );

      const updateAction =
        type === "blocked"
          ? "UPDATE_BLOCKED_SITES"
          : "UPDATE_WHITELISTED_SITES";

      chrome.runtime.sendMessage(
        { action: updateAction, sites },
        () => {
          loadSites();
        }
      );
    });
  }

  // Add blocked site
  addBlockedBtn.addEventListener("click", () => {
    addSite(addBlockedInput.value, "blocked");
    addBlockedInput.value = "";
  });

  addBlockedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addSite(addBlockedInput.value, "blocked");
      addBlockedInput.value = "";
    }
  });

  // Add allowed site
  addAllowedBtn.addEventListener("click", () => {
    addSite(addAllowedInput.value, "allowed");
    addAllowedInput.value = "";
  });

  addAllowedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addSite(addAllowedInput.value, "allowed");
      addAllowedInput.value = "";
    }
  });
});

const elApiBaseUrl = document.getElementById("apiBaseUrl");
const elJwtToken = document.getElementById("jwtToken");
const elAutoVerify = document.getElementById("autoVerifyOnStop");
const elStatus = document.getElementById("status");
const elSaveBtn = document.getElementById("saveBtn");

function setStatus(message) {
  elStatus.textContent = message || "";
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    "apiBaseUrl",
    "jwtToken",
    "autoVerifyOnStop",
  ]);

  elApiBaseUrl.value = data.apiBaseUrl || "http://localhost:5000";
  elJwtToken.value = data.jwtToken || "";
  elAutoVerify.checked = data.autoVerifyOnStop !== false; // default true
}

async function saveSettings() {
  const apiBaseUrl = (elApiBaseUrl.value || "").trim().replace(/\/+$/, "");
  const jwtToken = (elJwtToken.value || "").trim();
  const autoVerifyOnStop = !!elAutoVerify.checked;

  if (!apiBaseUrl) {
    setStatus("API base URL is required.");
    return;
  }

  await chrome.storage.local.set({
    apiBaseUrl,
    jwtToken,
    autoVerifyOnStop,
  });

  setStatus("Saved. You can close this page.");
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch(() => setStatus("Failed to load settings."));
  elSaveBtn.addEventListener("click", () => {
    saveSettings().catch(() => setStatus("Failed to save settings."));
  });
});


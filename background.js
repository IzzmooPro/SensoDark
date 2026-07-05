const DEFAULTS = {
  enabled: true,
  automation: "manual",
  timeStart: "20:00",
  timeEnd: "07:00",
  disabledSites: []
};

async function ensureInitialized() {
  const { settings } = await chrome.storage.local.get("settings");
  const merged = {
    ...DEFAULTS,
    ...(settings || {}),
    disabledSites: Array.isArray(settings?.disabledSites) ? settings.disabledSites : []
  };
  if (merged.automation === "time") {
    merged.enabled = isInTimeRange(merged.timeStart, merged.timeEnd);
  }
  if (!settings || JSON.stringify(settings) !== JSON.stringify(merged)) {
    await chrome.storage.local.set({ settings: merged });
  }

  const alarm = await chrome.alarms.get("sensodark-time-check");
  if (!alarm) chrome.alarms.create("sensodark-time-check", { periodInMinutes: 1 });
}

// ── Install / browser startup ──
chrome.runtime.onInstalled.addListener(() => ensureInitialized());
chrome.runtime.onStartup.addListener(() => ensureInitialized());
ensureInitialized().catch(() => {});

// ── Badge ──
// Tab states live in storage.session so they survive service worker restarts
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "TAB_STATE" && sender.tab && sender.frameId === 0) {
    chrome.storage.session.set({ ["tab_" + sender.tab.id]: msg.active });
    updateBadge(sender.tab.id, msg.active);
  }
  if (msg.type === "SYSTEM_DARK_MODE") {
    handleSystemDarkMode(msg.isDark);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const key = "tab_" + tabId;
  const data = await chrome.storage.session.get(key);
  if (data[key] !== undefined) {
    updateBadge(tabId, data[key]);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove("tab_" + tabId);
});

function updateBadge(tabId, active) {
  chrome.action.setBadgeText({ text: active ? "" : "OFF", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#555", tabId });
}

// ── Feature 5: Keyboard shortcuts ──
chrome.commands.onCommand.addListener(async (command) => {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) return;

  if (command === "toggle-dark") {
    settings.enabled = !settings.enabled;
    await chrome.storage.local.set({ settings });
  }

  if (command === "toggle-site") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    try {
      const hostname = new URL(tab.url).hostname;
      const sites = settings.disabledSites || [];
      const idx = sites.indexOf(hostname);
      if (idx >= 0) {
        sites.splice(idx, 1);
      } else {
        sites.push(hostname);
      }
      settings.disabledSites = sites;
      await chrome.storage.local.set({ settings });
    } catch (_) {}
  }
});

async function handleSystemDarkMode(isDark) {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings || settings.automation !== "system") return;
  if (settings.enabled !== isDark) {
    settings.enabled = isDark;
    await chrome.storage.local.set({ settings });
  }
}

// ── Feature 6: Time-based automation ──
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "sensodark-time-check") return;

  const { settings } = await chrome.storage.local.get("settings");
  if (!settings || settings.automation !== "time") return;

  const shouldBeEnabled = isInTimeRange(settings.timeStart, settings.timeEnd);
  if (settings.enabled !== shouldBeEnabled) {
    settings.enabled = shouldBeEnabled;
    await chrome.storage.local.set({ settings });
  }
});

function isInTimeRange(startStr, endStr) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const current = h * 60 + m;

  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  // Same start and end means the whole day
  if (start === end) return true;

  if (start <= end) {
    return current >= start && current < end;
  }
  // Wraps midnight (e.g., 20:00 - 07:00)
  return current >= start || current < end;
}

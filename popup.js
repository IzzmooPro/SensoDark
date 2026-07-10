document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();

  document.getElementById("versionLabel").textContent =
    "v" + chrome.runtime.getManifest().version;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch (_) {}

  const DEFAULTS = {
    enabled: true,
    automation: "manual",
    timeStart: "20:00",
    timeEnd: "07:00",
    intensity: "medium",
    disabledSites: [],
    userDarkSites: [],
  };

  const { settings } = await chrome.storage.sync.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };

  const $ = (id) => document.getElementById(id);

  const globalToggle = $("globalToggle");
  const siteToggle = $("siteToggle");
  const currentHost = $("currentHost");
  const expandBtn = $("expandBtn");
  const expandArrow = $("expandArrow");
  const siteList = $("siteList");
  const siteCount = $("siteCount");
  const resetBtn = $("resetBtn");
  const settingsBtn = $("settingsBtn");
  const autoManual = $("autoManual");
  const autoSystem = $("autoSystem");
  const autoTime = $("autoTime");
  const autoDesc = $("autoDesc");
  const timeInputs = $("timeInputs");
  const timeStart = $("timeStart");
  const timeEnd = $("timeEnd");
  const statusText = $("statusText");
  const scannerState = $("scannerState");
  const intButtons = [$("intSoft"), $("intMedium"), $("intDeep")];
  const reDetectBtn = $("reDetectBtn");
  const markDarkBtn = $("markDarkBtn");
  const markDarkLabel = $("markDarkLabel");

  const AUTO_DESC_KEYS = {
    manual: "autoDescManual",
    system: "autoDescSystem",
    time: "autoDescTime",
  };

  let localSettings = JSON.parse(JSON.stringify(s));
  let saving = false;

  // Initialize UI
  globalToggle.checked = s.enabled;
  siteToggle.checked = !s.disabledSites.includes(hostname);
  currentHost.textContent = hostname || "—";
  timeStart.value = s.timeStart || "20:00";
  timeEnd.value = s.timeEnd || "07:00";
  setActiveAuto(s.automation || "manual");
  setActiveIntensity(s.intensity || "medium");
  setMarkDarkState(s.userDarkSites.includes(hostname));
  renderSiteList(s.disabledSites);
  setControlsState(s.enabled);
  updateScannerState();

  function save(patch) {
    Object.assign(localSettings, patch);
    saving = true;
    const nextSettings = { ...localSettings };
    chrome.storage.sync.set({ settings: nextSettings }, () => {
      saving = false;
      applyToCurrentTab(nextSettings);
    });
  }

  async function applyToCurrentTab(settings) {
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) return;

    try {
      await chrome.tabs.sendMessage(
        tab.id,
        { type: "APPLY_SETTINGS", settings },
        { frameId: 0 }
      );
    } catch (_) {
      // Tabs that were already open when the extension was installed, reloaded
      // or re-enabled do not have a content script until they are refreshed.
      // Inject it into the active page so toggling works without a reload.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [0] },
          files: ["dark-sites.js", "content.js"],
        });
      } catch (_) {}
    }
  }

  // Keep UI in sync when settings change elsewhere (shortcut, alarm, system, sync)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.settings || saving) return;
    const next = changes.settings.newValue;
    if (!next) return;
    localSettings = { ...DEFAULTS, ...next };
    globalToggle.checked = !!next.enabled;
    siteToggle.checked = !(next.disabledSites || []).includes(hostname);
    timeStart.value = next.timeStart || "20:00";
    timeEnd.value = next.timeEnd || "07:00";
    setActiveAuto(next.automation || "manual");
    setActiveIntensity(next.intensity || "medium");
    setMarkDarkState((next.userDarkSites || []).includes(hostname));
    renderSiteList(next.disabledSites || []);
    setControlsState(!!next.enabled);
  });

  // ── Toggle events ──

  globalToggle.addEventListener("change", () => {
    save({ enabled: globalToggle.checked });
    setControlsState(globalToggle.checked);
  });

  siteToggle.addEventListener("change", () => {
    let sites = [...(localSettings.disabledSites || [])];
    if (siteToggle.checked) {
      sites = sites.filter((h) => h !== hostname);
    } else if (!sites.includes(hostname)) {
      sites.push(hostname);
    }
    save({ disabledSites: sites });
    renderSiteList(sites);
  });

  // ── Intensity ──

  intButtons.forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      const level = btn.dataset.intensity;
      setActiveIntensity(level);
      save({ intensity: level });
    });
  });

  // ── Re-detect / mark dark ──

  reDetectBtn.addEventListener("click", async () => {
    if (!tab || !tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "RE_DETECT" }, { frameId: 0 });
    } catch (_) {}
    setTimeout(updateScannerState, 400);
  });

  markDarkBtn.addEventListener("click", () => {
    let list = [...(localSettings.userDarkSites || [])];
    const has = list.includes(hostname);
    if (has) {
      list = list.filter((h) => h !== hostname);
    } else if (hostname) {
      list.push(hostname);
    }
    save({ userDarkSites: list });
    setMarkDarkState(!has);
    setTimeout(updateScannerState, 400);
  });

  // ── Automation ──

  autoManual.addEventListener("click", () => {
    setActiveAuto("manual");
    save({ automation: "manual" });
  });

  autoSystem.addEventListener("click", () => {
    setActiveAuto("system");
    const enabled = matchMedia("(prefers-color-scheme: dark)").matches;
    globalToggle.checked = enabled;
    setControlsState(enabled);
    save({ automation: "system", enabled });
  });

  autoTime.addEventListener("click", () => {
    setActiveAuto("time");
    syncTimeAutomation();
  });

  timeStart.addEventListener("change", () => {
    save({ timeStart: timeStart.value });
    if (localSettings.automation === "time") syncTimeAutomation();
  });

  timeEnd.addEventListener("change", () => {
    save({ timeEnd: timeEnd.value });
    if (localSettings.automation === "time") syncTimeAutomation();
  });

  // ── Expand / Reset / Settings ──

  expandBtn.addEventListener("click", () => {
    const open = siteList.classList.toggle("expanded");
    expandArrow.innerHTML = open ? "&#9662;" : "&#9656;";
  });

  resetBtn.addEventListener("click", () => {
    const def = JSON.parse(JSON.stringify(DEFAULTS));
    localSettings = { ...def };
    chrome.storage.sync.set({ settings: def });
    globalToggle.checked = true;
    siteToggle.checked = true;
    timeStart.value = "20:00";
    timeEnd.value = "07:00";
    setActiveAuto("manual");
    setActiveIntensity("medium");
    setMarkDarkState(false);
    renderSiteList([]);
    setControlsState(true);
  });

  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  const donateBtn = $("donateBtn");
  donateBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Helpers ──

  async function updateScannerState() {
    scannerState.className = "scanner-state";
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      scannerState.textContent = msg("scannerUnavailable");
      scannerState.classList.add("warn");
      return;
    }
    if ((localSettings || s).userDarkSites && (localSettings || s).userDarkSites.includes(hostname)) {
      scannerState.textContent = msg("scannerUserDark");
      scannerState.classList.add("warn");
      return;
    }
    try {
      const d = await chrome.tabs.sendMessage(tab.id, { type: "GET_DIAGNOSTICS" }, { frameId: 0 });
      if (d.knownDarkSite) {
        scannerState.textContent = msg("scannerKnownDark");
        scannerState.classList.add("warn");
      } else if (d.pageDarkDetected) {
        scannerState.textContent = msg("scannerDetectedDark");
        scannerState.classList.add("warn");
      } else if (d.stylePresent) {
        scannerState.textContent = msg("scannerActive", [String(d.scannedElements)]);
        scannerState.classList.add("ok");
      } else {
        scannerState.textContent = msg("scannerNoStyle");
        scannerState.classList.add("error");
      }
    } catch (_) {
      scannerState.textContent = msg("scannerNoAccess");
      scannerState.classList.add("error");
    }
  }

  function syncTimeAutomation() {
    const [sh, sm] = timeStart.value.split(":").map(Number);
    const [eh, em] = timeEnd.value.split(":").map(Number);
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    // Same start and end means the whole day (matches background.js)
    const enabled = start === end
      ? true
      : start <= end
        ? current >= start && current < end
        : current >= start || current < end;

    globalToggle.checked = enabled;
    setControlsState(enabled);
    save({ automation: "time", timeStart: timeStart.value, timeEnd: timeEnd.value, enabled });
  }

  function setActiveAuto(auto) {
    autoManual.classList.toggle("active", auto === "manual");
    autoSystem.classList.toggle("active", auto === "system");
    autoTime.classList.toggle("active", auto === "time");
    autoDesc.textContent = msg(AUTO_DESC_KEYS[auto] || "autoDescManual");
    timeInputs.style.display = auto === "time" ? "flex" : "none";
  }

  function setActiveIntensity(level) {
    intButtons.forEach((btn) => {
      if (btn) btn.classList.toggle("active", btn.dataset.intensity === level);
    });
  }

  function setMarkDarkState(on) {
    markDarkBtn.classList.toggle("active", on);
    markDarkBtn.setAttribute("aria-pressed", on ? "true" : "false");
    markDarkLabel.textContent = on ? msg("unmarkDark") : msg("markDark");
  }

  function renderSiteList(sites) {
    siteCount.textContent = sites.length;
    siteList.innerHTML = "";
    sites.forEach((site) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = site;
      const btn = document.createElement("button");
      btn.className = "remove-site";
      btn.textContent = "✕";
      btn.addEventListener("click", () => {
        const updated = (localSettings.disabledSites || []).filter((h) => h !== site);
        save({ disabledSites: updated });
        renderSiteList(updated);
        if (site === hostname) siteToggle.checked = true;
      });
      li.append(span, btn);
      siteList.appendChild(li);
    });
  }

  function setControlsState(enabled) {
    document.body.classList.toggle("is-off", !enabled);
    statusText.textContent = enabled ? msg("statusOn") : msg("statusOff");
    // Automation must remain configurable while the extension is currently
    // off (for example, outside a scheduled time range).
    document.querySelectorAll(".site-toggle, .intensity-card").forEach((el) => {
      el.classList.toggle("disabled", !enabled);
    });
  }
});

// ── i18n ──

function msg(key, subs) {
  try {
    const m = chrome.i18n.getMessage(key, subs);
    if (m) return m;
  } catch (_) {}
  return key;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = msg(key);
    if (text && text !== key) el.textContent = text;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch (_) {}

  const { settings } = await chrome.storage.local.get("settings");
  const s = settings || {
    enabled: true,
    automation: "manual",
    timeStart: "20:00",
    timeEnd: "07:00",
    disabledSites: [],
  };

  const $ = (id) => document.getElementById(id);

  const globalToggle = $("globalToggle");
  const siteToggle = $("siteToggle");
  const currentHost = $("currentHost");
  const expandBtn = $("expandBtn");
  const expandArrow = $("expandArrow");
  const siteList = $("siteList");
  const siteCount = $("siteCount");
  const resetBtn = $("resetBtn");
  const autoManual = $("autoManual");
  const autoSystem = $("autoSystem");
  const autoTime = $("autoTime");
  const autoDesc = $("autoDesc");
  const timeInputs = $("timeInputs");
  const timeStart = $("timeStart");
  const timeEnd = $("timeEnd");
  const statusText = $("statusText");
  const scannerState = $("scannerState");

  const AUTO_DESCS = {
    manual: "Kendin aç/kapa",
    system: "Windows temasını takip et",
    time: "Belirlenen saatlerde otomatik"
  };

  // Initialize UI
  globalToggle.checked = s.enabled;
  siteToggle.checked = !s.disabledSites.includes(hostname);
  currentHost.textContent = hostname || "—";
  timeStart.value = s.timeStart || "20:00";
  timeEnd.value = s.timeEnd || "07:00";
  setActiveAuto(s.automation || "manual");
  renderSiteList(s.disabledSites);
  setControlsState(s.enabled);
  updateScannerState();

  let localSettings = JSON.parse(JSON.stringify(s));
  let saving = false;

  function save(patch) {
    Object.assign(localSettings, patch);
    saving = true;
    chrome.storage.local.set({ settings: { ...localSettings } }, () => {
      saving = false;
    });
  }

  // Keep UI in sync when settings change elsewhere (shortcut, alarm, system)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings || saving) return;
    const next = changes.settings.newValue;
    if (!next) return;
    localSettings = JSON.parse(JSON.stringify(next));
    globalToggle.checked = !!next.enabled;
    siteToggle.checked = !(next.disabledSites || []).includes(hostname);
    timeStart.value = next.timeStart || "20:00";
    timeEnd.value = next.timeEnd || "07:00";
    setActiveAuto(next.automation || "manual");
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

  // ── Expand / Reset ──

  expandBtn.addEventListener("click", () => {
    const open = siteList.classList.toggle("expanded");
    expandArrow.innerHTML = open ? "&#9662;" : "&#9656;";
  });

  resetBtn.addEventListener("click", () => {
    const def = {
      enabled: true,
      automation: "manual",
      timeStart: "20:00",
      timeEnd: "07:00",
      disabledSites: [],
    };
    localSettings = { ...def };
    chrome.storage.local.set({ settings: def });
    globalToggle.checked = true;
    siteToggle.checked = true;
    timeStart.value = "20:00";
    timeEnd.value = "07:00";
    setActiveAuto("manual");
    renderSiteList([]);
    setControlsState(true);
  });

  // ── Helpers ──

  async function updateScannerState() {
    scannerState.className = "scanner-state";
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      scannerState.textContent = "Bu sayfada kullanılamaz";
      scannerState.classList.add("warn");
      return;
    }
    try {
      const d = await chrome.tabs.sendMessage(tab.id, { type: "GET_DIAGNOSTICS" }, { frameId: 0 });
      if (d.knownDarkSite) {
        scannerState.textContent = "Bilinen koyu site · atlandı";
        scannerState.classList.add("warn");
      } else if (d.pageDarkDetected) {
        scannerState.textContent = "Koyu tema algılandı · atlandı";
        scannerState.classList.add("warn");
      } else if (d.stylePresent) {
        scannerState.textContent = "Scanner aktif · " + d.scannedElements + " öğe";
        scannerState.classList.add("ok");
      } else {
        scannerState.textContent = "Stil uygulanmadı";
        scannerState.classList.add("error");
      }
    } catch (_) {
      scannerState.textContent = "Sayfaya erişilemiyor";
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
    autoDesc.textContent = AUTO_DESCS[auto] || "";
    timeInputs.style.display = auto === "time" ? "flex" : "none";
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
    statusText.textContent = enabled ? "Açık" : "Kapalı";
    document.querySelectorAll(".site-toggle, .automation-card").forEach((el) => {
      el.classList.toggle("disabled", !enabled);
    });
  }
});

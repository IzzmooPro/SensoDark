const DEFAULTS = {
  enabled: true,
  automation: "manual",
  timeStart: "20:00",
  timeEnd: "07:00",
  intensity: "medium",
  disabledSites: [],
  userDarkSites: [],
};

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

const $ = (id) => document.getElementById(id);
let toastTimer = null;

function showToast(text, kind) {
  const toast = $("toast");
  toast.textContent = text;
  toast.className = "toast " + (kind || "");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.textContent = "";
    toast.className = "toast";
  }, 3500);
}

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}

function renderList(elId, key, settings) {
  const el = $(elId);
  const items = settings[key] || [];
  el.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = msg("emptyList");
    el.appendChild(li);
    return;
  }
  items.forEach((site) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = site;
    const btn = document.createElement("button");
    btn.className = "rm";
    btn.textContent = msg("removeBtn");
    btn.addEventListener("click", async () => {
      const current = await getSettings();
      current[key] = (current[key] || []).filter((h) => h !== site);
      await chrome.storage.sync.set({ settings: current });
      renderAll(current);
    });
    li.append(span, btn);
    el.appendChild(li);
  });
}

function renderAll(settings) {
  renderList("userDarkList", "userDarkSites", settings);
  renderList("disabledList", "disabledSites", settings);
}

async function init() {
  applyI18n();
  const settings = await getSettings();
  renderAll(settings);

  $("exportBtn").addEventListener("click", async () => {
    const current = await getSettings();
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sensodark-settings.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(msg("exportSuccess"), "ok");
  });

  $("copyBtcBtn").addEventListener("click", async () => {
    const addr = $("btcAddr").textContent.trim();
    const label = $("copyBtcLabel");
    try {
      await navigator.clipboard.writeText(addr);
    } catch (_) {
      // Fallback for older browsers / permission edge cases
      const r = document.createRange();
      r.selectNodeContents($("btcAddr"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { document.execCommand("copy"); } catch (e) {}
      sel.removeAllRanges();
    }
    const original = label.textContent;
    label.textContent = msg("copiedMsg");
    setTimeout(() => { label.textContent = original; }, 1800);
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());

  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        const merged = {
          ...DEFAULTS,
          ...parsed,
          disabledSites: Array.isArray(parsed.disabledSites) ? parsed.disabledSites : [],
          userDarkSites: Array.isArray(parsed.userDarkSites) ? parsed.userDarkSites : [],
        };
        await chrome.storage.sync.set({ settings: merged });
        renderAll(merged);
        showToast(msg("importSuccess"), "ok");
      } catch (_) {
        showToast(msg("importError"), "err");
      }
      e.target.value = "";
    };
    reader.onerror = () => showToast(msg("importError"), "err");
    reader.readAsText(file);
  });

  // Reflect external changes (e.g. edits from the popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings && changes.settings.newValue) {
      renderAll({ ...DEFAULTS, ...changes.settings.newValue });
    }
  });
}

init();

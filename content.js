(function () {
  "use strict";

  // The popup can inject the content scripts into a tab that was already open
  // when the extension was enabled. Avoid duplicate observers if this frame is
  // already initialized.
  if (globalThis.__sensoDarkLoaded) return;
  globalThis.__sensoDarkLoaded = true;

  var STYLE_ID = "sensodark-style";
  var FALLBACK_ID = "sensodark-fallback";
  var PRELOAD_READY_ATTR = "data-sensodark-preload-ready";
  var SCAN_ATTR = "data-sensodark-scanned";
  var BEFORE_BG_ATTR = "data-sensodark-before-bg";
  var AFTER_BG_ATTR = "data-sensodark-after-bg";
  var BEFORE_FILTER_ATTR = "data-sensodark-before-filter";
  var AFTER_FILTER_ATTR = "data-sensodark-after-filter";
  var HOVER_ATTR = "data-sensodark-hover";
  var HOVER_BG_VAR = "--sensodark-hover-bg";
  // Inverts luminance while rotating hue back, which keeps brand colors much
  // closer to their original hue than a plain invert filter.
  var ASSET_FILTER = "invert(1) hue-rotate(180deg) brightness(1.15)";
  var hostname = location.hostname;

  var C = {
    base:      "#1a1b1e",
    surface1:  "#212328",
    surface2:  "#2a2d34",
    text:      "#c9c5be",
    textBright:"#e3e0da",
    textDim:   "#8a857e",
    border:    "#35383f",
    link:      "#7cacf8",
    linkVisit: "#b89cf8",
    accent:    "#7c5cfc",
    raised:    "#32363e"
  };

  // ── Darkness intensity ──
  // Scales every surface target luminance and the page base. 1 = default.
  var BASE_RGB = [26, 27, 30];
  var INTENSITY = { soft: 1.42, medium: 1, deep: 0.74 };
  var intensityScale = 1;
  var appliedIntensity = null;

  function effectiveBase() {
    var s = intensityScale;
    return rgb(
      Math.min(BASE_RGB[0] * s, 60),
      Math.min(BASE_RGB[1] * s, 60),
      Math.min(BASE_RGB[2] * s, 62)
    );
  }

  // ══════════════════════════════════════════
  // Known dark sites — skip entirely
  // ══════════════════════════════════════════
  function matchesDarkPattern(pattern) {
    var host = location.hostname;
    var path = location.pathname;

    // Trailing "$" anchors the path: match it exactly instead of by prefix
    var exact = false;
    if (pattern.charAt(pattern.length - 1) === "$") {
      exact = true;
      pattern = pattern.slice(0, -1);
    }

    if (pattern.substring(0, 2) === "*.") {
      var base = pattern.substring(2);
      return host === base || host.endsWith("." + base);
    }

    var hostMatches = function (pHost) {
      return host === pHost || host === "www." + pHost || "www." + host === pHost;
    };

    var stripSlash = function (p) {
      return p.length > 1 && p.charAt(p.length - 1) === "/" ? p.slice(0, -1) : p;
    };

    if (pattern.indexOf("*") === -1) {
      var slash = pattern.indexOf("/");
      if (slash === -1) return hostMatches(pattern);

      if (!hostMatches(pattern.slice(0, slash))) return false;
      var pPath = stripSlash(pattern.slice(slash));
      var curPath = stripSlash(path);
      if (curPath === pPath) return true;
      return !exact && curPath.indexOf(pPath + "/") === 0;
    }

    var target = pattern.indexOf("/") !== -1 ? stripSlash(host + path) : host;
    var escaped = stripSlash(pattern)
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp("^(?:www\\.)?" + escaped + (exact ? "$" : "(?:/.*)?$")).test(target);
  }

  var isKnownDarkSite = false;
  if (typeof DARK_SITES !== "undefined") {
    for (var i = 0; i < DARK_SITES.length; i++) {
      if (matchesDarkPattern(DARK_SITES[i])) {
        isKnownDarkSite = true;
        break;
      }
    }
  }

  // ══════════════════════════════════════════
  // Feature 4: White flash prevention
  // Use sessionStorage (synchronous) to apply dark bg IMMEDIATELY
  // ══════════════════════════════════════════
  var SESSION_KEY = "__sensodark_active";
  try {
    if (!isKnownDarkSite && sessionStorage.getItem(SESSION_KEY) === "1") {
      var fb = document.createElement("style");
      fb.id = FALLBACK_ID;
      fb.textContent = "html,body{background-color:" + C.base + " !important;color-scheme:dark !important;color:" + C.text + " !important}";
      (document.head || document.documentElement).appendChild(fb);
    }
  } catch (_) {}

  // ══════════════════════════════════════════
  // CSS builders
  // ══════════════════════════════════════════
  function buildSmartCSS() {
    var base = effectiveBase();
    return [
      ":root{color-scheme:dark !important}",
      "html{background-color:" + base + " !important;color:" + C.text + " !important}",
      "body{background-color:" + base + " !important;color:" + C.text + " !important}",

      // Keep the site's hierarchy and brand colors; the scanner handles surfaces.
      "input,textarea,select,button,option{color-scheme:dark}",
      "mark{background-color:transparent !important;color:inherit !important}",

      "input:focus,textarea:focus,select:focus{border-color:" + C.accent + " !important;outline:none !important}",

      // Feature 3: Autofill color fix
      "input:-webkit-autofill,textarea:-webkit-autofill,select:-webkit-autofill{" +
      "background-color:" + C.surface2 + " !important;" +
      "color:" + C.text + " !important;" +
      "-webkit-text-fill-color:" + C.text + " !important;" +
      "box-shadow:0 0 0 1000px " + C.surface2 + " inset !important;" +
      "transition:background-color 5000s ease-in-out 0s !important}",

      "pre{background-color:" + C.surface1 + " !important;color:" + C.text + " !important}",
      "code{background-color:rgba(255,255,255,0.06) !important;color:" + C.textBright + " !important}",
      "pre code{background-color:transparent !important}",

      "::selection{background:rgba(124,92,252,0.3) !important;color:#fff !important}",
      "::placeholder{color:#9a978f !important;opacity:1 !important}",

      "::-webkit-scrollbar{background:" + base + ";width:10px}",
      "::-webkit-scrollbar-thumb{background:" + C.border + ";border-radius:5px}",
      "::-webkit-scrollbar-thumb:hover{background:#50535a}",
      "::-webkit-scrollbar-track{background:" + base + "}",

      "hr{border-color:" + C.border + " !important;background-color:" + C.border + " !important}",

      "[" + BEFORE_BG_ATTR + "]::before{background-color:var(--sensodark-before-bg) !important}",
      "[" + AFTER_BG_ATTR + "]::after{background-color:var(--sensodark-after-bg) !important}",

      "[" + BEFORE_FILTER_ATTR + "]::before{filter:" + ASSET_FILTER + " !important}",
      "[" + AFTER_FILTER_ATTR + "]::after{filter:" + ASSET_FILTER + " !important}",

      "[" + HOVER_ATTR + "]:hover{background-color:var(" + HOVER_BG_VAR + ") !important}",

      // Media pixels must not blend with the darkened parent surface.
      "img,video,canvas,picture,svg,iframe,embed,object,[role='img']{" +
      "color:initial !important;mix-blend-mode:normal !important}"
    ].join("\n");
  }

  function buildCSS() {
    if (isKnownDarkSite) return "";
    return buildSmartCSS();
  }

  // ══════════════════════════════════════════
  // Feature 1: Dark theme detection
  // ══════════════════════════════════════════
  function isPageAlreadyDark() {
    if (isKnownDarkSite) return true;
    if (!document.body) return false;

    var xs = [0.15, 0.5, 0.85];
    var ys = [0.16, 0.36, 0.56, 0.76, 0.9];
    var dark = 0;
    var light = 0;

    for (var y = 0; y < ys.length; y++) {
      for (var x = 0; x < xs.length; x++) {
        var el = document.elementFromPoint(
          Math.max(1, Math.floor(window.innerWidth * xs[x])),
          Math.max(1, Math.floor(window.innerHeight * ys[y]))
        );
        var info = null;
        while (el && !info) {
          info = getColorInfo(getComputedStyle(el).backgroundColor);
          el = el.parentElement;
        }
        if (!info) continue;
        if (info.lum < 70) dark++;
        else if (info.lum > 115) light++;
      }
    }

    var decisive = dark + light;
    if (decisive >= 6) return dark / decisive >= 0.7;

    var bodyInfo = getColorInfo(getComputedStyle(document.body).backgroundColor);
    var htmlInfo = getColorInfo(getComputedStyle(document.documentElement).backgroundColor);
    var fallback = bodyInfo || htmlInfo;
    return !!fallback && fallback.lum < 55;
  }

  // ══════════════════════════════════════════
  // Smart scanner
  // ══════════════════════════════════════════
  var SKIP_TAGS = {
    IMG:1, VIDEO:1, CANVAS:1, SVG:1, IFRAME:1, PICTURE:1,
    SOURCE:1, BR:1, HR:1, SCRIPT:1, STYLE:1, LINK:1, META:1, HEAD:1, NOSCRIPT:1
  };

  var INLINE_TAGS = {
    SPAN:1, A:1, B:1, STRONG:1, EM:1, I:1, U:1, S:1, MARK:1,
    SMALL:1, SUB:1, SUP:1, ABBR:1, CITE:1, DFN:1, TIME:1,
    LABEL:1, Q:1, VAR:1, KBD:1, SAMP:1, BDO:1, BDI:1, DATA:1,
    DEL:1, INS:1, FONT:1, WBR:1
  };

  var originalStyles = new WeakMap();
  var shadowRoots = new Set();
  var shadowStyles = new Map();
  var observerEntries = [];
  var scannerActive = false;

  function setTrackedStyle(el, property, value) {
    var properties = originalStyles.get(el);
    if (!properties) {
      properties = {};
      originalStyles.set(el, properties);
    }
    if (!properties[property]) {
      properties[property] = {
        value: el.style.getPropertyValue(property),
        priority: el.style.getPropertyPriority(property),
        applied: value
      };
    } else {
      properties[property].applied = value;
    }
    el.style.setProperty(property, value, "important");
  }

  function restoreTrackedStyles(element) {
    var properties = originalStyles.get(element);
    if (properties) {
      Object.keys(properties).forEach(function (property) {
        var previous = properties[property];
        if (element.style.getPropertyValue(property) !== previous.applied ||
            element.style.getPropertyPriority(property) !== "important") return;
        if (previous.value) {
          element.style.setProperty(property, previous.value, previous.priority);
        } else {
          element.style.removeProperty(property);
        }
      });
      originalStyles.delete(element);
    }
    element.removeAttribute(SCAN_ATTR);
    element.removeAttribute(BEFORE_BG_ATTR);
    element.removeAttribute(AFTER_BG_ATTR);
    element.removeAttribute(BEFORE_FILTER_ATTR);
    element.removeAttribute(AFTER_FILTER_ATTR);
    element.removeAttribute(HOVER_ATTR);
  }

  function getLuminance(color) {
    var info = getColorInfo(color);
    return info ? info.lum : -1;
  }

  function getColorInfo(color) {
    if (!color || color === "transparent") return null;
    var r, g, b;
    var m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (m) {
      if (m[4] !== undefined && Number(m[4]) === 0) return null;
      r = Number(m[1]);
      g = Number(m[2]);
      b = Number(m[3]);
    } else {
      // Wide-gamut colors: color(srgb 1 0.5 0 / 0.8)
      var c = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
      if (!c || (c[4] !== undefined && Number(c[4]) === 0)) return null;
      r = Math.round(Number(c[1]) * 255);
      g = Math.round(Number(c[2]) * 255);
      b = Math.round(Number(c[3]) * 255);
    }
    return {
      r: r,
      g: g,
      b: b,
      lum: (r * 299 + g * 587 + b * 114) / 1000,
      chroma: Math.max(r, g, b) - Math.min(r, g, b)
    };
  }

  function rgb(r, g, b) {
    return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
  }

  function darkenColor(info, targetLuminance) {
    var scale = targetLuminance / Math.max(info.lum, 1);
    return rgb(info.r * scale, info.g * scale, info.b * scale);
  }

  function brightenText(info) {
    var amount = info.chroma > 35 ? 0.58 : 0.72;
    return rgb(
      info.r + (255 - info.r) * amount,
      info.g + (255 - info.g) * amount,
      info.b + (255 - info.b) * amount
    );
  }

  function chooseSurface(el, style, rect, info) {
    var tag = el.tagName;
    var radius = Number((style.borderRadius || "0").split("px")[0]) || 0;
    var isControl = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
      tag === "BUTTON" || tag === "FORM";
    var isPageLayer = (el === document.body) ||
      (rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.55 && radius < 2);

    if (info.chroma > 55 && info.lum < 170) return null;
    if (info.chroma > 55) return darkenColor(info, 90);
    if (isControl) return darkenColor(info, 46 * intensityScale);
    if (isPageLayer) return darkenColor(info, 27 * intensityScale);
    if (radius >= 3 || style.boxShadow !== "none" || tag === "LI") {
      return darkenColor(info, 40 * intensityScale);
    }
    return darkenColor(info, 33 * intensityScale);
  }

  // Light, low-chroma gradients (white→gray sheens etc.) stay bright on the
  // darkened page; drop them and let the surface color take over. Colorful
  // brand gradients are kept, same as chooseSurface keeps brand colors.
  function adjustGradient(el, style, bgInfo) {
    var image = style.backgroundImage;
    if (!image || image === "none" || image.indexOf("gradient") === -1) return;
    if (image.indexOf("url(") !== -1) return;

    var stops = image.match(/rgba?\([^)]+\)|color\(srgb[^)]+\)/g);
    if (!stops) return;
    var lum = 0;
    var chroma = 0;
    var count = 0;
    for (var i = 0; i < stops.length; i++) {
      var info = getColorInfo(stops[i]);
      if (info) {
        lum += info.lum;
        chroma += info.chroma;
        count++;
      }
    }
    if (!count) return;
    lum /= count;
    chroma /= count;
    if (lum <= 120 || chroma > 50) return;

    setTrackedStyle(el, "background-image", "none");
    if (!bgInfo || bgInfo.lum <= 80) {
      setTrackedStyle(el, "background-color", C.surface1);
    }
    if (!el.getAttribute(SCAN_ATTR)) el.setAttribute(SCAN_ATTR, "g");
  }

  function hasAssetHint(el) {
    var hint = [
      el.id || "",
      typeof el.className === "string" ? el.className : "",
      el.getAttribute("title") || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("role") || ""
    ].join(" ").toLowerCase();
    return /(logo|brand|icon|symbol|avatar|account|profile|search|menu|heart|favorite|wishlist|bell|notification)/.test(hint);
  }

  // The nearest painted background behind an element, following the already
  // darkened inline styles the scanner applied to ancestors.
  function effectiveBackdrop(el) {
    var chain = el;
    var info = null;
    while (chain && !info) {
      info = getColorInfo(getComputedStyle(chain).backgroundColor);
      chain = chain.parentElement;
    }
    return info;
  }

  // Small logos and UI icons are often delivered as CSS background sprites.
  // Dark pixels in those assets can disappear after their parent surface is
  // darkened. Rescue likely UI assets without touching photos or large banners.
  function adjustBackgroundAsset(el, style, rect) {
    var image = style.backgroundImage;
    if (!image || image === "none" || image.indexOf("url(") === -1) return;
    if (style.filter && style.filter !== "none") return;
    if (!rect || rect.width < 10 || rect.height < 10 || rect.width > 260 || rect.height > 120) return;
    // Visible text would get inverted along with the sprite; text pushed
    // off-screen (image-replacement pattern) is fine.
    if ((el.textContent || "").trim() && parseFloat(style.textIndent) > -999) return;

    var tag = el.tagName;
    var href = tag === "A" ? (el.getAttribute("href") || "") : "";
    var rootLink = tag === "A" && (href === "/" || href === location.origin || href === location.origin + "/");
    if (!hasAssetHint(el) && !rootLink) return;

    var parentInfo = el.parentElement && effectiveBackdrop(el.parentElement);
    if (!parentInfo || parentInfo.lum > 90) return;

    setTrackedStyle(el, "filter", ASSET_FILTER);
    if (!el.getAttribute(SCAN_ATTR)) el.setAttribute(SCAN_ATTR, "a");
  }

  // Icons drawn as ::before/::after sprites (common image-replacement pattern)
  // have no element of their own to filter; tag the host instead and let our
  // stylesheet invert just the pseudo box.
  function adjustPseudoAsset(el, pseudo, attribute) {
    var style = getComputedStyle(el, pseudo);
    if (!style || style.content === "none") return;
    var image = style.backgroundImage;
    if (!image || image === "none" || image.indexOf("url(") === -1) return;
    if (style.filter && style.filter !== "none") return;
    var w = parseFloat(style.width);
    var h = parseFloat(style.height);
    if (!w || !h || w < 10 || h < 10 || w > 260 || h > 120) return;
    // Icon-sized pseudos qualify on their own; larger artwork needs the same
    // semantic hint the element version demands.
    if ((w > 64 || h > 64) && !hasAssetHint(el)) return;

    var backdrop = effectiveBackdrop(el);
    if (!backdrop || backdrop.lum > 90) return;

    el.setAttribute(attribute, "true");
    if (!el.getAttribute(SCAN_ATTR)) el.setAttribute(SCAN_ATTR, "a");
  }

  function adjustTextColor(el, style) {
    var info = getColorInfo(style.color);
    if (info && info.lum < 115) {
      setTrackedStyle(el, "color", brightenText(info));
    }
  }

  function adjustBorder(el, style) {
    var width = Number((style.borderTopWidth || "0").replace("px", "")) || 0;
    var info = getColorInfo(style.borderTopColor);
    if (width > 0 && info && info.lum > 115 && info.chroma < 45) {
      setTrackedStyle(el, "border-color", C.border);
    }
  }

  function adjustPseudoBackground(el, pseudo, attribute, property, elementStyle) {
    var style = getComputedStyle(el, pseudo);
    if (!style || style.content === "none" || style.backgroundImage !== "none") return;
    var info = getColorInfo(style.backgroundColor);
    if (!info || info.lum <= 80) return;
    var surface = chooseSurface(el, elementStyle, el.getBoundingClientRect(), info);
    if (!surface) return;
    setTrackedStyle(el, property, surface);
    el.setAttribute(attribute, "true");
    // Pseudo backgrounds are adjusted before the regular element size check.
    // Mark the host immediately so even tiny elements are restored on disable.
    if (!el.getAttribute(SCAN_ATTR)) el.setAttribute(SCAN_ATTR, "p");
  }

  function scanElement(el) {
    if (!el || !el.tagName) return;
    if (el.shadowRoot) registerShadowRoot(el.shadowRoot);
    if (SKIP_TAGS[el.tagName]) return;
    if (el.id === STYLE_ID || el.id === FALLBACK_ID) return;
    if (el.getAttribute(SCAN_ATTR)) return;

    var isInline = INLINE_TAGS[el.tagName];
    var style = getComputedStyle(el);
    adjustPseudoBackground(el, "::before", BEFORE_BG_ATTR, "--sensodark-before-bg", style);
    adjustPseudoBackground(el, "::after", AFTER_BG_ATTR, "--sensodark-after-bg", style);
    adjustPseudoAsset(el, "::before", BEFORE_FILTER_ATTR);
    adjustPseudoAsset(el, "::after", AFTER_FILTER_ATTR);

    if (isInline) {
      var inlineRect = el.getBoundingClientRect();
      adjustTextColor(el, style);
      var inlineInfo = getColorInfo(style.backgroundColor);
      if (inlineInfo && inlineInfo.lum > 80) {
        var inlineSurface = chooseSurface(el, style, inlineRect, inlineInfo);
        if (inlineSurface) setTrackedStyle(el, "background-color", inlineSurface);
      }
      adjustGradient(el, style, inlineInfo);
      adjustBackgroundAsset(el, style, inlineRect);
      adjustBorder(el, style);
      el.setAttribute(SCAN_ATTR, "i");
      return;
    }

    var rect = el.getBoundingClientRect();
    // 0×0 means hidden (dropdown menus, modals, lazy-rendered panels): theme
    // those now so they are already dark when the site reveals them. Keep
    // skipping genuinely tiny visible elements.
    var isHidden = rect.width === 0 && rect.height === 0;
    if (!isHidden && (rect.width < 30 || rect.height < 20)) return;

    var bgInfo = getColorInfo(style.backgroundColor);
    if (bgInfo && bgInfo.lum > 80) {
      var surface = chooseSurface(el, style, rect, bgInfo);
      if (surface) {
        setTrackedStyle(el, "background-color", surface);
        el.setAttribute(SCAN_ATTR, "b");
      }
    }
    adjustGradient(el, style, bgInfo);
    adjustBackgroundAsset(el, style, rect);

    adjustTextColor(el, style);
    adjustBorder(el, style);

    var shadow = style.boxShadow;
    if (shadow && shadow !== "none") {
      var sLum = getLuminance(shadow);
      if (sLum > 100) {
        setTrackedStyle(el, "box-shadow", "0 2px 10px rgba(0,0,0,0.35)");
      }
    }

    if (!el.getAttribute(SCAN_ATTR)) el.setAttribute(SCAN_ATTR, "n");
  }

  function scanPage() {
    if (!document.body) return;
    scanElement(document.body);
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      scanElement(all[i]);
    }
    clearObserverRecords();
  }

  // Sites often introduce light backgrounds only on :hover (menu items, icon
  // buttons), which a static scan can never see. mouseover fires before the
  // hover state is painted, so darkening here is invisible to the user. The
  // override lives in a :hover rule so the element still looks untouched when
  // the pointer leaves.
  function onPointerOver(e) {
    if (!scannerActive || pageDarkDetected) return;
    var el = e.target;
    for (var depth = 0; el && el.nodeType === 1 && depth < 4; el = el.parentElement, depth++) {
      // Only elements the scanner fully processed: a light background on one
      // of those is hover-induced, since static light backgrounds were
      // already darkened with inline !important styles.
      if (SKIP_TAGS[el.tagName] || el.getAttribute(HOVER_ATTR) || !el.getAttribute(SCAN_ATTR)) continue;
      var style = getComputedStyle(el);
      var info = getColorInfo(style.backgroundColor);
      if (!info || info.lum <= 80) continue;
      var surface = chooseSurface(el, style, el.getBoundingClientRect(), info);
      if (!surface) continue;
      setTrackedStyle(el, HOVER_BG_VAR, surface);
      el.setAttribute(HOVER_ATTR, "true");
    }
  }
  document.addEventListener("mouseover", onPointerOver, true);

  function scanTree(root, force) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 11)) return;
    if (root.nodeType === 1) {
      if (force && root.getAttribute(SCAN_ATTR)) restoreTrackedStyles(root);
      scanElement(root);
    }
    var children = root.querySelectorAll("*");
    for (var i = 0; i < children.length; i++) {
      if (force && children[i].getAttribute(SCAN_ATTR)) restoreTrackedStyles(children[i]);
      scanElement(children[i]);
    }
  }

  function ensureShadowStyle(root) {
    var style = shadowStyles.get(root);
    if (!style || !style.isConnected) {
      style = document.createElement("style");
      style.setAttribute("data-sensodark-shadow", "true");
      root.appendChild(style);
      shadowStyles.set(root, style);
    }
    style.textContent = buildCSS();
  }

  function registerShadowRoot(root) {
    if (!root || shadowRoots.has(root)) return;
    shadowRoots.add(root);
    if (!scannerActive) return;
    ensureShadowStyle(root);
    scanTree(root, false);
    observeRoot(root);
  }

  var scanTimer = null;
  var pendingRoots = new Map();
  function scheduleScan(root, force) {
    if (root && (root.nodeType === 1 || root.nodeType === 11)) {
      pendingRoots.set(root, !!force || pendingRoots.get(root) === true);
    }
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      var entries = Array.from(pendingRoots.entries());
      pendingRoots.clear();
      for (var i = 0; i < entries.length; i++) {
        var root = entries[i][0];
        var connected = root.nodeType === 11 ? root.host && root.host.isConnected : root.isConnected;
        if (connected) scanTree(root, entries[i][1]);
      }
      clearObserverRecords();
      cleanupDetachedShadowRoots();
    }, 300);
  }

  // ══════════════════════════════════════════
  // Core logic
  // ══════════════════════════════════════════
  var pageDarkDetected = false;
  var darkDetectionDone = false;

  function removeFallback() {
    var fb = document.getElementById(FALLBACK_ID);
    if (fb) fb.remove();
  }

  function resolvePreload() {
    if (document.documentElement) {
      document.documentElement.setAttribute(PRELOAD_READY_ATTR, "true");
    }
  }

  function applyLoadingFallback() {
    if (isKnownDarkSite) return;
    var fb = document.getElementById(FALLBACK_ID);
    if (!fb) {
      fb = document.createElement("style");
      fb.id = FALLBACK_ID;
      (document.head || document.documentElement).appendChild(fb);
    }
    fb.textContent = "html,body{background-color:" + C.base + " !important;color-scheme:dark !important}";
  }

  function applyStyle(settings) {
    removeFallback();
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      el.setAttribute("data-sensodark", "true");
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = buildCSS();
    shadowRoots.forEach(function (root) {
      if (root.host && root.host.isConnected) ensureShadowStyle(root);
    });

    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (_) {}
  }

  function removeStyle() {
    scannerActive = false;
    stopObservers();
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    pendingRoots.clear();

    removeFallback();
    var el = document.getElementById(STYLE_ID);
    if (el) el.remove();

    restoreScannedElements(document);
    shadowRoots.forEach(function (root) {
      restoreScannedElements(root);
      var style = shadowStyles.get(root);
      if (style) style.remove();
    });
    shadowRoots.clear();
    shadowStyles.clear();

    try { sessionStorage.setItem(SESSION_KEY, "0"); } catch (_) {}
  }

  function restoreScannedElements(root) {
    var scanned = root.querySelectorAll("[" + SCAN_ATTR + "]");
    for (var i = 0; i < scanned.length; i++) {
      restoreTrackedStyles(scanned[i]);
    }
  }

  function isActive(settings) {
    if (!settings || !settings.enabled) return false;
    return !(settings.disabledSites || []).includes(hostname);
  }

  function observeRoot(root) {
    for (var i = 0; i < observerEntries.length; i++) {
      if (observerEntries[i].root === root) return;
    }
    var target = root === document ? document.documentElement : root;
    if (!target) return;
    var observer = new MutationObserver(function (mutations) {
      if (pageDarkDetected) return;
      var scannedImmediately = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "attributes") {
          scheduleScan(mutations[i].target, true);
          continue;
        }
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var added = mutations[i].addedNodes[j];
          if (added && (added.nodeType === 1 || added.nodeType === 11)) {
            scanTree(added, false);
            scannedImmediately = true;
          }
        }
      }
      if (scannedImmediately) clearObserverRecords();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
    observerEntries.push({ root: root, observer: observer });
  }

  function startObservers() {
    observeRoot(document);
    shadowRoots.forEach(function (root) { observeRoot(root); });
  }

  function clearObserverRecords() {
    for (var i = 0; i < observerEntries.length; i++) {
      observerEntries[i].observer.takeRecords();
    }
  }

  function cleanupDetachedShadowRoots() {
    var kept = [];
    for (var i = 0; i < observerEntries.length; i++) {
      var entry = observerEntries[i];
      if (entry.root === document || (entry.root.host && entry.root.host.isConnected)) {
        kept.push(entry);
      } else {
        entry.observer.disconnect();
        shadowRoots.delete(entry.root);
        shadowStyles.delete(entry.root);
      }
    }
    observerEntries = kept;
  }

  function stopObservers() {
    for (var i = 0; i < observerEntries.length; i++) {
      observerEntries[i].observer.disconnect();
    }
    observerEntries = [];
  }

  function update(settings) {
    var active = isActive(settings);
    if (active) {
      if (!darkDetectionDone && document.readyState === "loading") {
        applyLoadingFallback();
        try {
          chrome.runtime.sendMessage({ type: "TAB_STATE", active: active, hostname: hostname });
        } catch (_) {}
        return;
      }

      // Feature 1: Detect dark theme BEFORE applying our styles (only once)
      if (!darkDetectionDone && document.body) {
        removeFallback();
        var existingStyle = document.getElementById(STYLE_ID);
        if (existingStyle) existingStyle.remove();
        // Neutralize the preload background first, or detection samples our
        // own dark color and misreads a light page as already dark
        resolvePreload();
        pageDarkDetected = isPageAlreadyDark();
        darkDetectionDone = true;
      }

      var userDark = (settings.userDarkSites || []).indexOf(hostname) !== -1;
      if (pageDarkDetected || isKnownDarkSite || userDark) {
        removeStyle();
      } else {
        scannerActive = true;
        var wanted = settings.intensity || "medium";
        var newScale = INTENSITY[wanted] || 1;
        // Re-theming with a new intensity: drop old surfaces before rescanning
        if (appliedIntensity !== null && appliedIntensity !== wanted) {
          restoreScannedElements(document);
          shadowRoots.forEach(function (root) { restoreScannedElements(root); });
        }
        intensityScale = newScale;
        appliedIntensity = wanted;
        applyStyle(settings);
        if (document.body) scanPage();
        shadowRoots.forEach(function (root) {
          if (root.host && root.host.isConnected) scanTree(root, false);
        });
        startObservers();
      }
    } else {
      removeStyle();
    }
    try {
      chrome.runtime.sendMessage({ type: "TAB_STATE", active: active, hostname: hostname });
    } catch (_) {}
    resolvePreload();
  }

  // ══════════════════════════════════════════
  // Feature 2: System dark mode tracking
  // ══════════════════════════════════════════
  function setupSystemDarkModeListener() {
    try {
      var mq = matchMedia("(prefers-color-scheme: dark)");
      var handler = function (e) {
        try {
          chrome.runtime.sendMessage({ type: "SYSTEM_DARK_MODE", isDark: e.matches });
        } catch (_) {}
      };
      if (mq.addEventListener) {
        mq.addEventListener("change", handler);
      } else if (mq.addListener) {
        mq.addListener(handler);
      }
      handler({ matches: mq.matches });
    } catch (_) {}
  }
  setupSystemDarkModeListener();

  // ══════════════════════════════════════════
  // Initialize
  // ══════════════════════════════════════════
  chrome.storage.sync.get("settings", function (result) {
    if (result.settings) update(result.settings);
    else {
      removeFallback();
      resolvePreload();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      chrome.storage.sync.get("settings", function (result) {
        if (result.settings) update(result.settings);
      });
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync" && changes.settings) {
      update(changes.settings.newValue);
    }
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message) return;

    if (message.type === "APPLY_SETTINGS") {
      update(message.settings);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "RE_DETECT") {
      // Forget the earlier verdict and re-run detection from scratch. Useful
      // when the site toggled its own theme after we already made a decision.
      darkDetectionDone = false;
      pageDarkDetected = false;
      removeStyle();
      chrome.storage.sync.get("settings", function (result) {
        if (result.settings) update(result.settings);
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type !== "GET_DIAGNOSTICS") return;
    sendResponse({
      connected: true,
      hostname: hostname,
      readyState: document.readyState,
      knownDarkSite: isKnownDarkSite,
      pageDarkDetected: pageDarkDetected,
      detectionDone: darkDetectionDone,
      stylePresent: !!document.getElementById(STYLE_ID),
      scannedElements: document.querySelectorAll("[" + SCAN_ATTR + "]").length,
      shadowRoots: shadowRoots.size
    });
  });
})();

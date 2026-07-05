// ══════════════════════════════════════════════════════════════════
// SensoDark — "already dark" site overrides
//
// SensoDark detects dark pages automatically at runtime (see
// isPageAlreadyDark in content.js). This list is an OPTIONAL manual
// override for the rare cases where auto-detection guesses wrong.
//
// It starts empty on purpose: this is YOUR list. Add a site only after
// you have seen it misbehave, so the data here is entirely your own.
//
// Users can also mark the current site as "already dark" straight from
// the popup — no code editing needed.
//
// Pattern formats supported by matchesDarkPattern (content.js):
//   "example.com"            → the domain (and its www.)
//   "*.example.com"          → the domain and every subdomain
//   "example.com/app"        → that path and anything under it
//   "example.com/app/$"      → ONLY that exact path (trailing "$" = exact)
//   "example.*"              → any TLD (example.com, example.net, …)
// ══════════════════════════════════════════════════════════════════
var DARK_SITES = [];

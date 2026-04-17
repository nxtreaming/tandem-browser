// Shared theme management for all Tandem shell HTML documents.
// Load via: <script src="js/theme.js"></script>
//
// Responsibilities:
//   - applyTheme(theme): set document.documentElement[data-theme] correctly
//   - readInitialTheme(): read the pre-paint hint the preload stamped onto <html>
//   - loadThemeFromConfig(): fetch /config and apply (uses correct config.appearance.theme path)
//   - subscribe to the 'tandem-theme' BroadcastChannel for live updates
//
// Works both as a classic <script> (exposes window.TandemTheme)
// and as an ES module (exports for vitest tests).

const VALID_THEMES = new Set(['dark', 'light', 'system']);
const INITIAL_ATTR = 'data-tandem-initial-theme';
const CONFIG_URL = 'http://localhost:8765/config';
const BC_NAME = 'tandem-theme';

export function applyTheme(theme) {
  if (!VALID_THEMES.has(theme)) return;
  const html = document.documentElement;
  if (theme === 'light') html.setAttribute('data-theme', 'light');
  else if (theme === 'system') html.setAttribute('data-theme', 'system');
  else html.removeAttribute('data-theme'); // dark is the CSS default
}

export function readInitialTheme() {
  const v = document.documentElement.getAttribute(INITIAL_ATTR);
  return VALID_THEMES.has(v) ? v : null;
}

export async function loadThemeFromConfig() {
  try {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) return;
    const config = await res.json();
    const theme = config?.appearance?.theme || config?.theme || 'dark';
    applyTheme(theme);
  } catch {
    // API not ready — leave whatever the preload stamped in place.
  }
}

export function subscribeToBroadcasts() {
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (e) => {
      if (e?.data?.theme) applyTheme(e.data.theme);
    };
    return bc;
  } catch {
    return null;
  }
}

export function init() {
  // Preload has already stamped <html data-theme="..."> for no-flash paint.
  // We still call loadThemeFromConfig() after load to catch any drift
  // (e.g. user changed setting in another window and this page was reopened).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void loadThemeFromConfig());
  } else {
    void loadThemeFromConfig();
  }
  subscribeToBroadcasts();
}

// Expose as a global for classic <script> loads.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const api = { applyTheme, readInitialTheme, loadThemeFromConfig, subscribeToBroadcasts, init };
  window.TandemTheme = api;
  // Auto-init in browser context (not in vitest, where fetch is mocked per test).
  if (!window.__TANDEM_THEME_SUPPRESS_AUTOINIT__) {
    try { init(); } catch { /* ignore */ }
  }
}

# Changelog

## [0.4.0] — 2026-02-11 — Bugfixes + Phase 2.4 & 2.5: Voice Input + Live Co-Pilot Feed

### Fixed
- **📸 Screenshot Snap** — `snap-for-kees` IPC handler was missing → added compositing pipeline:
  - webview `capturePage()` + canvas overlay → composite PNG
  - Copy to clipboard via `clipboard.writeImage()`
  - Save to `~/Pictures/Tandem/tandem-{url-slug}-{timestamp}.png`
  - Save to app screenshots dir
  - Base64 preview in Kees panel Screenshots tab
- **💬 Chat** — `chat-send` IPC handler was missing → Robin's messages now route through main process to PanelManager and appear in chat
- **Duplicate `/activity-log` route** — removed old panelManager route, use activityTracker

### Added
- **Voice Input 🎙️** (`src/voice/recognition.ts`) — Web Speech API in the SHELL
  - Language: nl-BE, continuous recognition with interim results
  - Hotkey: Cmd+M → start/stop listening
  - Pulsing red dot indicator in Kees panel chat
  - Live transcription display during speech
  - Final transcript sent as Robin's chat message (prefixed with 🎙️)
  - API: `POST /voice/start`, `POST /voice/stop`, `GET /voice/status`
- **Live Co-Pilot Feed 👁️** (`src/activity/tracker.ts`) — event tracking
  - Webview events: `did-navigate`, `did-navigate-in-page`, `loading-start`, `loading-stop`
  - All events forwarded via IPC to ActivityTracker → PanelManager → Kees panel
  - API: `GET /activity-log` with `limit` and `since` query params
  - Auto-snapshot on navigation (disabled by default, configurable)
- **New IPC channels**: `voice-toggle`, `voice-transcript`, `voice-transcript-display`, `voice-status-update`, `activity-webview-event`, `auto-snapshot-request`

### Security
- Voice recognition runs in Electron shell, NOT in webview — websites cannot detect it
- Activity tracking uses Electron webview events, NOT injected DOM observers

## [0.3.0] — 2026-02-11 — Phase 2.2 & 2.3: Kees Panel + Draw Tool

### Added
- **Kees Panel** (`src/panel/manager.ts`) — side panel for AI-human communication
  - Activity log: real-time feed of navigation, clicks, scrolls, input events
  - Chat interface: Robin ↔ Kees messaging
  - Screenshot preview section
  - Resizable panel with Cmd+K toggle
- **Draw/Annotatie Tool** (`src/draw/overlay.ts`) — annotation overlay
  - Transparent canvas overlay ABOVE webview (anti-detect: shell layer)
  - Tools: arrows, circles, rectangles, freehand lines, text
  - Colors: red (default), yellow, green, blue
  - "📸 Snap voor Kees" — composite screenshot (webview + annotations) → PNG
  - Auto-clear annotations after snap
  - Screenshots stored in app userData/screenshots/
  - Cmd+D toggle draw mode
- **New API endpoints**: `GET /activity-log`, `POST /panel/toggle`, `GET/POST /chat`, `GET/POST /screenshot/annotated`, `POST /draw/toggle`, `GET /screenshots`
- **New IPC channels**: panel-toggle, activity-event, chat-message, chat-send, draw-mode, draw-clear, screenshot-taken, snap-for-kees
- Activity tracking on all API actions (navigate, click, type, scroll)

### Security
- Panel and draw overlay are in the Electron shell layer — invisible to website JavaScript
- No DOM injection into webview — websites cannot detect Kees' presence

## [0.2.0] — 2026-02-11 — Phase 2.1: Tabs & Anti-Detect Input

### Added
- **Tab Manager** (`src/tabs/manager.ts`) — multi-tab support with open/close/focus/group
- **Tab Bar UI** — favicon, title, close button per tab, new tab button (+)
- **Tab Groups** — group tabs with custom names and colors
- **API endpoints**: `POST /tabs/open`, `POST /tabs/close`, `GET /tabs/list`, `POST /tabs/focus`, `POST /tabs/group`
- **Keyboard shortcuts**: Cmd+T (new tab), Cmd+W (close tab), Cmd+1-9 (switch tabs)
- **Humanized input module** (`src/input/humanized.ts`) — gaussian random delays

### Changed
- **BREAKING (anti-detect)**: `/click` now uses `webContents.sendInputEvent()` instead of `el.click()` — produces `Event.isTrusted = true`
- **BREAKING (anti-detect)**: `/type` now uses `sendInputEvent({type:'char'})` per character instead of `el.value =` — produces trusted keyboard events
- **`/scroll`** now uses `sendInputEvent({type:'mouseWheel'})` instead of `window.scrollBy()`
- **`/screenshot`** now captures from active tab's webContents instead of main window
- All API endpoints now operate on the active tab via TabManager (backward compatible)
- Refactored API server to use direct webContents access instead of nested executeJavaScript chains

### Fixed
- Click events are no longer detectable by `Event.isTrusted` checks
- Type events are no longer detectable by missing keyboard event sequences

## [0.1.0] — 2026-02-10 — Phase 1: Core

### Added
- Electron browser with Chromium webview
- HTTP API on localhost:8765 (13 endpoints)
- Anti-detect stealth layer (UA, headers, navigator patches)
- Persistent sessions (cookies survive restart)
- Copilot alert system (macOS notification + in-browser overlay)
- URL bar with smart input
- Dark theme UI

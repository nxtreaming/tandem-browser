# TAB SNOOZING — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Suspendeer inactieve tabs om geheugen vrij te maken — handmatig (rechtermuisklik) en automatisch (na X minuten inactiviteit)
> **Volgorde:** Fase 1 → 2 (elke fase is één sessie)

---

## Waarom deze feature?

Elke open tab verbruikt 50-300MB geheugen. Met 20+ tabs wordt Tandem traag. Opera snoozet inactieve tabs automatisch. Tab Snoozing navigeert inactieve tabs naar `about:blank` (geheugen vrij) en herlaadt de oorspronkelijke URL bij klik. Dit is de #9 prioriteit in de gap analyse (docs/research/gap-analysis.md).

---

## Architectuur in 30 seconden

```
Rechtermuisklik tab → "Snooze for 1h"
       ↓
  POST /tabs/:id/snooze {duration: '1h'}
       ↓
  SnoozeManager.snooze(tabId)
       ↓
  1. Sla URL + titel + favicon op in snoozedTabs Map
  2. Navigeer webview naar about:blank (freed geheugen)
  3. Set timer voor auto-wake (als duration opgegeven)
  4. IPC → shell: toon 💤 icoon op tab
       ↓
  Klik op snoozed tab
       ↓
  SnoozeManager.wake(tabId)
       ↓
  1. Navigeer webview terug naar opgeslagen URL
  2. Verwijder uit snoozedTabs
  3. IPC → shell: verwijder 💤 icoon
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
| `src/tabs/manager.ts` | TabManager — tab lifecycle, getTab(), webContents access | `class TabManager` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **about:blank voor snooze** — navigeer webview naar `about:blank` om geheugen vrij te maken. Geen `webContents.destroy()` (niet beschikbaar voor webview tags in Electron).
2. **Sla altijd URL + titel + favicon op** — vóór snooze, sla alle info op die nodig is om de tab visueel correct te tonen en te herstellen.
3. **Pinned tabs nooit auto-snoozen** — alleen handmatige snooze voor pinned tabs.
4. **Functienamen > regelnummers** — verwijs altijd naar `function registerSnoozeRoutes()`, nooit naar "regel 99"

---

## Manager Wiring — hoe nieuwe component registreren

Elke nieuwe manager moet op **3 plekken** worden aangesloten:

### 1. `src/registry.ts` — `ManagerRegistry` interface

```typescript
export interface ManagerRegistry {
  // ... bestaande managers ...
  snoozeManager: SnoozeManager;  // ← toevoegen
}
```

### 2. `src/main.ts` — `startAPI()` functie

```typescript
// Na tabManager aanmaak:
const snoozeManager = new SnoozeManager(win, tabManager!);

// In registry object:
snoozeManager: snoozeManager!,
```

### 3. `src/main.ts` — `app.on('will-quit')` handler

```typescript
if (snoozeManager) snoozeManager.destroy();
```

---

## API Endpoint Patroon — kopieer exact

```typescript
// ═══════════════════════════════════════════════
// TAB SNOOZING — Memory management via tab suspension
// ═══════════════════════════════════════════════

router.post('/tabs/:id/snooze', async (req: Request, res: Response) => {
  try {
    const tabId = parseInt(req.params.id, 10);
    const result = await ctx.snoozeManager.snooze(tabId, req.body);
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
| `fase-1-snooze-backend.md` | SnoozeManager + discard + auto-snooze timer + API | 📋 Klaar om te starten |
| `fase-2-ui.md` | 💤 icoon, rechtermuisklik menu, snooze indicator | ⏳ Wacht op fase 1 |

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

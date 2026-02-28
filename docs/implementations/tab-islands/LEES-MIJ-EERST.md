# Tab Islands — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Automatische visuele groepering van gerelateerde tabs in eilanden, met collapse/expand en naamgeving
> **Volgorde:** Fase 1 → 2 (elke fase is één sessie)

---

## Waarom deze feature?

Robin opent regelmatig meerdere tabs vanuit dezelfde pagina (zoekresultaten, Reddit threads, documentatie). Die tabs staan nu los in de tab bar zonder visueel verband. Tab Islands groeperen deze tabs automatisch in herkenbare eilanden met kleur, naam, en collapse-functie. Zie `docs/research/gap-analysis.md` sectie "Tab Islands" voor de volledige Opera vergelijking.

---

## Architectuur in 30 seconden

```
  webContents 'did-create-window'
         │
         ▼
  TabManager.trackOpener(childId, parentId)
         │
         ▼
  autoGroupTabs() → eiland aanmaken/uitbreiden
         │
         ├──► REST API: GET /tabs/islands, POST .../collapse, etc.
         │
         └──► IPC: 'island-updated' → Shell UI
                                         │
                                         ▼
                                  Tab bar: .tab-island gap + label + collapse
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, manager registratie, window events | `createWindow()`, `startAPI()` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Opener tracking via Electron events** — gebruik `webContents` `'did-create-window'` event in het main process. NOOIT iets injecteren in de webview om parent-child relaties te detecteren.
2. **Eilanden zijn een uitbreiding van bestaande groups** — bouw voort op de bestaande `TabGroup` interface en `setGroup()` in `class TabManager`. Breek bestaande `POST /tabs/group` niet.
3. **Functienamen > regelnummers** — verwijs altijd naar `function registerTabRoutes()`, nooit naar "regel 51".
4. **Geen nieuwe npm packages** — dit is puur TypeScript + HTML/CSS.

---

## Manager Wiring — geen nieuwe manager nodig

Tab Islands breiden de bestaande `TabManager` uit — er is **geen nieuwe manager** nodig. De island-logica wordt toegevoegd als methodes op `class TabManager` in `src/tabs/manager.ts`.

### Bestaande wiring hergebruiken:

1. `src/api/server.ts` → `TandemAPIOptions` bevat al `registry: ManagerRegistry` met `tabManager`
2. `src/api/routes/tabs.ts` → `function registerTabRoutes()` krijgt nieuwe island-endpoints
3. `src/main.ts` → `createWindow()` krijgt de `did-create-window` listener

---

## API Endpoint Patroon — kopieer exact

```typescript
// In function registerTabRoutes():

router.get('/tabs/islands', async (_req: Request, res: Response) => {
  try {
    const islands = ctx.tabManager.getIslands();
    res.json({ ok: true, islands });
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
| `fase-1-auto-grouping.md` | Backend: opener tracking, island data model, API endpoints | 📋 Klaar om te starten |
| `fase-2-visual-ui.md` | Shell UI: visuele eilanden met gap, label, kleur, collapse | ⏳ Wacht op fase 1 |

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

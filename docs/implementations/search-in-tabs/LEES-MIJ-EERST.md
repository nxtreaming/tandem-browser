# Search in Tabs — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Ctrl+Space zoek-overlay om snel open tabs te vinden op titel/URL, inclusief recent gesloten tabs
> **Volgorde:** Fase 1 (één sessie, compleet)

---

## Waarom deze feature?

Bij 20+ tabs is visueel scannen van de tab bar te traag. Robin weet vaak wél een keyword uit de titel of URL, maar kan de tab niet vinden. Een zoek-overlay met real-time filtering is de snelste manier om naar elke tab te springen. Zie `docs/research/gap-analysis.md` sectie "Search in Tabs" en `docs/research/opera-complete-inventory.md` sectie 1.6 voor de Opera referentie.

---

## Architectuur in 30 seconden

```
  Ctrl+Space → toggle #tab-search-overlay
         │
         ▼
  fetch() GET /tabs/list → alle open tabs
  fetch() GET /tabs/closed → recent gesloten
         │
         ▼
  Client-side filter op input.value
  ├── match titel (case-insensitive)
  └── match URL (case-insensitive)
         │
         ▼
  Klik of Enter → POST /tabs/focus (open tab)
                → POST /tabs/open  (gesloten tab heropenen)
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, keyboard shortcut registratie | `createWindow()` |
| `src/api/server.ts` | TandemAPI class | `class TandemAPI`, `setupRoutes()` |

### Per fase aanvullend te lezen

_(zie fase-1-search-overlay.md)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Puur shell UI** — dit is bijna volledig een shell/index.html feature. De enige backend-aanpassing is één nieuw endpoint (`GET /tabs/closed`).
2. **Geen npm packages** — het zoekfilter is simpele string matching in JavaScript. Geen fuzzy search library nodig.
3. **Keyboard-first** — de overlay moet volledig bedienbaar zijn met toetsenbord: Ctrl+Space open/sluit, pijltjes navigeren, Enter selecteert, Escape sluit.
4. **Functienamen > regelnummers** — verwijs naar `function registerTabRoutes()`, nooit regelnummers.

---

## Manager Wiring — minimaal

Er is **geen nieuwe manager** nodig. Eén klein nieuw endpoint toevoegen:

1. `src/tabs/manager.ts` → `class TabManager` → publiek maken van `closedTabs` via nieuwe methode `getClosedTabs()`
2. `src/api/routes/tabs.ts` → `function registerTabRoutes()` → `GET /tabs/closed`
3. `shell/index.html` → volledige overlay UI + JS

---

## API Endpoint Patroon — kopieer exact

```typescript
// In function registerTabRoutes():

router.get('/tabs/closed', async (_req: Request, res: Response) => {
  try {
    const closed = ctx.tabManager.getClosedTabs();
    res.json({ ok: true, closed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

**Regels:**
- `try/catch` rond ALLES, catch als `(e: any)`
- Success: altijd `{ ok: true, ...data }`

---

## Documenten in deze map

| Bestand | Wat | Status |
|---------|-----|--------|
| `LEES-MIJ-EERST.md` | ← dit bestand | — |
| `fase-1-search-overlay.md` | Volledige implementatie: overlay UI + keyboard + zoeklogica + recent gesloten | 📋 Klaar om te starten |

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

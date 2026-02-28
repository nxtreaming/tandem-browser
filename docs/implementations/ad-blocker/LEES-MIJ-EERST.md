# AD BLOCKER — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Consumer-grade ad blocking via EasyList filterlijsten — blokkeer advertenties op netwerk-request niveau
> **Volgorde:** Fase 1 → 2 (elke fase is één sessie)

---

## Waarom deze feature?

Tandem's NetworkShield blokkeert malware en phishing (811K+ URLs), maar geen advertenties. Ad blocking is table stakes voor moderne browsers — pagina's laden sneller, minder tracking, betere privacy. Opera heeft een ingebouwde ad blocker met EasyList. Dit is de #8 prioriteit in de gap analyse (docs/research/gap-analysis.md).

---

## Architectuur in 30 seconden

```
Browser request → Electron session.webRequest.onBeforeRequest()
       ↓
  RequestDispatcher (bestaand, central hub voor alle request hooks)
       ↓
  AdBlockManager.onBeforeRequest() handler (priority 20)
       ↓
  FilterEngine.match(url, resourceType, pageDomain)
       ↓
  Match? → { cancel: true } → request geblokkeerd
  Geen match? → request door naar internet
       ↓
  Blocked count per tab → IPC → shell badge update
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, manager registratie, RequestDispatcher setup | `startAPI()`, `createWindow()` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |
| `src/registry.ts` | ManagerRegistry interface | `interface ManagerRegistry` |
| `src/network/dispatcher.ts` | RequestDispatcher — central hub voor webRequest hooks | `class RequestDispatcher`, `registerBeforeRequest()` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Netwerk-niveau blocking** — blokkeer requests via `session.webRequest.onBeforeRequest()`, niet via DOM/content scripts. Dit is onzichtbaar voor de webview (anti-detect compliant).
2. **RequestDispatcher integratie** — registreer via `dispatcher.registerBeforeRequest()` met priority 20 (na stealth patches priority 10, vóór andere hooks).
3. **Geen externe services** — filter lists worden gedownload en lokaal gecacht. Geen externe API calls bij elke request.
4. **Functienamen > regelnummers** — verwijs altijd naar `function registerAdBlockRoutes()`, nooit naar "regel 123"

---

## Manager Wiring — hoe nieuwe component registreren

Elke nieuwe manager moet op **3 plekken** worden aangesloten:

### 1. `src/registry.ts` — `ManagerRegistry` interface

```typescript
export interface ManagerRegistry {
  // ... bestaande managers ...
  adBlockManager: AdBlockManager;  // ← toevoegen
}
```

### 2. `src/main.ts` — `startAPI()` functie

```typescript
// Na RequestDispatcher aanmaak:
const adBlockManager = new AdBlockManager();
if (dispatcher) adBlockManager.registerWith(dispatcher);

// In registry object:
adBlockManager: adBlockManager!,
```

### 3. `src/main.ts` — `app.on('will-quit')` handler

```typescript
if (adBlockManager) adBlockManager.destroy();
```

---

## API Endpoint Patroon — kopieer exact

```typescript
// ═══════════════════════════════════════════════
// AD BLOCKER — Consumer ad blocking
// ═══════════════════════════════════════════════

router.get('/adblock/status', (req: Request, res: Response) => {
  try {
    const status = ctx.adBlockManager.getStatus();
    res.json({ ok: true, ...status });
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
| `fase-1-filter-engine.md` | Filter list download + parsing + request blocking | 📋 Klaar om te starten |
| `fase-2-ui-badge-whitelist.md` | Shield badge + blocked count + per-site whitelist toggle | ⏳ Wacht op fase 1 |

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

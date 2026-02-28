# WORKSPACES UI — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Visuele workspace switcher bovenop Tandem's bestaande /sessions — gekleurde iconen in sidebar, tab bar filtering per workspace
> **Volgorde:** Fase 1 → 2 (elke fase is één sessie)

---

## Waarom deze feature?

Tandem heeft al de krachtigste session-isolatie van alle browsers (volledige Electron partition per sessie). Maar er is geen visuele manier om te wisselen — alles gaat via `curl`. Opera's Workspaces tonen gekleurde vierkantjes bovenaan de sidebar waarmee je met één klik van context wisselt. Dit is de #5 prioriteit in de gap analyse (docs/research/gap-analysis.md). We bouwen de UI bovenop de bestaande SessionManager.

---

## Architectuur in 30 seconden

```
Klik op workspace icon in sidebar strip
       ↓
  Shell → IPC → WorkspaceManager.switch(name)
       ↓
  WorkspaceManager → SessionManager.setActive(name)
       ↓
  IPC terug → Shell filtert tab bar: toon alleen tabs van actieve workspace
       ↓
  URL bar, webview, navigatie → alles wijst nu naar de nieuwe workspace/sessie
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
| `src/sessions/manager.ts` | Bestaande SessionManager — WorkspaceManager bouwt hierop | `class SessionManager`, `create()`, `setActive()` |
| `src/sessions/types.ts` | Session interface definitie | `interface Session` |

### Per fase aanvullend te lezen

_(zie het relevante fase-bestand)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Workspaces = Sessions** — elke workspace correspondeert 1:1 met een SessionManager sessie. WorkspaceManager is een laag bovenop SessionManager, niet een vervanging.
2. **Default workspace onverwijderbaar** — de "default" workspace (= `persist:tandem` sessie) kan nooit verwijderd worden.
3. **Tab filtering, niet tab sluiting** — workspace switch verbergt tabs van andere workspaces in de tab bar, maar sluit ze niet. De webviews blijven bestaan.
4. **Functienamen > regelnummers** — verwijs altijd naar `function registerWorkspaceRoutes()`, nooit naar "regel 42"

---

## Manager Wiring — hoe nieuwe component registreren

Elke nieuwe manager moet op **3 plekken** worden aangesloten:

### 1. `src/registry.ts` — `ManagerRegistry` interface

```typescript
export interface ManagerRegistry {
  // ... bestaande managers ...
  workspaceManager: WorkspaceManager;  // ← toevoegen
}
```

### 2. `src/main.ts` — `startAPI()` functie

```typescript
// Na sessionManager aanmaak:
const workspaceManager = new WorkspaceManager(sessionManager!, tabManager!);

// In registry object:
workspaceManager: workspaceManager!,
```

### 3. `src/main.ts` — `app.on('will-quit')` handler

```typescript
if (workspaceManager) workspaceManager.destroy();
```

---

## API Endpoint Patroon — kopieer exact

```typescript
// ═══════════════════════════════════════════════
// WORKSPACES — Visual workspace management
// ═══════════════════════════════════════════════

router.get('/workspaces', (req: Request, res: Response) => {
  try {
    const workspaces = ctx.workspaceManager.list();
    res.json({ ok: true, workspaces });
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
| `fase-1-backend.md` | WorkspaceManager + API routes + tab↔workspace mapping | 📋 Klaar om te starten |
| `fase-2-shell-ui.md` | Workspace icon strip in sidebar + tab bar filtering | ⏳ Wacht op fase 1 |

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

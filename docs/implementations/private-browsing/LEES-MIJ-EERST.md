# Private Browsing Window — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Cmd+Shift+N opent een privé-venster met in-memory sessie die automatisch wordt gewist bij sluiten
> **Volgorde:** Fase 1 (één sessie, compleet)

---

## Waarom deze feature?

Robin wil soms iets opzoeken zonder sporen achter te laten — een verrassing voor iemand, een gevoelige zoekopdracht, of simpelweg inloggen met een ander account. Tandem heeft wel session-isolatie (`POST /sessions/create`), maar dat is een handmatig proces met persistente data. Een privé-venster met één toetscombinatie dat alles automatisch wist bij sluiten is de standaard verwachting van elke browser. Zie `docs/research/gap-analysis.md` sectie "Private Browsing" voor de Opera vergelijking.

---

## Architectuur in 30 seconden

```
  Cmd+Shift+N
       │
       ▼
  main.ts: createPrivateWindow()
       │
       ├──► new BrowserWindow({ partition: 'private-[uuid]' })
       │    └── GEEN 'persist:' prefix = in-memory only
       │
       ├──► Shell laadt met ?private=true query param
       │    └── Shell toont paarse header + 🔒 indicator
       │
       └──► win.on('closed') → session.clearStorageData()
            └── Alles gewist: cookies, cache, localStorage, indexedDB
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, `BrowserWindow` creatie, keyboard shortcuts | `createWindow()`, `startAPI()` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |

### Per fase aanvullend te lezen

_(zie fase-1-private-window.md)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **In-memory partition** — gebruik `session.fromPartition('private-[uuid]')` ZONDER `persist:` prefix. Dit is de Electron-standaard voor ephemere sessies.
2. **Unieke partition per venster** — elk privé-venster krijgt een eigen UUID-gebaseerde partition. Twee privé-vensters delen GEEN cookies.
3. **Cleanup on close** — bij het sluiten van het venster: `session.clearStorageData()` aanroepen als extra zekerheid, hoewel de in-memory sessie al verdwijnt.
4. **Stealth patches actief** — verifieer dat Tandem's anti-detect patches (UA, fingerprint, etc.) ook in de privé-partition actief zijn.
5. **Functienamen > regelnummers** — verwijs naar `function createWindow()` of `function registerBrowserRoutes()`, nooit regelnummers.

---

## Manager Wiring — geen nieuwe manager nodig

Private Browsing maakt een nieuw `BrowserWindow` aan met een andere partition. Er is **geen nieuwe manager** nodig — de logica zit in `src/main.ts`.

### Toe te voegen:

1. `src/main.ts` → nieuwe functie `createPrivateWindow()` (gebaseerd op bestaande `createWindow()`, maar met ephemere partition)
2. `src/main.ts` → Cmd+Shift+N accelerator registreren via `globalShortcut` of menu
3. `src/api/routes/browser.ts` → `function registerBrowserRoutes()` → `POST /window/private` endpoint
4. `shell/index.html` → detecteer `?private=true` en activeer paarse styling

---

## API Endpoint Patroon — kopieer exact

```typescript
// In function registerBrowserRoutes():

router.post('/window/private', async (_req: Request, res: Response) => {
  try {
    // Trigger private window creation via IPC to main process
    const win = createPrivateWindow();
    res.json({ ok: true, windowId: win.id });
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
| `fase-1-private-window.md` | Volledige implementatie: venster, partition, cleanup, shortcut, UI indicator | 📋 Klaar om te starten |

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

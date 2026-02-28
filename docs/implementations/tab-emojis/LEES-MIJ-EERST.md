# Tab Emojis — START HIER

> **Datum:** 2026-02-28
> **Status:** In progress
> **Doel:** Emoji-badges toewijzen aan tabs voor visuele identificatie, persistent across sessions
> **Volgorde:** Fase 1 (één sessie, compleet)

---

## Waarom deze feature?

Robin heeft vaak meerdere tabs open van dezelfde site (GitHub repos, Google Docs). Favicon + titel zijn niet genoeg om snel de juiste tab te herkennen. Emoji-badges geven tabs een persoonlijke visuele identiteit. Zie `docs/research/gap-analysis.md` sectie "Tab Emojis" en `docs/research/opera-complete-inventory.md` sectie 1.4 voor de Opera referentie.

---

## Architectuur in 30 seconden

```
  Tab hover → "+" knop → emoji picker popup
         │
         ▼
  fetch() POST /tabs/:id/emoji { emoji: "🔥" }
         │
         ▼
  TabManager.setEmoji(tabId, emoji)
         │
         ├──► Tab.emoji veld bijwerken
         ├──► IPC: 'tab-emoji-changed' → Shell badge updaten
         └──► Opslaan in ~/.tandem/tab-emojis.json (per URL)
```

---

## Projectstructuur — relevante bestanden

> ⚠️ Lees ALLEEN de bestanden in de "Te lezen" tabel.
> Ga NIET wandelen door de rest van de codebase.

### Te lezen voor ALLE fases

| Bestand | Wat staat erin | Zoek naar functie |
|---------|---------------|-------------------|
| `AGENTS.md` | Anti-detect regels, code stijl, commit format | — (lees volledig) |
| `src/main.ts` | App startup, manager registratie | `createWindow()`, `startAPI()` |
| `src/api/server.ts` | TandemAPI class, route registratie | `class TandemAPI`, `setupRoutes()` |

### Per fase aanvullend te lezen

_(zie fase-1-emoji-tabs.md)_

---

## Regels voor deze feature

> Dit zijn de HARDE regels naast de algemene AGENTS.md regels.

1. **Emoji picker in de shell** — een simpel HTML/CSS popup grid. GEEN npm package voor emoji picker. Gebruik native emoji rendering.
2. **Persistentie in JSON** — opslaan in `~/.tandem/tab-emojis.json`. Key = genormaliseerde URL (hostname + pathname). Laden bij TabManager init.
3. **Functienamen > regelnummers** — verwijs naar `function registerTabRoutes()`, nooit regelnummers.
4. **Bestaande Tab interface uitbreiden** — voeg `emoji?: string` toe aan de `Tab` interface in `src/tabs/manager.ts`.

---

## Manager Wiring — geen nieuwe manager nodig

Tab Emojis breiden de bestaande `TabManager` uit — er is **geen nieuwe manager** nodig.

### Bestaande wiring hergebruiken:

1. `src/tabs/manager.ts` → `class TabManager` → nieuwe methodes `setEmoji()`, `clearEmoji()`, `loadEmojis()`, `saveEmojis()`
2. `src/api/routes/tabs.ts` → `function registerTabRoutes()` → nieuwe endpoints
3. `shell/index.html` → emoji badge + picker UI in tab element

---

## API Endpoint Patroon — kopieer exact

```typescript
// In function registerTabRoutes():

router.post('/tabs/:id/emoji', async (req: Request, res: Response) => {
  try {
    const { emoji } = req.body;
    if (!emoji) { res.status(400).json({ error: 'emoji required' }); return; }
    const ok = ctx.tabManager.setEmoji(req.params.id, emoji);
    if (!ok) { res.status(404).json({ error: 'Tab not found' }); return; }
    res.json({ ok: true });
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
| `fase-1-emoji-tabs.md` | Volledige implementatie: backend + shell UI + persistentie | 📋 Klaar om te starten |

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

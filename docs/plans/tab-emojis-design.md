# Design: Tab Emojis

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Easy (1-2d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Tabs in Tandem zijn functioneel maar visueel eentonig. Wanneer Robin 15+ tabs open heeft, zijn favicon + titel soms niet genoeg om snel de juiste tab te vinden — vooral bij meerdere tabs van dezelfde site.

**Opera heeft:** Tab Emojis — hover over een tab toont een emoji-selector. Klik op "+" om een emoji als badge aan de tab toe te wijzen. Persistent across sessions.

**Tandem heeft nu:** Niets. Tabs tonen alleen favicon, titel, source-indicator (👤) en een close-button. Geen personalisatie-mogelijkheid.

**Gap:** Volledig ontbrekend. Geen emoji-toewijzing, geen opslag, geen UI.

---

## Gebruikerservaring — hoe het werkt

> Robin heeft 12 tabs open. Drie daarvan zijn GitHub-repositories — allemaal met hetzelfde favicon.
>
> Hij hovert over de eerste GitHub-tab. Naast de titel verschijnt een klein "+" icoontje. Hij klikt erop → een compact emoji-picker popup verschijnt (standaard browser emoji's of een grid van populaire emoji's).
>
> Hij kiest 🔥 voor het hoofdproject, 🧪 voor de test-repo, en 📚 voor de docs-repo.
>
> Nu toont elke tab zijn emoji als badge vóór de titel. Robin vindt in één oogopslag welke tab welk doel dient.
>
> De volgende dag opent Robin Tandem — de emoji's staan er nog. Ze zijn opgeslagen per URL-domein+pad.

---

## Technische Aanpak

### Architectuur

```
                    ┌────────────────────┐
                    │ Shell UI            │
                    │ emoji picker popup  │
                    │ badge op tab        │
                    └─────────┬──────────┘
                              │ fetch()
                    ┌─────────▼──────────┐
                    │ REST API            │
                    │ POST /tabs/:id/emoji│
                    │ routes/tabs.ts      │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ TabManager          │
                    │ tab.emoji field     │
                    │ persist to JSON     │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ ~/.tandem/          │
                    │ tab-emojis.json     │
                    │ { url: emoji }      │
                    └────────────────────┘
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| — | Geen — alles past in bestaande modules |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/tabs/manager.ts` | `emoji` veld op `Tab` interface + `setEmoji()` / `getEmoji()` + persistentie laden/opslaan | `class TabManager` |
| `src/api/routes/tabs.ts` | Emoji set/delete endpoints | `function registerTabRoutes()` |
| `shell/index.html` | Emoji badge in tab element + emoji picker popup op hover | Tab creation in JS |
| `shell/css/main.css` | `.tab-emoji` badge styling | Tab styling sectie |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| POST | `/tabs/:id/emoji` | Zet emoji voor tab (body: `{ emoji: "🔥" }`) |
| DELETE | `/tabs/:id/emoji` | Verwijder emoji van tab |

### Persistentie

Opslag in `~/.tandem/tab-emojis.json`:
```json
{
  "github.com/hydro13/tandem-browser": "🔥",
  "github.com/hydro13/tandem-cli": "🧪",
  "docs.google.com/document/d/abc123": "📚"
}
```

Key = URL hostname + pathname (zonder query/hash). Bij het openen van een tab wordt gekeken of er een opgeslagen emoji is voor die URL.

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Volledige implementatie: Tab interface uitbreiden, API endpoints, persistentie, shell emoji picker + badge | 1 | — |

---

## Risico's / Valkuilen

- **Emoji rendering:** Niet alle emoji's renderen even goed op alle OS'en. Mitigatie: gebruik native OS emoji rendering (geen custom font). Tandem draait toch op macOS/Linux.
- **URL-matching te strikt:** Als de emoji op exact pad zit, matcht `github.com/hydro13/tandem-browser` niet met `github.com/hydro13/tandem-browser/issues`. Mitigatie: match op langste prefix, of sta Robin toe te kiezen: per-pagina of per-domein.
- **Tab-emojis.json groeit:** Bij veel sites kan het bestand groot worden. Mitigatie: LRU-limiet van 500 entries, oudste worden verwijderd.

---

## Anti-detect overwegingen

- ✅ Alles via shell + main process — geen injectie in webview
- ✅ Emoji picker is een shell-overlay, niet zichtbaar voor de website
- ✅ Opslag is puur lokaal filesystem

---

## Beslissingen nodig van Robin

- [ ] Emoji-picker: simpel grid van ~50 populaire emoji's, of volledige OS emoji picker?
- [ ] Persistentie-scope: per exacte URL, per domein+pad, of per domein?
- [ ] Moet emoji zichtbaar blijven wanneer tab erg smal is (dan overlapt het met favicon)?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________

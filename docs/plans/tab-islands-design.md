# Design: Tab Islands

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Medium (3-5d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Wanneer Robin veel tabs opent vanuit één pagina (bijv. 5 links vanuit een Google-zoekresultaat), staan die tabs los in de tab bar. Er is geen visueel verband. Na tien minuten is het onduidelijk welke tabs bij welk onderzoek hoorden.

**Opera heeft:** Tab Islands — automatische groepering van tabs die vanuit dezelfde parent geopend zijn. Kleurgecodeerde clusters met namen, inklapbaar, met visuele verbindingen tussen tabs in hetzelfde eiland.

**Tandem heeft nu:** `POST /tabs/group` via `function registerTabRoutes()` in `src/api/routes/tabs.ts`. Handmatige groepering met kleuren via `class TabManager` → `setGroup()` in `src/tabs/manager.ts`. Tabs hebben een `groupId` veld en er is een `group-dot` element in de shell. Maar: geen auto-groepering, geen visuele eilanden, geen inklapfunctie, geen naming.

**Gap:** De hele auto-grouping logica ontbreekt (opener-tracking), en de shell UI toont alleen een klein gekleurd bolletje in plaats van een echt eiland-design met gap, naam, en collapse.

---

## Gebruikerservaring — hoe het werkt

> Robin opent Tandem en gaat naar Google. Hij zoekt "best noise cancelling headphones 2026" en opent 4 reviews in nieuwe tabs.
>
> Automatisch verschijnt een **eiland** in de tab bar: de 4 review-tabs krijgen een lichtblauwe achtergrond en een kleine naamlabel "google.com" erboven. Links en rechts van het eiland zit een subtiele extra gap (8px) die het visueel scheidt van losse tabs.
>
> Robin klikt op het eiland-label en typt "Headphones research" als naam. De 4 tabs zijn nu duidelijk gegroepeerd.
>
> Later opent hij 3 tabs vanuit Reddit — die vormen automatisch een tweede eiland (oranje) met label "reddit.com".
>
> Robin's tab bar is nu overzichtelijk: 2 eilanden + een paar losse tabs. Hij klikt op het collapse-icoontje van het headphones-eiland → de 4 tabs klappen in tot één compact element met badge "(4)". Één klik opent ze weer.

---

## Technische Aanpak

### Architectuur

```
                    ┌─────────────────────┐
                    │   webContents        │
                    │   'did-create-window'│
                    │   → opener tabId     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   TabManager         │
                    │   trackOpener()      │
                    │   autoGroupTabs()    │
                    │   islands Map        │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
    ┌─────────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ REST API       │  │ IPC events  │  │ Shell UI    │
    │ /tabs/islands  │  │ island-*    │  │ .tab-island │
    │ routes/tabs.ts │  │             │  │ gap + label │
    └───────────────┘  └─────────────┘  └─────────────┘
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| — | Geen nieuwe bestanden — alles past in bestaande modules |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/tabs/manager.ts` | Opener tracking + island data model + auto-group logica | `class TabManager` → nieuwe methodes `trackOpener()`, `getIslands()`, `collapseIsland()` |
| `src/api/routes/tabs.ts` | Nieuwe island endpoints | `function registerTabRoutes()` |
| `src/main.ts` | webContents 'did-create-window' event listener | `createWindow()` |
| `shell/index.html` | Eiland-UI in tab bar — gap, label, collapse | Tab bar sectie |
| `shell/css/main.css` | Island styling (gap, kleuren, collapse animatie) | `.tab-island-*` klassen |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/tabs/islands` | Lijst alle eilanden met hun tabs |
| POST | `/tabs/islands/create` | Maak eiland van geselecteerde tabs |
| POST | `/tabs/islands/:id/rename` | Hernoem een eiland |
| POST | `/tabs/islands/:id/collapse` | Toggle collapse/expand |
| POST | `/tabs/islands/:id/color` | Wijzig eilandkleur |
| DELETE | `/tabs/islands/:id` | Verwijder eiland (tabs worden losse tabs) |

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Backend auto-grouping: opener tracking in `TabManager`, island data model, API endpoints | 1 | — |
| 2 | Shell UI: visuele eilanden in tab bar (gap, label, kleur, collapse/expand) | 1 | Fase 1 |

---

## Risico's / Valkuilen

- **Opener tracking niet altijd beschikbaar:** Niet alle nieuwe tabs komen via `did-create-window` — sommige worden geopend via de API (`POST /tabs/open`). Mitigatie: API-geopende tabs met een meegegeven `parentTabId` parameter ook auto-groeperen.
- **Tab drag-and-drop:** Als tabs versleept worden tussen eilanden, moet de eiland-state mee-updaten. Mitigatie: drag events in shell afhandelen, API call naar `/tabs/islands/:id/move`.
- **Performance bij veel eilanden:** Bij 50+ tabs en 10+ eilanden moet rendering snel blijven. Mitigatie: CSS-only gaps (geen DOM-herschikking), eilanden als CSS-class markers op bestaande tab-elementen.

---

## Anti-detect overwegingen

- ✅ Alles via Electron main process + shell — geen injectie in webview
- ✅ Opener tracking gebruikt bestaand Electron `webContents` event, niet iets in de pagina
- ✅ UI wijzigingen alleen in de shell tab bar, onzichtbaar voor websites

---

## Beslissingen nodig van Robin

- [ ] Auto-group drempel: bij 2 of 3 tabs vanuit dezelfde parent een eiland vormen?
- [ ] Standaard eiland-naam: parent domain (bv. "google.com") of iets anders?
- [ ] Kleur-toewijzing: automatisch roteren door een palette, of gebaseerd op favicon kleur?
- [ ] Bestaande `POST /tabs/group` behouden naast islands, of vervangen?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________

# Design: Search in Tabs (Ctrl+Space)

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Easy (1-2d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Met 20+ tabs open is het lastig om de juiste tab te vinden. Robin moet door de tab bar scrollen en elk tabje visueel scannen. Dit kost tijd en is frustrerend, vooral als de tab-titels afgekort zijn.

**Opera heeft:** Search in Tabs — Ctrl+Space opent een zoek-popup. Real-time filteren van open tabs op titel en URL. Toont favicon, titel, URL. Recent gesloten tabs ook zichtbaar. Pijltjestoetsen + Enter om te navigeren.

**Tandem heeft nu:** `GET /tabs/list` API endpoint via `function registerTabRoutes()` in `src/api/routes/tabs.ts`. `class TabManager` heeft `listTabs()` en `closedTabs` array. Maar: geen zoek-UI in de shell.

**Gap:** De data is er (API + manager), maar de gebruikersinterface ontbreekt volledig. Dit is een puur shell/UI feature.

---

## Gebruikerservaring — hoe het werkt

> Robin heeft 25 tabs open. Hij weet dat ergens een Stack Overflow tab open staat over "TypeScript generics", maar kan hem niet vinden in de overvolle tab bar.
>
> Hij drukt **Ctrl+Space** (of Cmd+Space op macOS — nee, dat conflicteert met Spotlight. We gebruiken **Ctrl+Space**).
>
> Een overlay verschijnt midden bovenaan het venster — een zoekbalk met een lijst van alle open tabs eronder. Robin begint te typen: "generics".
>
> De lijst filtert real-time: er blijven 2 tabs over — de Stack Overflow pagina en een TypeScript docs tab. Robin drukt ↓ en Enter → Tandem schakelt direct naar die tab. De overlay verdwijnt.
>
> Later wil Robin een tab terugvinden die hij per ongeluk sloot. Hij drukt Ctrl+Space en scrollt naar beneden — onder de open tabs staat een sectie "Recent gesloten" met de laatste 10 gesloten tabs. Hij klikt erop → de tab wordt heropend.

---

## Technische Aanpak

### Architectuur

```
    ┌──────────────────────────────┐
    │ Shell UI (index.html)         │
    │                               │
    │  Ctrl+Space → toggle overlay  │
    │  ┌─────────────────────────┐  │
    │  │ #tab-search-overlay     │  │
    │  │ ┌─────────────────────┐ │  │
    │  │ │ <input> zoekbalk    │ │  │
    │  │ └─────────────────────┘ │  │
    │  │ ┌─────────────────────┐ │  │
    │  │ │ Tab resultaten list │ │  │
    │  │ │ - favicon + title   │ │  │
    │  │ │ - URL (dim)         │ │  │
    │  │ └─────────────────────┘ │  │
    │  │ ┌─────────────────────┐ │  │
    │  │ │ Recent gesloten     │ │  │
    │  │ └─────────────────────┘ │  │
    │  └─────────────────────────┘  │
    │              │                 │
    │    fetch() GET /tabs/list     │
    │    fetch() POST /tabs/focus   │
    │    fetch() POST /tabs/open    │
    └──────────────────────────────┘
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| — | Geen — puur shell UI toevoeging |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/api/routes/tabs.ts` | Nieuw endpoint `GET /tabs/closed` voor recent gesloten tabs | `function registerTabRoutes()` |
| `src/tabs/manager.ts` | Publieke methode `getClosedTabs()` | `class TabManager` |
| `shell/index.html` | Zoek-overlay HTML + JS (event listeners, fetch, rendering) | Nieuwe sectie `// === TAB SEARCH ===` |
| `shell/css/main.css` | Overlay styling (centered popup, transparante achtergrond, resultaten lijst) | Nieuwe `.tab-search-*` klassen |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/tabs/closed` | Lijst recent gesloten tabs (max 10) |

De bestaande endpoints worden hergebruikt:
- `GET /tabs/list` — haal alle open tabs op (bestaand)
- `POST /tabs/focus` — schakel naar een tab (bestaand)
- `POST /tabs/open` — heropen een gesloten tab (bestaand)

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Volledige implementatie: overlay UI, keyboard shortcut, zoeklogica, recent gesloten endpoint + UI | 1 | — |

---

## Risico's / Valkuilen

- **Ctrl+Space conflict:** Op sommige systemen is Ctrl+Space al bezet (input method switch op Linux). Mitigatie: configureerbare shortcut, fallback op Cmd+K of Cmd+E.
- **Focus-management:** Wanneer de overlay open is, moet keyboard input naar de zoekbalk gaan, niet naar de webview. Mitigatie: overlay overlay met `tabIndex` en `focus()` op de input.
- **Snelheid bij veel tabs:** Bij 100+ tabs moet filtering instant zijn. Mitigatie: client-side filtering op al-geladen data (geen API call per keystroke).

---

## Anti-detect overwegingen

- ✅ Volledig shell-side — geen webview interactie
- ✅ Keyboard shortcut wordt afgevangen in de shell, niet in de pagina
- ✅ Overlay is een shell-element boven de webview, onzichtbaar voor websites

---

## Beslissingen nodig van Robin

- [ ] Keyboard shortcut: Ctrl+Space, of liever Cmd+K / Cmd+E?
- [ ] Moet de overlay ook bookmarks doorzoeken, of alleen open tabs + recent gesloten?
- [ ] Positie: centered bovenaan (Chrome-style command palette), of dropdown vanuit tab bar?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________

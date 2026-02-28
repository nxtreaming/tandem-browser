# Design: Split Screen

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Medium (3-5d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Power users willen twee websites naast elkaar bekijken zonder te hoeven wisselen tussen tabs. Denk aan: documentatie links + code rechts, vergelijken van producten, of een video kijken terwijl je aantekeningen maakt.

**Opera heeft:** Split Screen met 2-4 panes (verticaal, horizontaal, grid). Drag tab naar beneden om te splitten, of Shift+click twee tabs → rechtermuisklik → Split Screen. Elk paneel heeft eigen navigatie.
**Tandem heeft nu:** Één webview tegelijk in het main content area. Geen multi-pane support.
**Gap:** Volledig ontbrekend — geen manier om twee pagina's naast elkaar te tonen.

---

## Gebruikerservaring — hoe het werkt

> Robin opent Tandem en navigeert naar een API documentatie pagina. Hij wil tegelijk zijn applicatie testen.
> Hij opent een tweede tab met zijn app, selecteert beide tabs (Shift+click), rechtermuisklik → "Split Screen".
> Het venster splitst verticaal: links de docs, rechts zijn app. Tussen de twee panelen zit een sleepbare divider.
> Robin klikt op het linker paneel — de URL bar toont de docs URL. Hij navigeert naar een andere docs pagina.
> Het rechter paneel blijft ongewijzigd op zijn app. Robin sleept de divider naar links om zijn app meer ruimte te geven.
> Als hij klaar is, klikt hij rechtermuisklik → "Exit Split Screen" en keert terug naar normaal single-tab browsen.

---

## Technische Aanpak

### Architectuur

```
┌──────────────────────────────────────────────┐
│                  Shell (index.html)           │
│  ┌──────────┐  ┌──────────────────────────┐  │
│  │ Tab Bar   │  │ toolbar (URL bar etc.)   │  │
│  └──────────┘  └──────────────────────────┘  │
│  ┌─────────────────┬──┬─────────────────┐    │
│  │   BrowserView   │▌▌│  BrowserView    │    │
│  │   (left pane)   │▌▌│  (right pane)   │    │
│  │                 │▌▌│                 │    │
│  │  webContents A  │▌▌│  webContents B  │    │
│  └─────────────────┴──┴─────────────────┘    │
│                     ↑ draggable divider       │
└──────────────────────────────────────────────┘

API: POST /split/open → SplitScreenManager → setBounds() op BrowserViews
     POST /split/close → SplitScreenManager → verwijder secondary view
     GET  /split/status → huidige layout info
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/split-screen/manager.ts` | SplitScreenManager — layout state, BrowserView lifecycle, bounds berekening |
| `src/api/routes/split.ts` | REST API endpoints voor split screen |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/registry.ts` | `splitScreenManager` toevoegen aan `ManagerRegistry` | `interface ManagerRegistry` |
| `src/api/server.ts` | Split routes registreren | `setupRoutes()` |
| `src/main.ts` | SplitScreenManager instantiëren, registreren, cleanup | `startAPI()`, `app.on('will-quit')` |
| `shell/index.html` | Divider element + split screen controls in toolbar | `<!-- Main layout -->` sectie |
| `shell/js/main.js` | Divider drag logic, active pane focus, split keyboard shortcuts | event handlers |
| `shell/css/main.css` | Styling voor divider, active pane indicator | nieuwe CSS classes |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| POST | `/split/open` | Start split screen met `{tabId1, tabId2, layout}` — layout: `'vertical'` of `'horizontal'` |
| POST | `/split/close` | Sluit split screen, keert terug naar single view |
| GET | `/split/status` | Huidige split state: active/inactive, pane info, layout |
| POST | `/split/layout` | Wissel layout: vertical ↔ horizontal |
| POST | `/split/focus/:paneIndex` | Focus specifiek paneel (0=links/boven, 1=rechts/onder) |
| POST | `/split/resize` | Set divider positie als ratio (0.0-1.0) |

### Geen nieuwe npm packages nodig? ✅

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Electron BrowserView splitting backend + API endpoints | 1 | — |
| 2 | Shell UI: tab context menu, divider drag, active pane focus | 1 | Fase 1 |

---

## Risico's / Valkuilen

- **Single-webview aanname:** De huidige shell gaat uit van één `<webview>` tag. Split screen vereist dat we de webview-container layout dynamisch aanpassen. De bestaande `<webview>` kan blijven als "pane 0" — de second pane is een nieuw element.
- **BrowserView vs webview tag:** Electron's `BrowserView` is krachtiger maar complexer. We kiezen voor een tweede `<webview>` tag in de shell HTML — dit is eenvoudiger, past bij het bestaande patroon, en vermijdt de BrowserView→WebContentsView migratie.
- **Focus management:** Als de actieve pane wisselt, moet de toolbar (URL bar, back/forward) de juiste webContents aansturen. Dit vereist een `activePaneIndex` state in de shell.
- **Tab registratie:** De second pane webview moet ook geregistreerd worden bij TabManager zodat navigatie-events correct verwerkt worden.

---

## Anti-detect overwegingen

- ✅ Alles via shell layout en Electron main process — geen injectie in webview
- ✅ Split screen is puur een UI-laag (twee webviews naast elkaar) — websites in de webviews zien alleen hun eigen pagina
- ✅ Divider en controls zitten in de shell, niet in de webview

---

## Beslissingen nodig van Robin

- [ ] Wil je ook 4-pane grid (2x2) support, of is 2-pane (verticaal/horizontaal) genoeg voor V1?
- [ ] Drag tab naar beneden als trigger voor split screen — wil je dit in fase 2, of alleen via context menu?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________

# Design: Ad Blocker (Consumer Grade)

> **Datum:** 2026-02-28
> **Status:** Draft
> **Effort:** Medium (3-5d)
> **Auteur:** Kees

---

## Probleem / Motivatie

Tandem heeft NetworkShield dat 811K+ malicious URLs blokkeert (phishing, malware), maar het blokkeert geen advertenties. Advertenties zijn niet alleen vervelend — ze vertragen pagina's, verspillen bandbreedte, en vormen een tracking/privacy risico. Elke serieuze browser biedt ad blocking. Dit is table stakes.

**Opera heeft:** Ingebouwde ad blocker op netwerk-request niveau (blokkeert vóór render). Gebruikt EasyList filterlijsten + NoCoin mining protection. Badge in URL bar met geblokkeerd-aantal. Per-site uitzonderingen. YouTube ad blocking.
**Tandem heeft nu:** NetworkShield met custom blocklist (malicious URLs). Geen EasyList/adblock filter support. Geen consumer ad blocking.
**Gap:** Groot — geen ad blocking, alleen malware blocking.

---

## Gebruikerservaring — hoe het werkt

> Robin opent een nieuwssite. Normaal ziet hij banners, popups, en video-ads.
> Met de Ad Blocker actief: de pagina laadt sneller, geen ads zichtbaar.
> In de toolbar ziet Robin een schildje met een getal (bv. "23") — het aantal geblokkeerde requests op deze pagina.
> Robin klikt op het schildje: een popup toont het geblokkeerde aantal en een toggle "Uitzetten voor deze site".
> Op een site die kapot gaat door ad blocking, klikt Robin de toggle uit. De pagina herlaadt zonder ad blocking.
> De whitelist wordt onthouden — volgende bezoeken aan die site zijn ook niet gefilterd.

---

## Technische Aanpak

### Architectuur

```
┌──────────────────────────────────────────────────────────────┐
│                    Electron Session                           │
│                                                               │
│   HTTP Request                                                │
│       ↓                                                       │
│   RequestDispatcher                                           │
│       ↓                                                       │
│   AdBlockManager.onBeforeRequest()  (priority 20)            │
│       ↓                                                       │
│   FilterEngine.match(url, resourceType, pageDomain)          │
│       ↓ match?                                                │
│   { cancel: true }  → request geblokkeerd                    │
│       ↓ no match                                              │
│   request doorgezet naar internet                             │
│                                                               │
│   FilterEngine                                                │
│   ├── EasyList.txt      (ads)                                │
│   ├── EasyPrivacy.txt   (trackers)                           │
│   └── NoCoin rules      (crypto mining)                      │
│                                                               │
│   Whitelist (per-domain)                                      │
│   └── ~/.tandem/adblock-whitelist.json                       │
└──────────────────────────────────────────────────────────────┘
```

### Nieuwe bestanden

| Bestand | Verantwoordelijkheid |
|---------|---------------------|
| `src/adblock/manager.ts` | AdBlockManager — filter engine lifecycle, whitelist, blocked count tracking |
| `src/adblock/filter-engine.ts` | FilterEngine — parse EasyList/ABP filter rules, match URLs tegen regels |
| `src/adblock/filter-lists.ts` | Download en cache EasyList + EasyPrivacy filterlijsten |
| `src/api/routes/adblock.ts` | REST API endpoints voor ad blocker |

### Bestaande bestanden aanpassen

| Bestand | Aanpassing | Functie |
|---------|-----------|---------|
| `src/registry.ts` | `adBlockManager` toevoegen aan `ManagerRegistry` | `interface ManagerRegistry` |
| `src/api/server.ts` | AdBlock routes registreren | `setupRoutes()` |
| `src/main.ts` | AdBlockManager instantiëren, registreren bij RequestDispatcher | `startAPI()` |
| `src/main.ts` | Cleanup | `app.on('will-quit')` |
| `shell/index.html` | Shield badge in toolbar | `<div class="toolbar">` |
| `shell/js/main.js` | Badge update logica, whitelist toggle popup | event handlers |
| `shell/css/main.css` | Shield badge styling | nieuwe CSS classes |

### Nieuwe API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|---------|--------------|
| GET | `/adblock/status` | Ad blocker status: enabled, filter count, total blocked |
| POST | `/adblock/toggle` | Schakel ad blocker in/uit globaal |
| GET | `/adblock/stats` | Statistieken: geblokkeerd per pagina, totaal |
| GET | `/adblock/whitelist` | Lijst gewhiteliste domeinen |
| POST | `/adblock/whitelist` | Voeg domein toe aan whitelist `{domain}` |
| DELETE | `/adblock/whitelist/:domain` | Verwijder domein van whitelist |
| POST | `/adblock/update-filters` | Forceer filter list update (download nieuwste versie) |

### Geen nieuwe npm packages nodig? ✅
We bouwen een eigen lightweight filter engine. Geen `@nicedoc/adblocker` of `@nicedoc/cosmetic-filter` nodig — die zijn te zwaar en voegen onnodige dependencies toe. EasyList/ABP filter syntax is goed gedocumenteerd en de core matching logic is relatief simpel (URL pattern matching met domein-optie filtering).

---

## Fase-opdeling

| Fase | Inhoud | Sessies | Afhankelijk van |
|------|--------|---------|----------------|
| 1 | Filter engine: download lijsten, parse regels, block requests via RequestDispatcher | 1 | — |
| 2 | Shell UI: shield badge, blocked count, per-site whitelist toggle | 1 | Fase 1 |

---

## Risico's / Valkuilen

- **Filter list parsing performance:** EasyList heeft ~90.000 regels. Naïeve string matching is te traag. We gebruiken een hash-tabel voor domain-based regels en een compacte trie/set voor URL-pattern regels. Eerste parse kan ~2-3 seconden duren — doe dit async bij startup.
- **False positives:** Sommige EasyList regels blokkeren te agressief. Per-site whitelist is essentieel als escape hatch.
- **YouTube ads:** YouTube serveert ads via dezelfde domeinen als video content. Volledige YouTube ad blocking vereist meer geavanceerde logica (request pattern matching). V1 blokkeert standaard display ads; YouTube specifieke rules zijn een V2 item.
- **RequestDispatcher integratie:** De bestaande `RequestDispatcher` in Tandem routeert alle `session.webRequest` hooks. AdBlockManager moet zich registreren met de juiste priority (na stealth patches, maar vóór NetworkShield).
- **Memory:** 90K regels in memory is ~10-15MB. Acceptabel voor een desktop app.

---

## Anti-detect overwegingen

- ✅ Ad blocking gebeurt op Electron session niveau via `webRequest.onBeforeRequest()` — de webview ziet alleen dat requests niet aankomen, niet waarom
- ✅ Geen content scripts of DOM manipulatie — puur netwerk-niveau blocking
- ⚠️ Websites kunnen detecteren dat ads niet laden (anti-adblock scripts). Dit is een known issue met elke ad blocker. V1 doet hier niets mee — gebruiker kan de site whitelisten.

---

## Beslissingen nodig van Robin

- [ ] Wil je EasyPrivacy (tracker blocking) ook meteen in V1, of alleen EasyList (ads)?
- [ ] Standaard aan of uit bij eerste start? Opera heeft het standaard uit (opt-in).
- [ ] NoCoin crypto mining protection: toevoegen als derde filterlijst?

---

## Goedkeuring

Robin: [ ] Go / [ ] No-go / [ ] Go met aanpassing: ___________

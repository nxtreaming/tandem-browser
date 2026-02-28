# Fase 1 — Filter Engine: Download, Parse, Block

> **Feature:** Ad Blocker
> **Sessies:** 1 sessie
> **Prioriteit:** HOOG
> **Afhankelijk van:** Geen

---

## Doel van deze fase

Bouw het ad blocking systeem: download EasyList en EasyPrivacy filterlijsten, parse ze naar een efficiënte in-memory datastructuur, en blokkeer matchende HTTP requests via de bestaande `RequestDispatcher`. Registreer API endpoints voor status en filter management. Na deze fase blokkeert Tandem advertenties en trackers op netwerk-niveau.

---

## Bestaande code te lezen — ALLEEN dit

> Lees NIETS anders. Geen wandering door de codebase.

| Bestand | Zoek naar functie/klasse | Waarom |
|---------|--------------------------|--------|
| `src/network/dispatcher.ts` | `class RequestDispatcher`, `registerBeforeRequest()`, `attach()` | AdBlockManager registreert zich hier als request filter |
| `src/main.ts` | `startAPI()`, `dispatcher = new RequestDispatcher(ses)` | Begrijp hoe dispatcher wordt aangemaakt en gebruikt |
| `src/main.ts` | `stealth.registerWith(dispatcher)` | Referentiepatroon: hoe een manager zich registreert bij RequestDispatcher |
| `src/main.ts` | `app.on('will-quit')` | Cleanup toevoegen |
| `src/registry.ts` | `interface ManagerRegistry` | AdBlockManager toevoegen |
| `src/api/server.ts` | `setupRoutes()` | Route-module registreren |
| `src/api/routes/sessions.ts` | `registerSessionRoutes()` | Referentiepatroon voor route registratie |
| `src/security/security-manager.ts` | `class SecurityManager` | Referentie: hoe NetworkShield al request filtering doet (priority ≠ conflicteren) |

---

## Te bouwen in deze fase

### Stap 1: Filter list downloader

**Wat:** Download EasyList.txt en EasyPrivacy.txt van officiële bronnen, cache ze in `~/.tandem/adblock/`, en update ze periodiek (dagelijks).

**Bestand:** `src/adblock/filter-lists.ts`

```typescript
export interface FilterListConfig {
  name: string;
  url: string;
  localPath: string;
}

const DEFAULT_LISTS: FilterListConfig[] = [
  {
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
    localPath: 'easylist.txt',
  },
  {
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    localPath: 'easyprivacy.txt',
  },
];

export class FilterListDownloader {
  private cacheDir: string; // ~/.tandem/adblock/

  constructor() { ... }

  /** Download alle filterlijsten (of gebruik cache als recent genoeg) */
  async downloadAll(): Promise<string[]> { ... }

  /** Download één lijst als cache ouder is dan maxAge (default 24h) */
  async downloadIfStale(list: FilterListConfig, maxAgeMs?: number): Promise<string> { ... }

  /** Forceer download van alle lijsten */
  async forceUpdate(): Promise<void> { ... }
}
```

### Stap 2: Filter engine — parser en matcher

**Wat:** Parse ABP/EasyList filter syntax naar een efficiënte lookup structuur. Match inkomende request URLs tegen de regels.

**Bestand:** `src/adblock/filter-engine.ts`

```typescript
export interface FilterRule {
  pattern: string;
  regex: RegExp | null;
  isException: boolean;       // @@-regels (whitelist)
  domains: string[] | null;   // $domain=... optie
  thirdPartyOnly: boolean;    // $third-party optie
  resourceTypes: string[] | null; // $script,$image etc.
}

export class FilterEngine {
  private blockRules: FilterRule[] = [];
  private exceptionRules: FilterRule[] = [];
  private domainBlockSet: Set<string> = new Set(); // snelle hash lookup voor domein-regels
  private ruleCount = 0;

  /** Parse een filterlijst bestand (EasyList format) */
  loadFilterList(content: string): void {
    // Parse elke regel:
    // - Skip comments (! ...) en headers ([Adblock Plus ...])
    // - Parse @@-regels als exceptions
    // - Parse $-opties (domain, third-party, script, image, etc.)
    // - Converteer URL patterns naar RegExp of string match
    // - Voeg toe aan blockRules of exceptionRules
  }

  /** Check of een URL geblokkeerd moet worden */
  match(url: string, resourceType: string, pageDomain: string): boolean {
    // 1. Check domain block set (snelste pad voor ||domain^ regels)
    // 2. Check exception rules — als match, return false (niet blokkeren)
    // 3. Check block rules — als match, return true (blokkeren)
    // 4. Return false (niet blokkeren)
  }

  /** Aantal geladen regels */
  getRuleCount(): number { return this.ruleCount; }
}
```

**ABP Filter Syntax (subset om te ondersteunen):**
- `||example.com^` — blokkeer alle requests naar example.com
- `/ads/banner` — blokkeer URLs die dit pad bevatten
- `@@||example.com^` — exception (whitelist) voor example.com
- `$third-party` — alleen third-party requests blokkeren
- `$domain=example.com` — alleen op specifieke pagina's blokkeren
- `$script,image,stylesheet` — resource type filters
- `*` — wildcard
- `^` — separator (alles behalve alfanumeriek en _-.%)

### Stap 3: AdBlockManager — orchestratie

**Wat:** Combineert filter list download, engine, whitelist, en request interception. Registreert zich bij RequestDispatcher.

**Bestand:** `src/adblock/manager.ts`

```typescript
import { FilterListDownloader } from './filter-lists';
import { FilterEngine } from './filter-engine';
import type { RequestDispatcher } from '../network/dispatcher';

export class AdBlockManager {
  private engine: FilterEngine;
  private downloader: FilterListDownloader;
  private enabled = true;
  private whitelist: Set<string> = new Set();  // gewhiteliste domeinen
  private blockedCounts: Map<number, number> = new Map(); // tabId → count
  private totalBlocked = 0;

  constructor() { ... }

  /** Initialiseer: download lijsten, parse, registreer bij dispatcher */
  async init(): Promise<void> {
    await this.loadWhitelist();
    const listContents = await this.downloader.downloadAll();
    for (const content of listContents) {
      this.engine.loadFilterList(content);
    }
  }

  /** Registreer bij RequestDispatcher (priority 20) */
  registerWith(dispatcher: RequestDispatcher): void {
    dispatcher.registerBeforeRequest({
      name: 'AdBlocker',
      priority: 20,
      handler: (details) => {
        if (!this.enabled) return false;

        // Bepaal page domain van de request
        const pageDomain = this.extractDomain(details.url);
        const requestDomain = this.extractDomain(details.url);

        // Check whitelist
        if (this.whitelist.has(pageDomain)) return false;

        // Check filter engine
        const resourceType = details.resourceType || 'other';
        if (this.engine.match(details.url, resourceType, pageDomain)) {
          this.incrementBlockedCount(details.webContentsId);
          return true; // cancel request
        }

        return false; // allow request
      }
    });
  }

  /** Status info */
  getStatus(): { enabled: boolean; ruleCount: number; totalBlocked: number } { ... }

  /** Blocked count per tab */
  getBlockedCount(tabId: number): number { ... }

  /** Reset blocked count voor tab */
  resetBlockedCount(tabId: number): void { ... }

  /** Toggle globaal aan/uit */
  toggle(): boolean { ... }

  /** Whitelist management */
  addToWhitelist(domain: string): void { ... }
  removeFromWhitelist(domain: string): void { ... }
  getWhitelist(): string[] { ... }

  /** Forceer filter update */
  async updateFilters(): Promise<void> { ... }

  /** Cleanup */
  destroy(): void { ... }

  private loadWhitelist(): void { ... }
  private saveWhitelist(): void { ... }
  private extractDomain(url: string): string { ... }
  private incrementBlockedCount(webContentsId: number): void { ... }
}
```

### Stap 4: API routes

**Wat:** REST endpoints voor ad blocker management.

**Bestand:** `src/api/routes/adblock.ts`

**Functie:** `registerAdBlockRoutes(router, ctx)`

```typescript
export function registerAdBlockRoutes(router: Router, ctx: RouteContext): void {
  // ═══════════════════════════════════════════════
  // AD BLOCKER — Consumer ad blocking
  // ═══════════════════════════════════════════════

  router.get('/adblock/status', (req, res) => { ... });
  router.post('/adblock/toggle', (req, res) => { ... });
  router.get('/adblock/stats', (req, res) => { ... });
  router.get('/adblock/whitelist', (req, res) => { ... });
  router.post('/adblock/whitelist', (req, res) => { ... });
  router.delete('/adblock/whitelist/:domain', (req, res) => { ... });
  router.post('/adblock/update-filters', async (req, res) => { ... });
}
```

### Stap 5: Wiring — registreer manager en routes

**Bestand:** `src/registry.ts` — voeg `adBlockManager: AdBlockManager` toe

**Bestand:** `src/main.ts` — in `startAPI()`:
```typescript
import { AdBlockManager } from './adblock/manager';

const adBlockManager = new AdBlockManager();
await adBlockManager.init();
if (dispatcher) adBlockManager.registerWith(dispatcher);
```

Voeg toe aan registry object en will-quit cleanup.

**Bestand:** `src/api/server.ts` — in `setupRoutes()`:
```typescript
import { registerAdBlockRoutes } from './routes/adblock';
registerAdBlockRoutes(router, ctx);
```

---

## Acceptatiecriteria — dit moet werken na de sessie

```bash
# Test 1: Status ophalen
TOKEN=$(cat ~/.tandem/api-token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/adblock/status
# Verwacht: {"ok":true, "enabled":true, "ruleCount":85000+, "totalBlocked":0}

# Test 2: Toggle uit
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/adblock/toggle
# Verwacht: {"ok":true, "enabled":false}

# Test 3: Toggle aan
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/adblock/toggle
# Verwacht: {"ok":true, "enabled":true}

# Test 4: Whitelist toevoegen
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/adblock/whitelist \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'
# Verwacht: {"ok":true}

# Test 5: Whitelist ophalen
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/adblock/whitelist
# Verwacht: {"ok":true, "whitelist":["example.com"]}

# Test 6: Whitelist verwijderen
curl -H "Authorization: Bearer $TOKEN" \
  -X DELETE http://localhost:8765/adblock/whitelist/example.com
# Verwacht: {"ok":true}

# Test 7: Forceer filter update
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:8765/adblock/update-filters
# Verwacht: {"ok":true}

# Test 8: Navigeer naar ad-heavy site, check stats
# (open een pagina in Tandem, wacht even, dan:)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8765/adblock/stats
# Verwacht: {"ok":true, "totalBlocked":N, "blockedPerTab":{...}}
```

**Compilatie verificatie:**
- [ ] `npx tsc` — zero errors
- [ ] `npx vitest run` — alle bestaande tests slagen
- [ ] `npm start` — app start zonder crashes
- [ ] Filter lists gecached in `~/.tandem/adblock/`

---

## Sessie Protocol

### Bij start:
```
1. Lees LEES-MIJ-EERST.md
2. Lees DIT bestand (fase-1-filter-engine.md) volledig
3. Run: curl http://localhost:8765/status && npx tsc && git status
4. Lees de bestanden in de "Te lezen" tabel hierboven
```

### Bij einde:
```
1. npx tsc — ZERO errors verplicht
2. npm start — app start zonder crashes
3. Alle curl tests uit "Acceptatiecriteria" uitvoeren
4. npx vitest run — alle bestaande tests blijven slagen
5. CHANGELOG.md bijwerken met korte entry
6. git commit -m "🛡️ feat: ad blocker filter engine + API"
7. git push
8. Rapport:
   ## Gebouwd
   ## Getest (plak curl output)
   ## Problemen
   ## Volgende sessie start bij fase-2-ui-badge-whitelist.md
```

---

## Bekende valkuilen

- [ ] EasyList download kan falen bij netwerk issues — gebruik cached versie als fallback
- [ ] Filter list parsing moet async zijn (kan 2-3 seconden duren voor 90K regels) — blokkeer niet de app startup
- [ ] `webContentsId` in onBeforeRequest is niet hetzelfde als `tabId` — je hebt een mapping nodig (of gebruik webContentsId direct)
- [ ] RequestDispatcher's `registerBeforeRequest` handler moet `true` returnen om te blokkeren, `false` om door te laten — check het exacte contract in `dispatcher.ts`
- [ ] TypeScript strict mode — geen `any` buiten catch blocks
- [ ] Vergeet niet `destroy()` toe te voegen aan will-quit handler
- [ ] EasyList URLs: `https://easylist.to/easylist/easylist.txt` en `https://easylist.to/easylist/easyprivacy.txt` — gebruik HTTPS

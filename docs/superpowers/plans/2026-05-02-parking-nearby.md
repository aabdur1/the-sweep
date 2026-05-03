# Parking Nearby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/parking` route to The Sweep that shows metered pay-boxes near an address (typed or GPS) on a Leaflet + Stamen Toner map, with each meter annotated as active-now / free-now, plus a single banner showing the next street sweep date and a badge for the residential permit zone.

**Architecture:** Two wouter routes (`/` for the existing Sweep mode, `/parking` for the new mode). The current `App.tsx` body extracts to `pages/SweepPage.tsx`. The new `<ParkingPage/>` is lazy-loaded (Leaflet stays out of the Sweep bundle). Three new pure-function modules wrap the new data sources (ArcGIS Layer 40 paybox, Socrata permit zones, hours-string parser). A small `lastLookup` localStorage façade lets both pages share the most recent search.

**Tech Stack:** Same as v1–v5 (Vite + React 18 + TS + Tailwind). Adds three runtime deps: `wouter` (router, ~1.5kb), `leaflet` (map renderer, ~40kb), `@types/leaflet` (types only).

**Spec:** `docs/superpowers/specs/2026-05-02-parking-nearby-design.md`

**Note on testing:** No automated test framework exists in this project (per CLAUDE.md / `package.json`). Verification is `npm run typecheck` plus controller-driven manual smoke. Two tasks (7 and 9) include one-off verification scripts run via `npx tsx ...` to validate live API responses before building dependent code — these are not part of the shipping codebase.

**Working directory:** All paths relative to the worktree root (controller will set this up).

**Task ordering rationale:** Dependencies first, then refactor, then router skeleton (single route), then the pure modules behind the new data sources (each unused until wired in), then the new components, then the parking page, then the route wire-up, then the mode toggle. The app remains in a working state at every commit; the new parking surface only becomes user-visible at task 16.

---

## Task 1: Install runtime dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

- [ ] **Step 1: Install the three new packages**

```bash
npm install wouter leaflet @types/leaflet
```

Expected: three packages added under `dependencies` / `devDependencies` in `package.json`. `node_modules/wouter`, `node_modules/leaflet`, `node_modules/@types/leaflet` exist.

- [ ] **Step 2: Verify versions and typecheck**

Run:

```bash
npm run typecheck
```

Expected: clean. (No source files use the new packages yet.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add wouter, leaflet, @types/leaflet for v6 parking"
```

---

## Task 2: Extract `App.tsx` body into `pages/SweepPage.tsx`

**Files:**
- Create: `src/pages/SweepPage.tsx`
- Modify: `src/App.tsx`

A pure-refactor task. The current `App.tsx` renders the entire app body inside its function. We extract that body to `pages/SweepPage.tsx` and have `App.tsx` import + render it. Visible behavior unchanged.

**Note on `<Footnotes/>`:** despite earlier mention of "shared layout", `<Footnotes/>` is sweep-specific (it takes `address={result.display}` and only renders inside the conditional result block). It STAYS inside `SweepPage` — do not lift it to `App`. The parking page will define its own equivalent or omit it.

- [ ] **Step 1: Read the current `src/App.tsx` to identify exactly what moves**

Run (for reference):

```bash
cat src/App.tsx
```

Note: everything inside the top-level `<App/>` function's return — except the masthead, footnotes, and any global wrappers (page frame, page grid) — moves into `<SweepPage/>`. The masthead and footnotes stay in `<App/>` because Task 15 will share them across both routes.

If the current `App.tsx` has the masthead and footnotes inside a single layout block intermingled with the body, lift them to the top level of `<App/>` first, then extract the inner body. Goal: after this task, `<App/>` reads like:

```tsx
<PageFrame>
  <Masthead />
  <SweepPage />
  <Footnotes />
</PageFrame>
```

(Where `<PageFrame>` is whatever wrapping div the current App uses; preserve it.)

- [ ] **Step 2: Create `src/pages/SweepPage.tsx`**

```tsx
// Move the existing App.tsx body here. Preserve every existing import
// (lookup hook, AddressInput, NextSweepHero, RoutinePickups, ScheduleAlmanac,
// ErrorPanel, HowItWorks, Marginalia, etc.) — only the imports and JSX that
// were the actual page CONTENT, not the masthead/footnotes/page-frame chrome.
//
// Export a named SweepPage component:

export const SweepPage = () => {
  // ...existing useLookup orchestration and result rendering...
  return (
    // ...existing main/section JSX...
  );
};
```

Keep the file's import paths relative to its NEW location (`../hooks/useLookup`, `../components/AddressInput`, etc. — all gain one `../`).

- [ ] **Step 3: Update `src/App.tsx` to import and render `<SweepPage/>`**

```tsx
import { Masthead } from './components/Masthead';
import { Footnotes } from './components/Footnotes';
import { SweepPage } from './pages/SweepPage';

export default function App() {
  return (
    <PageFrame>  {/* whatever wrapper App previously used */}
      <Masthead />
      <SweepPage />
      <Footnotes />
    </PageFrame>
  );
}
```

(Preserve the existing PageFrame/page-grid divs verbatim. The exact wrapper depends on what's already in `App.tsx` — copy that structure unchanged, only replacing the inner body with `<SweepPage />`.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Visual smoke** — SKIP. Controller will browser-smoke the refactor at the next checkpoint.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/SweepPage.tsx
git commit -m "refactor(app): extract page body to pages/SweepPage.tsx (no behavior change)"
```

---

## Task 3: Add `wouter` routing skeleton (single route)

**Files:**
- Modify: `src/App.tsx`

Wraps the existing `<SweepPage/>` in a `<Switch/>` with a single route at `/`. No new pages yet; this is the routing infrastructure.

- [ ] **Step 1: Update `src/App.tsx`**

Replace the imports + body to use wouter:

```tsx
import { Route, Switch, Redirect } from 'wouter';
import { Masthead } from './components/Masthead';
import { Footnotes } from './components/Footnotes';
import { SweepPage } from './pages/SweepPage';

export default function App() {
  return (
    <PageFrame>  {/* preserve the existing wrapper from Task 2 */}
      <Masthead />
      <Switch>
        <Route path="/" component={SweepPage} />
        <Route><Redirect to="/" /></Route>  {/* unknown routes → / */}
      </Switch>
      <Footnotes />
    </PageFrame>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add wouter <Switch/> skeleton — single route at /"
```

---

## Task 4: Add Netlify SPA rewrite

**Files:**
- Modify: `netlify.toml`

Production needs a rewrite so direct nav to `/parking` doesn't 404. No visible effect in dev (Vite handles HTML5 history fallback automatically).

- [ ] **Step 1: Read current `netlify.toml`**

```bash
cat netlify.toml
```

Note the existing build/publish config; preserve it.

- [ ] **Step 2: Append the SPA fallback rule at the end of the file**

Add this block to `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

This is a Netlify rewrite (status 200, not 301), serving `index.html` for any path so the SPA router takes over.

- [ ] **Step 3: Typecheck (sanity, no TS files touched)**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml
git commit -m "config(netlify): SPA fallback for client-side routes"
```

---

## Task 5: `lastLookup` module + wire `useLookup` to write/read

**Files:**
- Create: `src/lib/lastLookup.ts`
- Modify: `src/hooks/useLookup.ts`
- Modify: `src/pages/SweepPage.tsx`

Single localStorage key `sweep.lastLookup` storing the most recent successful lookup. `useLookup` writes on success. `<SweepPage/>` reads on mount and pre-populates the input. The new `<ParkingPage/>` (Task 14) will read from the same key.

- [ ] **Step 1: Create `src/lib/lastLookup.ts`**

```ts
/**
 * Single-entry localStorage façade for the most recent successful lookup.
 * Shared across Sweep and Parking modes so switching modes keeps your address.
 */

const KEY = 'sweep.lastLookup';

export interface LastLookup {
  address: string;
  lat: number;
  lon: number;
  timestamp: number;       // Date.now() at write
}

export const readLastLookup = (): LastLookup | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.address === 'string' &&
      typeof parsed?.lat === 'number' &&
      typeof parsed?.lon === 'number' &&
      typeof parsed?.timestamp === 'number'
    ) {
      return parsed as LastLookup;
    }
    return null;
  } catch {
    return null;
  }
};

export const writeLastLookup = (lookup: LastLookup): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(lookup));
  } catch {
    /* iOS Safari private mode — degrade gracefully */
  }
};
```

- [ ] **Step 2: Wire `useLookup` to write on success**

Open `src/hooks/useLookup.ts`. Find the point in the orchestration where the lookup is fully resolved (after geocode succeeds and at least the zone or schedule fetch has completed). Add a `writeLastLookup` call there.

The exact placement depends on the existing structure. Typical pattern: after `setStatus('ready')` or equivalent, add:

```ts
import { writeLastLookup } from '../lib/lastLookup';

// ... inside the lookup function, after success:
writeLastLookup({
  address: resolvedDisplayString,   // whatever string the hook surfaces as the canonical display
  lat: geocodeResult.lat,
  lon: geocodeResult.lon,
  timestamp: Date.now(),
});
```

If `useLookup`'s success path has multiple fetch-completion points (geocode succeeds but schedule fails, etc.), write `lastLookup` as soon as `geocode` succeeds — the address+coords are valid even if downstream fetches fail.

- [ ] **Step 3: Wire `<SweepPage/>` to read on mount**

Open `src/pages/SweepPage.tsx`. Add a `useEffect` near the top that pre-populates the input on mount and triggers a lookup if a prior value exists:

```tsx
import { useEffect } from 'react';
import { readLastLookup } from '../lib/lastLookup';

// Inside SweepPage(), before the existing return:
useEffect(() => {
  const last = readLastLookup();
  if (!last) return;
  // Pre-populate the input AND trigger the lookup. The exact API depends on
  // how AddressInput / useLookup are currently wired:
  //   - If useLookup exposes a `lookup({ kind: 'gps', lat, lon })` shape, call it.
  //   - If it only takes a string, call it with last.address.
  // Either path works because geocode/zone fetches are idempotent for the same input.
  triggerLookup(last);  // adapt to the actual function name in this file
}, []);
```

**Implementation note for the engineer:** read the existing `useLookup` API first; the call site here must match it. If the existing hook only exposes `lookup(addressString)`, call that. If it exposes both address-and-GPS variants, prefer GPS (`{ lat, lon }`) since it skips re-geocoding.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Visual smoke** — SKIP. Controller will smoke-test the persistence at a later checkpoint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lastLookup.ts src/hooks/useLookup.ts src/pages/SweepPage.tsx
git commit -m "feat(lastLookup): cross-mode localStorage façade — sweep mode wired"
```

---

## Task 6: `parseChicagoAddress` helper in `src/lib/address.ts`

**Files:**
- Modify: `src/lib/address.ts`

Adds a new exported function `parseChicagoAddress(input: string): ParsedAddress | null` that tokenizes a cleaned address string into `{ direction, name, type, number }`. Used in Task 8 for permit-zone lookup.

- [ ] **Step 1: Read the current `src/lib/address.ts`**

```bash
cat src/lib/address.ts
```

Note the existing exports (`cleanAddress`, etc.). Don't touch them; the new parser is additive.

- [ ] **Step 2: Append the new exports to `src/lib/address.ts`**

Add at the bottom of the file:

```ts
// ─── v6: Chicago address tokenization for permit-zone lookups ──────────────

export interface ParsedAddress {
  number: number;       // 1819
  direction: 'N' | 'S' | 'E' | 'W';
  name: string;         // 'CALIFORNIA' (uppercase, no type suffix)
  type: string;         // 'AVE' | 'ST' | 'BLVD' | ...
}

const STREET_TYPE_NORMALIZE: Record<string, string> = {
  AVENUE: 'AVE', AVE: 'AVE',
  STREET: 'ST', ST: 'ST',
  BOULEVARD: 'BLVD', BLVD: 'BLVD',
  PLACE: 'PL', PL: 'PL',
  ROAD: 'RD', RD: 'RD',
  DRIVE: 'DR', DR: 'DR',
  COURT: 'CT', CT: 'CT',
  TERRACE: 'TER', TER: 'TER',
  PARKWAY: 'PKWY', PKWY: 'PKWY',
  WAY: 'WAY',
  LANE: 'LN', LN: 'LN',
  SQUARE: 'SQ', SQ: 'SQ',
};

const DIRECTIONS = new Set(['N', 'S', 'E', 'W']);

/**
 * Tokenize a (cleaned) Chicago address string into permit-zone-compatible parts.
 * Returns null if the input doesn't include all four required parts.
 *
 * Accepts variations:
 *   "1819 S California Ave"  → { number: 1819, direction: 'S', name: 'CALIFORNIA', type: 'AVE' }
 *   "1819 S. California Avenue" → same
 *   "100 N State St" → { number: 100, direction: 'N', name: 'STATE', type: 'ST' }
 *
 * Caller should run cleanAddress() first to strip apt/zip/city/state.
 */
export const parseChicagoAddress = (input: string): ParsedAddress | null => {
  const tokens = input
    .toUpperCase()
    .replace(/\./g, '')          // strip dots: "S." → "S"
    .replace(/,/g, ' ')          // strip commas
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 4) return null;

  // First token: house number
  const number = parseInt(tokens[0], 10);
  if (!Number.isFinite(number)) return null;

  // Second token: cardinal direction
  const direction = tokens[1];
  if (!DIRECTIONS.has(direction)) return null;

  // Last token: street type (after normalization)
  const lastTokenRaw = tokens[tokens.length - 1];
  const type = STREET_TYPE_NORMALIZE[lastTokenRaw];
  if (!type) return null;

  // Middle tokens (between direction and type): street name
  const nameTokens = tokens.slice(2, -1);
  if (nameTokens.length === 0) return null;
  const name = nameTokens.join(' ');

  return {
    number,
    direction: direction as ParsedAddress['direction'],
    name,
    type,
  };
};
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Quick sanity script (one-off, not committed)**

Create `/tmp/test-parser.ts`:

```ts
import { parseChicagoAddress } from './src/lib/address';

const cases = [
  '1819 S California Ave',
  '1819 S. California Avenue',
  '100 N State St',
  '5500 N Lake Shore Drive',
  '2417 W North Avenue',
  'invalid garbage input',
  '1819 California Ave',  // no direction → should fail
  '',
];

for (const c of cases) {
  console.log(c, '→', parseChicagoAddress(c));
}
```

Run:

```bash
npx tsx /tmp/test-parser.ts
rm /tmp/test-parser.ts
```

Expected output: first five parse cleanly, last three return `null`. If anything misbehaves, fix the parser before committing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/address.ts
git commit -m "feat(address): parseChicagoAddress() — tokenize for permit-zone lookups"
```

---

## Task 7: `parkingMeters.ts` — ArcGIS Layer 40 fetch

**Files:**
- Create: `src/lib/parkingMeters.ts`

Pure module. Fetches pay-boxes within a bounding box from the Chicago ArcGIS MapServer. Same fetch pattern as the existing recycling/garbage modules.

- [ ] **Step 1: Verify CORS works browser-side from this hostname**

Before writing the module, run a quick browser-side fetch from a localhost dev shell to confirm Layer 40 is reachable. Open `http://localhost:5173` (or whatever the dev server uses) in a browser, open the JS console, and run:

```js
fetch('https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/40/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=1')
  .then(r => r.json())
  .then(d => console.log(d.features?.[0]));
```

Expected: a feature object with `attributes` (STREET_NAME, BLOCK_START, etc.) and `geometry` ({x, y}). If CORS blocks (the response is opaque or the browser logs a CORS error), STOP and report a BLOCKED status — Layer 40 cannot be reached from the browser, and the design needs revision.

- [ ] **Step 2: Create `src/lib/parkingMeters.ts`**

```ts
const PAYBOX_LAYER =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/40';

export interface Paybox {
  terminalId: number;
  street: string;            // 'S WESTERN AVE'
  blockStart: number;        // 4002
  blockEnd: number;          // 4008
  payboxAddr: number;        // 4006
  numSpaces: number;
  hourLimit: string;         // '2', '3'  — string of digits
  attributeDesc: string;     // '9 AM TO 9 PM MON-SAT' or '.'
  payZone: number;
  lat: number;
  lon: number;
}

interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

/**
 * Fetch all pay-box meters within a bounding box of `radiusMeters` around (lat, lon).
 *
 * Returns [] on any network or parse failure (silent degradation).
 */
export const fetchPayboxes = async (
  lat: number,
  lon: number,
  radiusMeters = 400,
): Promise<Paybox[]> => {
  // Convert radius in meters to lat/lon deltas (rough WGS84 conversion).
  const dLat = radiusMeters / 111_320;
  const dLon = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));

  const envelope = {
    xmin: lon - dLon,
    ymin: lat - dLat,
    xmax: lon + dLon,
    ymax: lat + dLat,
    spatialReference: { wkid: 4326 },
  };

  const url =
    `${PAYBOX_LAYER}/query?` +
    `geometry=${encodeURIComponent(JSON.stringify(envelope))}&` +
    `geometryType=esriGeometryEnvelope&` +
    `inSR=4326&outSR=4326&` +
    `spatialRel=esriSpatialRelIntersects&` +
    `outFields=*&returnGeometry=true&f=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[parkingMeters] HTTP', res.status);
      return [];
    }
    const data = await res.json();
    const features: ArcGISFeature[] = Array.isArray(data?.features) ? data.features : [];
    return features
      .map(toPaybox)
      .filter((p): p is Paybox => p !== null);
  } catch (err) {
    console.warn('[parkingMeters] fetch failed', err);
    return [];
  }
};

const toPaybox = (f: ArcGISFeature): Paybox | null => {
  const a = f.attributes ?? {};
  const g = f.geometry;
  if (!g || typeof g.x !== 'number' || typeof g.y !== 'number') return null;
  if (typeof a.TERMINAL_ID !== 'number') return null;
  return {
    terminalId: a.TERMINAL_ID as number,
    street: String(a.STREET_NAME ?? ''),
    blockStart: Number(a.BLOCK_START ?? 0),
    blockEnd: Number(a.BLOCK_END ?? 0),
    payboxAddr: Number(a.PAYBOX_ADDR ?? 0),
    numSpaces: Number(a.NUM_SPACES ?? 0),
    hourLimit: String(a.HOUR_LIMIT ?? ''),
    attributeDesc: String(a.ATTRIBUTE_DESC ?? ''),
    payZone: Number(a.PAY_ZONE ?? 0),
    lat: g.y,
    lon: g.x,
  };
};
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: One-off live verification (not committed)**

Create `/tmp/test-payboxes.ts`:

```ts
import { fetchPayboxes } from './src/lib/parkingMeters';

// Pilsen — 1819 S California Ave coordinates
fetchPayboxes(41.8567, -87.6973).then(p => {
  console.log('Got', p.length, 'payboxes');
  console.log('First 3:', p.slice(0, 3));
});
```

Run:

```bash
npx tsx /tmp/test-payboxes.ts
rm /tmp/test-payboxes.ts
```

Expected: 5+ payboxes returned with street names like "S CALIFORNIA AVE", "W CERMAK RD", etc. If 0 returned or an error, debug before committing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parkingMeters.ts
git commit -m "feat(parking): parkingMeters.ts — ArcGIS Layer 40 paybox fetch"
```

---

## Task 8: `permitZones.ts` — Socrata u9xt-hiju lookup

**Files:**
- Create: `src/lib/permitZones.ts`

Pure module. Looks up the residential permit zone (if any) for a parsed address. Returns null if the address isn't in any active permit zone.

- [ ] **Step 1: Create `src/lib/permitZones.ts`**

```ts
import type { ParsedAddress } from './address';

const PERMIT_ENDPOINT = 'https://data.cityofchicago.org/resource/u9xt-hiju.json';

export interface PermitZone {
  zone: string;              // '143'
  oddEven: 'E' | 'O' | 'B';  // even / odd / both
  buffer: boolean;
  wardLow: string;
  wardHigh: string;
}

interface RawPermitRow {
  zone?: string;
  odd_even?: string;
  buffer?: string;
  ward_low?: string;
  ward_high?: string;
  status?: string;
  address_range_low?: string;
  address_range_high?: string;
}

/**
 * Look up the residential permit zone for a parsed address. Returns null if no
 * matching active zone exists. Returns null silently on fetch errors.
 *
 * Dataset: https://data.cityofchicago.org/d/u9xt-hiju
 *   - Tabular street-range entries (no polygon)
 *   - odd_even is 'E' | 'O' | 'B' — 'B' means both sides
 *   - status is 'ACTIVE' for in-force zones
 */
export const lookupPermitZone = async (
  parsed: ParsedAddress,
): Promise<PermitZone | null> => {
  const where = [
    `street_direction='${parsed.direction}'`,
    `street_name='${parsed.name.replace(/'/g, "''")}'`,
    `street_type='${parsed.type}'`,
    `address_range_low<=${parsed.number}`,
    `address_range_high>=${parsed.number}`,
    `status='ACTIVE'`,
  ].join(' AND ');

  const url = `${PERMIT_ENDPOINT}?$where=${encodeURIComponent(where)}&$limit=10`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[permitZones] HTTP', res.status);
      return null;
    }
    const rows: RawPermitRow[] = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Filter by odd/even side parity
    const isEven = parsed.number % 2 === 0;
    const matching = rows.find(r => {
      const oe = r.odd_even;
      if (oe === 'B') return true;
      if (oe === 'E' && isEven) return true;
      if (oe === 'O' && !isEven) return true;
      return false;
    });
    if (!matching) return null;

    return {
      zone: String(matching.zone ?? ''),
      oddEven: (matching.odd_even ?? 'B') as PermitZone['oddEven'],
      buffer: matching.buffer === 'Y',
      wardLow: String(matching.ward_low ?? ''),
      wardHigh: String(matching.ward_high ?? ''),
    };
  } catch (err) {
    console.warn('[permitZones] fetch failed', err);
    return null;
  }
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: One-off live verification (not committed)**

Create `/tmp/test-permits.ts`:

```ts
import { lookupPermitZone } from './src/lib/permitZones';
import { parseChicagoAddress } from './src/lib/address';

const cases = [
  '1856 N Kenmore Ave',     // known active permit zone (from earlier API check)
  '1819 S California Ave',  // canonical test
  '100 N State St',         // downtown — likely no permit zone
];

(async () => {
  for (const addr of cases) {
    const parsed = parseChicagoAddress(addr);
    if (!parsed) { console.log(addr, '→ failed to parse'); continue; }
    const zone = await lookupPermitZone(parsed);
    console.log(addr, '→', zone);
  }
})();
```

Run:

```bash
npx tsx /tmp/test-permits.ts
rm /tmp/test-permits.ts
```

Expected: at least one address returns a permit zone object (e.g. Kenmore returns Zone 143). Some addresses return `null` legitimately. If everything returns null and that's unexpected, debug before committing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permitZones.ts
git commit -m "feat(parking): permitZones.ts — Socrata u9xt-hiju address lookup"
```

---

## Task 9: `meterHours.ts` — best-effort active-now parser

**Files:**
- Create: `src/lib/meterHours.ts`

Pure module. Parses the `ATTRIBUTE_DESC` field from a paybox into an active-now status. If the field is blank (`'.'` or empty) or unparseable, returns `state: 'unknown'`.

- [ ] **Step 1: Sample 50 random `ATTRIBUTE_DESC` values from live data (one-off)**

Create `/tmp/sample-attrs.ts`:

```ts
import { fetchPayboxes } from './src/lib/parkingMeters';

// Five widely-spaced sample points across the city
const samples: Array<[number, number]> = [
  [41.8567, -87.6973],   // Pilsen
  [41.9000, -87.6244],   // Downtown
  [41.9265, -87.6850],   // West Town
  [41.8327, -87.6324],   // Bronzeville
  [41.9742, -87.6684],   // Andersonville
];

(async () => {
  const all = await Promise.all(samples.map(([la, lo]) => fetchPayboxes(la, lo, 800)));
  const flat = all.flat();
  const unique = Array.from(new Set(flat.map(p => p.attributeDesc)));
  console.log('Total payboxes:', flat.length);
  console.log('Unique ATTRIBUTE_DESC values:', unique.length);
  unique.slice(0, 50).forEach((v, i) => console.log(`${i.toString().padStart(2)}  "${v}"`));
})();
```

Run:

```bash
npx tsx /tmp/sample-attrs.ts > /tmp/attrs-sample.txt
cat /tmp/attrs-sample.txt
```

Inspect the output. Categorize the values:
- How many are `'.'` (blank)?
- How many match `\d+\s*(AM|PM)\s*TO\s*\d+\s*(AM|PM)\s+(MON-FRI|MON-SAT|MON-SUN|DAILY)`?
- What other patterns appear (e.g., `"FREE SUN"`, `"NO PARKING ..."`, multi-line conditions)?

**Decision rule:**
- If ≥80% of non-blank values match the basic pattern, proceed with the full parser below.
- If 50–80%, ship the full parser but expect more `'unknown'` results.
- If <50%, **skip the parser entirely** — implement only the blank check and always return `state: 'unknown', detail: attributeDesc`. Note this in the commit message and report it to the controller.

Clean up the sample file:

```bash
rm /tmp/sample-attrs.ts /tmp/attrs-sample.txt
```

- [ ] **Step 2: Create `src/lib/meterHours.ts` with the full parser**

```ts
export interface ActiveStatus {
  state: 'active' | 'free' | 'unknown';
  /** When the state will change next (in `active` or `free` states only). */
  until?: Date;
  /** Human-readable detail line. Empty string if no detail to show. */
  detail: string;
}

const DAY_PATTERNS: Record<string, number[]> = {
  'MON-FRI': [1, 2, 3, 4, 5],
  'MON-SAT': [1, 2, 3, 4, 5, 6],
  'MON-SUN': [0, 1, 2, 3, 4, 5, 6],
  'DAILY': [0, 1, 2, 3, 4, 5, 6],
  'SUN': [0],
  'SAT': [6],
};

const HOURS_REGEX = /(\d{1,2})\s*(AM|PM)\s*TO\s*(\d{1,2})\s*(AM|PM)/i;

const to24h = (hour: number, ampm: string): number => {
  const a = ampm.toUpperCase();
  if (a === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
};

const formatHourShort = (date: Date): string => {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
};

const formatRelativeTo = (target: Date, now: Date): string => {
  const ms = target.getTime() - now.getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `in ${hours}h` : `in ${hours}h ${mins}m`;
};

/**
 * Compute whether a meter is actively metered right now based on its hours string.
 *
 * Returns 'unknown' for blank ('.' or '') or unparseable strings; the badge UI
 * either hides or falls back to the raw string in those cases.
 */
export const computeActiveStatus = (now: Date, attributeDesc: string): ActiveStatus => {
  const desc = (attributeDesc ?? '').trim();
  if (!desc || desc === '.') {
    return { state: 'unknown', detail: '' };
  }

  const upper = desc.toUpperCase();
  const hoursMatch = upper.match(HOURS_REGEX);
  if (!hoursMatch) {
    return { state: 'unknown', detail: desc };
  }

  const startH = to24h(parseInt(hoursMatch[1], 10), hoursMatch[2]);
  const endH = to24h(parseInt(hoursMatch[3], 10), hoursMatch[4]);

  // Determine which days the schedule applies to.
  let activeDays: number[] | null = null;
  for (const [pattern, days] of Object.entries(DAY_PATTERNS)) {
    if (upper.includes(pattern)) {
      activeDays = days;
      break;
    }
  }
  if (!activeDays) {
    // Default to Mon-Sat if no day pattern detected (most common Chicago schedule)
    activeDays = [1, 2, 3, 4, 5, 6];
  }

  const today = now.getDay();
  const hour = now.getHours();
  const isActiveDay = activeDays.includes(today);
  const isActiveHour = hour >= startH && hour < endH;

  if (isActiveDay && isActiveHour) {
    const until = new Date(now);
    until.setHours(endH, 0, 0, 0);
    return {
      state: 'active',
      until,
      detail: `Active until ${formatHourShort(until)} (${formatRelativeTo(until, now)})`,
    };
  }

  if (isActiveDay && hour < startH) {
    const until = new Date(now);
    until.setHours(startH, 0, 0, 0);
    return {
      state: 'free',
      until,
      detail: `Free until ${formatHourShort(until)}`,
    };
  }

  // Past today's window or non-active day: free until next active-day's start
  const next = new Date(now);
  next.setHours(startH, 0, 0, 0);
  for (let i = 1; i <= 7; i++) {
    next.setDate(now.getDate() + i);
    if (activeDays.includes(next.getDay())) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][next.getDay()];
      return {
        state: 'free',
        until: next,
        detail: `Free until ${formatHourShort(next)} ${dayName}`,
      };
    }
  }

  return { state: 'unknown', detail: desc };
};
```

- [ ] **Step 3: Quick parser sanity check (one-off)**

Create `/tmp/test-meter-hours.ts`:

```ts
import { computeActiveStatus } from './src/lib/meterHours';

// Fixed reference time: Saturday May 2 2026 at 8:00 PM
const now = new Date(2026, 4, 2, 20, 0, 0);

const cases = [
  '9 AM TO 9 PM MON-SAT',     // active until 9pm tonight
  '8 AM TO 6 PM MON-FRI',     // free, weekend
  '9 AM TO 9 PM DAILY',       // active until 9pm tonight
  '.',                          // unknown
  '',                           // unknown
  'NO PARKING TUESDAY 9-12',    // unparseable → unknown
];

for (const c of cases) {
  console.log(`"${c}" →`, computeActiveStatus(now, c));
}
```

Run:

```bash
npx tsx /tmp/test-meter-hours.ts
rm /tmp/test-meter-hours.ts
```

Expected: first three return active/free/active with sensible `until` times and `detail` strings. Last three return `state: 'unknown'`. If anything looks wrong, fix the parser.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meterHours.ts
git commit -m "feat(parking): meterHours.ts — best-effort ATTRIBUTE_DESC active-now parser"
```

(If Step 1 indicated <50% parse coverage and you shipped the blank-only fallback instead, use the message: `feat(parking): meterHours.ts — blank-aware status, defers parsing to v2`.)

---

## Task 10: `useParking` hook

**Files:**
- Create: `src/hooks/useParking.ts`

Orchestrates the three parallel fetches (paybox, zone+schedule, permit) plus the active-now annotation and distance/bearing computation. Returns a `useLookup`-shaped API.

- [ ] **Step 1: Create `src/hooks/useParking.ts`**

```ts
import { useCallback, useState } from 'react';
import { fetchPayboxes, type Paybox } from '../lib/parkingMeters';
import { lookupPermitZone, type PermitZone } from '../lib/permitZones';
import { parseChicagoAddress } from '../lib/address';
import { cleanAddress } from '../lib/address';
import { lookupZone } from '../lib/zones';
import { fetchSchedule } from '../lib/schedule';
import { geocode } from '../lib/geocode';
import { computeActiveStatus, type ActiveStatus } from '../lib/meterHours';
import { writeLastLookup } from '../lib/lastLookup';
import type { SweepDate } from '../types';

export type AnnotatedPaybox = Paybox & {
  active: ActiveStatus;
  distanceMeters: number;
  bearingDeg: number;
};

export interface ParkingResult {
  address: string;
  lat: number;
  lon: number;
  payboxes: AnnotatedPaybox[];
  nextSweep: SweepDate | null;
  permitZone: PermitZone | null;
}

export interface UseParkingApi {
  status: 'idle' | 'loading' | 'ready' | 'error';
  result: ParkingResult | null;
  error: string | null;
  lookup: (
    input:
      | { kind: 'address'; text: string }
      | { kind: 'gps'; lat: number; lon: number; address?: string },
  ) => Promise<void>;
}

/** Haversine — distance in meters between two lat/lon points. */
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Initial bearing in degrees (0 = North, 90 = East). */
const bearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const annotate = (origin: { lat: number; lon: number }, p: Paybox, now: Date): AnnotatedPaybox => ({
  ...p,
  distanceMeters: haversine(origin.lat, origin.lon, p.lat, p.lon),
  bearingDeg: bearing(origin.lat, origin.lon, p.lat, p.lon),
  active: computeActiveStatus(now, p.attributeDesc),
});

export const useParking = (): UseParkingApi => {
  const [status, setStatus] = useState<UseParkingApi['status']>('idle');
  const [result, setResult] = useState<ParkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback<UseParkingApi['lookup']>(async (input) => {
    setStatus('loading');
    setError(null);

    try {
      // Resolve to (address, lat, lon)
      let address: string;
      let lat: number;
      let lon: number;

      if (input.kind === 'gps') {
        lat = input.lat;
        lon = input.lon;
        address = input.address ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      } else {
        const cleaned = cleanAddress(input.text);
        const geo = await geocode(cleaned);
        if (!geo) {
          setError("Couldn't find that address.");
          setStatus('error');
          return;
        }
        address = geo.display ?? cleaned;
        lat = geo.lat;
        lon = geo.lon;
      }

      // Persist for cross-mode memory
      writeLastLookup({ address, lat, lon, timestamp: Date.now() });

      // Parallel: payboxes, zone (which feeds schedule), permit zone
      const parsed = parseChicagoAddress(cleanAddress(address));
      const [payboxes, zone, permitZone] = await Promise.all([
        fetchPayboxes(lat, lon, 400),
        lookupZone(lat, lon),
        parsed ? lookupPermitZone(parsed) : Promise.resolve(null),
      ]);

      // Schedule depends on zone — sequential after zone resolves
      let nextSweep: SweepDate | null = null;
      if (zone) {
        const schedule = await fetchSchedule(zone.ward, zone.section);
        // Pick the next sweep date from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextSweep = schedule
          .filter(d => d.date.getTime() >= today.getTime())
          .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
      }

      const now = new Date();
      const origin = { lat, lon };
      const annotated = payboxes
        .map(p => annotate(origin, p, now))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      setResult({ address, lat, lon, payboxes: annotated, nextSweep, permitZone });
      setStatus('ready');
    } catch (err) {
      console.warn('[useParking] lookup failed', err);
      setError('Something went wrong. Try again.');
      setStatus('error');
    }
  }, []);

  return { status, result, error, lookup };
};
```

**Implementation notes for the engineer:**
- The exact `geocode()` return shape may differ in this codebase; adapt the `geo.display` / `geo.lat` / `geo.lon` field accesses to match `src/lib/geocode.ts`'s actual return type. Read that file first if unsure.
- `lookupZone()` and `fetchSchedule()` are already used by `useLookup.ts`; copy the same call patterns.
- `SweepDate` import path may differ; confirm against `src/types.ts`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If you hit unknown imports (`geocode`, `lookupZone`, `fetchSchedule`, `SweepDate`), fix them per the existing modules' actual exports.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useParking.ts
git commit -m "feat(parking): useParking hook — parallel paybox + zone + permit lookup"
```

---

## Task 11: `ParkingMap` component (Leaflet wrapper)

**Files:**
- Create: `src/components/ParkingMap.tsx`
- Modify: `src/index.css` (add Leaflet CSS import)

Raw Leaflet (no `react-leaflet` dependency). Imperative map managed via refs + useEffects. Tile URL swaps with dark mode. Pins styled per active-now state. User-location pin is a chicago-blue Chicago star.

- [ ] **Step 1: Add Leaflet's CSS to `src/index.css`**

At the very top of `src/index.css`, add:

```css
@import 'leaflet/dist/leaflet.css';
```

(Place it before the existing `@import url('https://fonts.googleapis.com/...')` line. CSS imports must come before any other rules.)

- [ ] **Step 2: Create `src/components/ParkingMap.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { AnnotatedPaybox } from '../hooks/useParking';
import { STAR_PATH_D } from './ChicagoStar';

interface Props {
  center: { lat: number; lon: number };
  payboxes: AnnotatedPaybox[];
  selectedTerminalId: number | null;
  onSelectMeter: (terminalId: number) => void;
  isDark: boolean;
}

const TILE_LIGHT = 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
  'Stamen via <a href="https://stadiamaps.com/">Stadia</a>';

const buildMeterIcon = (active: AnnotatedPaybox['active']['state'], selected: boolean): L.DivIcon => {
  const fillColor = selected ? '#41B6E6' : '#C8102E';  // chicago-blue when selected, chicago-red otherwise
  const filled = active === 'active';
  const html = filled
    ? `<div style="width:10px;height:10px;border-radius:50%;background:${fillColor};border:2px solid ${fillColor};"></div>`
    : `<div style="width:10px;height:10px;border-radius:50%;background:transparent;border:2px solid ${fillColor};"></div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const buildUserIcon = (): L.DivIcon => {
  const star = `<svg viewBox="-1.1 -1.1 2.2 2.2" width="20" height="20" fill="#41B6E6"><path d="${STAR_PATH_D}"/></svg>`;
  return L.divIcon({
    html: star,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

export const ParkingMap = ({ center, payboxes, selectedTerminalId, onSelectMeter, isDark }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize the map exactly once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lon],
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
    });
    tileLayerRef.current = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Recenter when the lookup point changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([center.lat, center.lon], 16);

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([center.lat, center.lon]);
    } else {
      userMarkerRef.current = L.marker([center.lat, center.lon], {
        icon: buildUserIcon(),
        interactive: false,
      }).addTo(mapRef.current);
    }
  }, [center.lat, center.lon]);

  // Swap tile URL on dark mode toggle
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(isDark ? TILE_DARK : TILE_LIGHT);
  }, [isDark]);

  // Sync paybox markers with the current payboxes array
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const existing = markersRef.current;
    const incoming = new Set(payboxes.map(p => p.terminalId));

    // Remove markers no longer in the list
    for (const [id, marker] of existing) {
      if (!incoming.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    // Add or update markers for current list
    for (const p of payboxes) {
      const isSelected = p.terminalId === selectedTerminalId;
      const icon = buildMeterIcon(p.active.state, isSelected);
      let marker = existing.get(p.terminalId);
      if (!marker) {
        marker = L.marker([p.lat, p.lon], { icon }).addTo(map);
        marker.on('click', () => onSelectMeter(p.terminalId));
        existing.set(p.terminalId, marker);
      } else {
        marker.setLatLng([p.lat, p.lon]);
        marker.setIcon(icon);
      }
    }
  }, [payboxes, selectedTerminalId, onSelectMeter]);

  return <div ref={containerRef} className="w-full h-[280px] lg:h-full lg:min-h-[480px] border border-ink" />;
};
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ParkingMap.tsx src/index.css
git commit -m "feat(parking): ParkingMap component — Leaflet + Stamen Toner with meter pins"
```

---

## Task 12: `MeterList` component

**Files:**
- Create: `src/components/MeterList.tsx`

Renders annotated payboxes as a list with active-now badges. Single-purpose, no fetches.

- [ ] **Step 1: Create `src/components/MeterList.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { AnnotatedPaybox } from '../hooks/useParking';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  payboxes: AnnotatedPaybox[];
  selectedTerminalId: number | null;
  onSelectMeter: (terminalId: number) => void;
  onHoverMeter: (terminalId: number | null) => void;
}

const cardinalFromBearing = (deg: number): string => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
};

const formatDistance = (meters: number): string => {
  const feet = Math.round(meters * 3.281);
  return `${feet} ft`;
};

const badgeForState = (state: AnnotatedPaybox['active']['state']): { label: string; color: string } => {
  switch (state) {
    case 'active':
      return { label: 'ACTIVE', color: 'text-chicago-red' };
    case 'free':
      return { label: 'FREE NOW', color: 'text-chicago-blue' };
    default:
      return { label: 'HOURS UNSPECIFIED', color: 'text-ink-soft' };
  }
};

export const MeterList = ({ payboxes, selectedTerminalId, onSelectMeter, onHoverMeter }: Props) => {
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  // When the selected meter changes (typically from a map pin click), scroll its row into view.
  useEffect(() => {
    if (selectedTerminalId == null) return;
    const row = rowRefs.current.get(selectedTerminalId);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedTerminalId]);

  if (payboxes.length === 0) {
    return (
      <div className="border border-ink/40 p-4 font-mono text-sm text-ink-soft italic">
        No metered parking within 3 blocks. Try a larger area or a different address.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink/30 border-t border-b border-ink/30 max-h-[480px] overflow-y-auto">
      {payboxes.map(p => {
        const isSelected = p.terminalId === selectedTerminalId;
        const badge = badgeForState(p.active.state);
        return (
          <li
            key={p.terminalId}
            ref={el => {
              if (el) rowRefs.current.set(p.terminalId, el);
              else rowRefs.current.delete(p.terminalId);
            }}
            onClick={() => onSelectMeter(p.terminalId)}
            onMouseEnter={() => onHoverMeter(p.terminalId)}
            onMouseLeave={() => onHoverMeter(null)}
            className={`px-3 py-3 cursor-pointer transition-colors ${
              isSelected ? 'bg-chicago-blue/10 border-l-4 border-l-chicago-blue' : 'hover:bg-ink/5'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink">
                {p.street} · {p.payboxAddr}
              </div>
              <div className={`font-mono text-[10px] tracking-[0.25em] uppercase flex items-center gap-1.5 ${badge.color}`}>
                <ChicagoStar size={8} />
                {badge.label}
              </div>
            </div>
            <div className="font-sans text-xs text-ink-soft mt-1">
              {formatDistance(p.distanceMeters)} {cardinalFromBearing(p.bearingDeg)} · {p.numSpaces} spaces · {p.hourLimit}hr max
              {p.attributeDesc && p.attributeDesc !== '.' && (
                <> · {p.attributeDesc.toLowerCase()}</>
              )}
            </div>
            {p.active.detail && (
              <div className="font-serif italic text-xs text-ink-soft mt-1">{p.active.detail}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/MeterList.tsx
git commit -m "feat(parking): MeterList component — rows with active-now badges"
```

---

## Task 13: `PermitBadge` component

**Files:**
- Create: `src/components/PermitBadge.tsx`

Single-card editorial notice. Renders nothing if zone is null.

- [ ] **Step 1: Create `src/components/PermitBadge.tsx`**

```tsx
import type { PermitZone } from '../lib/permitZones';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  zone: PermitZone | null;
}

export const PermitBadge = ({ zone }: Props) => {
  if (!zone) return null;
  return (
    <div className="border-2 border-chicago-red px-4 py-3" style={{ background: 'var(--tint-urgency)' }}>
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
        <ChicagoStar size={9} />
        Section II.b — Permit Zone
      </div>
      <div className="font-serif text-2xl text-ink leading-tight mt-1">
        Zone {zone.zone}
      </div>
      <div className="font-sans text-sm text-ink-soft mt-1">
        Residential permit required. Without a valid Zone {zone.zone} sticker you risk a citation.
        {zone.buffer && ' (Buffer block — visitor passes apply.)'}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/PermitBadge.tsx
git commit -m "feat(parking): PermitBadge component — Section II.b zone notice"
```

---

## Task 14: `ParkingPage` component

**Files:**
- Create: `src/pages/ParkingPage.tsx`

Composes `<AddressInput/>`, `<ParkingMap/>`, `<MeterList/>`, `<PermitBadge/>`, plus a small inline sweep banner. Reads `lastLookup` on mount and auto-triggers a lookup. Manages `selectedTerminalId` state for map ↔ list sync.

- [ ] **Step 1: Create `src/pages/ParkingPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParking } from '../hooks/useParking';
import { useTheme } from '../hooks/useTheme';
import { readLastLookup } from '../lib/lastLookup';
import { AddressInput } from '../components/AddressInput';
import { ParkingMap } from '../components/ParkingMap';
import { MeterList } from '../components/MeterList';
import { PermitBadge } from '../components/PermitBadge';
import { ChicagoStar } from '../components/ChicagoStar';
import { ErrorPanel } from '../components/ErrorPanel';
import { dayOfWeek, daysFromToday, monthName } from '../lib/dates';
import type { SweepDate } from '../types';

const SweepBanner = ({ next, address }: { next: SweepDate | null; address: string }) => {
  if (!next) return null;
  const days = daysFromToday(next.date);
  const when =
    days === 0 ? 'today' :
    days === 1 ? 'tomorrow' :
    days < 0 ? `${Math.abs(days)} days ago` :
    `in ${days} days`;
  return (
    <div className="border-2 border-chicago-blue px-4 py-3" style={{ background: 'var(--tint-calm)' }}>
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-blue flex items-center gap-1.5">
        <ChicagoStar size={9} />
        Section II.a — Next Sweep
      </div>
      <div className="font-serif text-2xl text-ink leading-tight mt-1">
        {dayOfWeek(next.date)} {monthName(next.date)} {next.date.getDate()}
      </div>
      <div className="font-sans text-sm text-ink-soft mt-1">
        At <span className="font-medium">{address}</span> — {when}.
      </div>
    </div>
  );
};

const EmptyMapPlaceholder = () => (
  <div className="border border-ink h-[280px] lg:min-h-[480px] flex items-center justify-center text-ink-soft text-center px-6">
    <div>
      <div className="font-serif text-6xl tracking-[-0.04em]">II</div>
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase mt-3">
        Type an address or use<br/>current location
      </div>
    </div>
  </div>
);

export const ParkingPage = () => {
  const { status, result, error, lookup } = useParking();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);

  // Pre-populate from lastLookup on mount
  useEffect(() => {
    document.title = 'The Sweep — Parking Nearby';
    const last = readLastLookup();
    if (last) {
      lookup({ kind: 'gps', lat: last.lat, lon: last.lon, address: last.address });
    }
  }, [lookup]);

  return (
    <main className="px-5 py-6 print:hidden">
      {/* Section I — Lookup */}
      <AddressInput
        onSubmit={(text) => lookup({ kind: 'address', text })}
        onUseLocation={(lat, lon) => lookup({ kind: 'gps', lat, lon })}
        loading={status === 'loading'}
      />

      {error && status === 'error' && <ErrorPanel message={error} onDismiss={() => { /* noop */ }} />}

      {result && (
        <>
          {/* Section II — Notices (side-by-side on desktop) */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SweepBanner next={result.nextSweep} address={result.address} />
            <PermitBadge zone={result.permitZone} />
          </div>

          {/* Sections III + IV — Map + Meter list (side-by-side on desktop) */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-blue flex items-center gap-1.5">
                <ChicagoStar size={9} /> Section III — Map
              </div>
              <ParkingMap
                center={{ lat: result.lat, lon: result.lon }}
                payboxes={result.payboxes}
                selectedTerminalId={selectedTerminalId}
                onSelectMeter={setSelectedTerminalId}
                isDark={isDark}
              />
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-red flex items-center gap-1.5">
                <ChicagoStar size={9} /> Section IV — Nearby meters ({result.payboxes.length})
              </div>
              <MeterList
                payboxes={result.payboxes}
                selectedTerminalId={selectedTerminalId}
                onSelectMeter={setSelectedTerminalId}
                onHoverMeter={setSelectedTerminalId}
              />
            </div>
          </div>
        </>
      )}

      {!result && status !== 'loading' && (
        <div className="mt-6">
          <EmptyMapPlaceholder />
        </div>
      )}
    </main>
  );
};

export default ParkingPage;  // for React.lazy
```

**Implementation notes for the engineer:**
- Read `src/components/AddressInput.tsx` first — its props may be named differently (e.g., `onLookup` instead of `onSubmit`). Adapt the prop names to match.
- The dates helpers `dayOfWeek`, `daysFromToday`, `monthName` come from `src/lib/dates.ts` — confirm exports.
- `SweepDate` type from `src/types.ts` — confirm import path.
- `default export` at bottom is required so `React.lazy(() => import('../pages/ParkingPage'))` works (React.lazy needs a default export).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. Fix any prop-name mismatches against the actual `<AddressInput/>` API.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ParkingPage.tsx
git commit -m "feat(parking): ParkingPage — composes map, list, banners with map↔list sync"
```

---

## Task 15: Wire `ParkingPage` into the router (lazy)

**Files:**
- Modify: `src/App.tsx`

Adds the `/parking` route, lazy-loaded. Adds a small Suspense fallback.

- [ ] **Step 1: Update `src/App.tsx`**

Replace the existing `<Switch>` content:

```tsx
import { Suspense, lazy } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { Masthead } from './components/Masthead';
import { Footnotes } from './components/Footnotes';
import { SweepPage } from './pages/SweepPage';

const ParkingPage = lazy(() => import('./pages/ParkingPage'));

const ParkingFallback = () => (
  <div className="px-5 py-12 text-center font-mono text-[10px] tracking-[0.3em] uppercase text-ink-soft">
    Loading map…
  </div>
);

export default function App() {
  return (
    <PageFrame>  {/* preserve existing wrapper */}
      <Masthead />
      <Switch>
        <Route path="/" component={SweepPage} />
        <Route path="/parking">
          <Suspense fallback={<ParkingFallback />}>
            <ParkingPage />
          </Suspense>
        </Route>
        <Route><Redirect to="/" /></Route>
      </Switch>
      <Footnotes />
    </PageFrame>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Build to verify code-splitting works**

```bash
npm run build
```

Expected: build succeeds, the build output shows TWO chunks (the main bundle + a separate chunk containing the parking module). The parking chunk should include `leaflet` (~40kb gzipped).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): wire /parking route — lazy-loaded ParkingPage"
```

---

## Task 16: `ModeToggle` component + mount in Masthead

**Files:**
- Create: `src/components/ModeToggle.tsx`
- Modify: `src/components/Masthead.tsx`

The user-facing entry point. Two `<Link>` components in the edition bar, styled identically to the existing `<ThemeToggle/>`.

- [ ] **Step 1: Create `src/components/ModeToggle.tsx`**

```tsx
import { Link, useLocation } from 'wouter';

/**
 * Edition-bar text toggle: `Sweep · Parking`. Active mode in chicago-red, inactive
 * in ink-soft with hover. Each label is a real <Link> (semantic anchor, bookmarkable).
 */
export const ModeToggle = () => {
  const [location] = useLocation();
  const isParking = location.startsWith('/parking');

  const baseLink =
    'print:hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-chicago-red';
  const active = 'text-chicago-red';
  const inactive = 'text-ink-soft hover:text-ink transition-colors cursor-pointer';

  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href="/"
        aria-label="Switch to sweep mode"
        aria-current={isParking ? undefined : 'page'}
        className={`${baseLink} ${isParking ? inactive : active}`}
      >
        Sweep
      </Link>
      <span className="text-ink-soft" aria-hidden>·</span>
      <Link
        href="/parking"
        aria-label="Switch to parking mode"
        aria-current={isParking ? 'page' : undefined}
        className={`${baseLink} ${isParking ? active : inactive}`}
      >
        Parking
      </Link>
    </span>
  );
};
```

- [ ] **Step 2: Mount `<ModeToggle/>` in the Masthead's edition bar**

Open `src/components/Masthead.tsx`. The edition bar currently has three slots: `Vol. ... · No. 1`, the date, and `<ThemeToggle/>`. Add `<ModeToggle/>` as the new rightmost slot, with `<ThemeToggle/>` moving to share that slot.

The existing edition-bar `<div>` looks something like:

```tsx
<div className="px-5 py-2 flex items-center justify-between border-b border-ink/40 ...">
  <span className="text-ink">Vol. {SCHEDULE_YEAR} · No. 1</span>
  <span className="text-ink-soft hidden sm:inline">{todayLong}</span>
  <ThemeToggle />
</div>
```

Replace the trailing `<ThemeToggle />` with a wrapper containing both toggles:

```tsx
<div className="px-5 py-2 flex items-center justify-between border-b border-ink/40 ...">
  <span className="text-ink">Vol. {SCHEDULE_YEAR} · No. 1</span>
  <span className="text-ink-soft hidden sm:inline">{todayLong}</span>
  <span className="inline-flex items-center gap-3">
    <ModeToggle />
    <ThemeToggle />
  </span>
</div>
```

Add the import alongside the existing `ThemeToggle` import:

```tsx
import { ModeToggle } from './ModeToggle';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Visual smoke** — SKIP. Controller will browser-smoke at the next checkpoint.

- [ ] **Step 5: Commit**

```bash
git add src/components/ModeToggle.tsx src/components/Masthead.tsx
git commit -m "feat(parking): ModeToggle in edition bar — Sweep · Parking <Link> nav"
```

---

## Task 17: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

Document the new data sources, routing layer, lastLookup façade, the new files in the file tree, and bump the roadmap.

- [ ] **Step 1: Read the current `CLAUDE.md` to find anchors**

```bash
cat CLAUDE.md
```

Locate these sections:
- `## Data sources` — append two new entries (Pay-box meters, Permit zones)
- `### 6. localStorage façades` — append `lastLookup`
- `## Architecture` — note routing
- `## File structure` — add the new files
- `### Shipped` — append v6
- `### Backlog` — confirm parking-related items are listed (snow routes, etc.) and add v2 follow-ups (loading zones, tow zones, dollar rates)

- [ ] **Step 2: Append two new entries under `## Data sources`**

After the existing **6. localStorage façades** section, add:

```markdown
### 7. Pay-box meters (parking)

- **Endpoint:** ArcGIS Layer 40 `DATA_ADMIN.REV_PARKING_PAYBOXES` on the same MapServer as recycling/garbage:
  ```
  https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/40
  ```
- **Spatial query (bounding box):**
  ```
  /query?geometry={"xmin":..,"ymin":..,"xmax":..,"ymax":..,"spatialReference":{"wkid":4326}}
        &geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326
        &spatialRel=esriSpatialRelIntersects
        &outFields=*&returnGeometry=true&f=json
  ```
  Convert radius-in-meters to lat/lon deltas: `dLat = r / 111320`, `dLon = r / (111320 * cos(lat·π/180))`.
- **Returned fields used:** `TERMINAL_ID`, `STREET_NAME`, `BLOCK_START`, `BLOCK_END`, `PAYBOX_ADDR`, `NUM_SPACES`, `HOUR_LIMIT`, `ATTRIBUTE_DESC`, `PAY_ZONE`, `geometry.x`, `geometry.y`.
- **Critical quirk:** `HOURLY_RATE` is `0.0` for many rows — rates derive from `PAY_ZONE` via Schedule 10 (PDF). v1 displays "Metered" + max-time only; dollar rates are v2.
- **Critical quirk:** `ATTRIBUTE_DESC` is `"."` for many rows. Treat as "no special hours documented" — show meter, badge says "hours unspecified."

### 8. Permit zones

- **Endpoint:** Socrata `u9xt-hiju` — `https://data.cityofchicago.org/resource/u9xt-hiju.json`
- **Critical quirk:** Tabular, not polygons. Each row = a street range (`address_range_low`/`high` + `odd_even` parity). Cannot be drawn on a map without joining to a streets-centerline dataset; v1 surfaces it only as a per-address text badge.
- **Lookup query:**
  ```
  ?$where=street_direction='S' AND street_name='CALIFORNIA' AND street_type='AVE'
         AND address_range_low<=1819 AND address_range_high>=1819
         AND status='ACTIVE'
  &$limit=10
  ```
  Filter `odd_even` ('E'/'O'/'B') against the input house-number parity client-side.
- **Returns:** `{ zone, odd_even, buffer, ward_low, ward_high }`.
```

- [ ] **Step 3: Append `lastLookup` to the localStorage façades section**

In `### 6. localStorage façades`, add a new bullet at the bottom:

```markdown
- `lib/lastLookup.ts` — `sweep.lastLookup` key, single entry containing `{ address, lat, lon, timestamp }` of the most recent successful lookup. Both Sweep and Parking pages read on mount and write on success — switching modes preserves the last search.
```

- [ ] **Step 4: Add a "Routing" subsection under `## Architecture`**

After the architecture diagram, add:

```markdown
### Routing

Two routes via `wouter` (~1.5kb, hooks-based). `/` → `<SweepPage/>` (the original app body), `/parking` → `<ParkingPage/>` (lazy-loaded). Unknown routes redirect to `/`. The masthead and footnotes render outside the `<Switch/>` so they're shared chrome. Production needs `netlify.toml`'s `/* → /index.html (200)` rewrite for direct-nav to `/parking`.
```

- [ ] **Step 5: Update `## File structure` block**

Add to the tree:

```
└── src/
    ├── pages/                       # NEW (split from App.tsx)
    │   ├── SweepPage.tsx            # Original App body
    │   └── ParkingPage.tsx          # Lazy-loaded; map + meter list + notices
    ├── lib/
    │   ├── lastLookup.ts            # sweep.lastLookup localStorage façade (cross-mode)
    │   ├── meterHours.ts            # Best-effort ATTRIBUTE_DESC parser
    │   ├── parkingMeters.ts         # ArcGIS Layer 40 paybox fetch
    │   └── permitZones.ts           # Socrata u9xt-hiju lookup
    ├── hooks/
    │   └── useParking.ts            # Orchestrates paybox + zone + permit
    └── components/
        ├── MeterList.tsx            # Active-now badged list
        ├── ModeToggle.tsx           # Sweep · Parking <Link> in edition bar
        ├── ParkingMap.tsx           # Leaflet wrapper
        └── PermitBadge.tsx          # Section II.b zone notice
```

(Insert in alphabetical order within each section, matching the existing tree formatting.)

- [ ] **Step 6: Append v6 entry to `### Shipped`**

```markdown
- **v6 — Parking nearby.** Second route at `/parking` showing metered pay-boxes within ~3 blocks of an address (typed or GPS) on a Leaflet + Stamen Toner map. Each meter annotated active-now / free-now from `ATTRIBUTE_DESC`. Single banner shows next street sweep + residential permit zone for the destination address. `lastLookup` localStorage shares the most recent search across Sweep and Parking modes.
```

- [ ] **Step 7: Add v2 candidates to `### Backlog`**

Append after the existing backlog items:

```markdown
6. **Parking v2: dollar rates** — wire `PAY_ZONE` → Schedule 10 PDF lookup for per-meter $/hr.
7. **Parking v2: loading + tow + no-stopping zones** — same MapServer likely has these layers; smoke-test before adding.
8. **Parking v2: per-meter sweep cross-reference** — currently address-level; per-meter granularity matters when the radius straddles a section boundary.
```

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document v6 parking nearby — data sources, routing, files, roadmap"
```

---

## Done criteria

After all 17 tasks, the following are true:

1. `npm run typecheck` clean. `npm run build` clean and produces a separate parking chunk.
2. `/` renders the existing Sweep mode unchanged (visually identical to pre-v6).
3. `/parking` loads (Suspense fallback briefly), shows the empty Roman-numeral placeholder before any lookup.
4. Looking up an address in either mode pre-populates the other mode on switch.
5. Meter list shows ≥5 meters near `1819 S California Ave` with active-now badges.
6. Map renders Stamen Toner Lite tiles with red meter pins + a chicago-blue ChicagoStar at the lookup point.
7. Clicking a pin highlights the corresponding list row; hovering a row highlights the corresponding pin.
8. Sweep banner appears with the next sweep date for the address.
9. Permit badge appears when the address falls in an active permit zone, otherwise omitted.
10. Browser back/forward navigates between routes.
11. Direct nav to `http://localhost:5173/parking` (no prior `/`) loads the parking page (Vite history fallback locally; Netlify rewrite for prod).
12. Toggling dark mode swaps map tiles to Stamen Toner dark; pins stay legible.
13. Print preview from `/` renders the existing B&W broadsheet. Print preview from `/parking` renders blank/hidden (`print:hidden` at root).
14. CLAUDE.md documents the two new data sources, routing, files, lastLookup, and v6 in the roadmap.

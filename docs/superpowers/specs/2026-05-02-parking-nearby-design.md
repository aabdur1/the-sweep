# Parking Nearby — Design Spec

**Status:** approved
**Date:** 2026-05-02
**Working title:** v6 — Parking Nearby

## Goal

Add a second mode to The Sweep: a parking-nearby view that shows the city's metered pay-boxes around an address (typed or GPS), each annotated with whether it's actively metered right now, plus a single-glance notice for the destination address itself: the next street sweep date and whether the block is in a residential permit zone.

The motivating use case is two-pronged: (a) **planning a trip** — "what's the parking situation at the address I'm about to drive to?", and (b) **finding a spot now** — "I'm in my car at this corner, where's the closest meter (and is it free yet)?". Both are address-driven; only the input mechanism differs (typed vs GPS).

The parking surface lives on its own route (`/parking`) so the editorial broadsheet of the existing sweep flow doesn't have to absorb a map renderer. The Sweep mode at `/` is unchanged.

## Architecture

### Routing

Two routes via [`wouter`](https://github.com/molefrog/wouter) (~1.5kb gzipped, hooks-based, no provider boilerplate):

- `/` → `<SweepPage/>` (the existing app content, extracted from `App.tsx` into a new `pages/` folder)
- `/parking` → `<ParkingPage/>` (new)

Unknown routes redirect to `/`. First-ever visit lands on `/`.

`<ParkingPage/>` and its dependencies (Leaflet, Stamen tile config, parking lib) are wrapped in `React.lazy()` so Sweep mode never pays the ~80kb Leaflet cost. A small Suspense fallback ("Loading map…" in mono caps) renders during the first parking-mode hit.

`netlify.toml` gets one new redirect rule so direct navigation to `/parking` doesn't 404:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Mode toggle

A new `<ModeToggle/>` component sits in the masthead's edition bar, alongside `<ThemeToggle/>`. Renders `Sweep · Parking` in the bar's mono-caps style. Each label is a `wouter` `<Link>` — semantic anchor, real URL, bookmarkable, middle-click opens new tab, browser back/forward works. Active mode in `text-chicago-red`, inactive in `text-ink-soft hover:text-ink`. Mirrors the visual pattern and keyboard semantics of the existing dark-mode toggle.

### Shared layout

`<Masthead/>` and `<Footnotes/>` render in `<App/>` outside the route switch. Page-specific content (input + results) lives inside the routed page components.

### Last-lookup memory (cross-mode)

A new `src/lib/lastLookup.ts` façade stores a single localStorage key `sweep.lastLookup` containing `{ address, lat, lon, timestamp }` of the most recent successful lookup. Both pages read from it on mount and pre-populate the address input; both write to it on successful lookup. Net effect: search "1819 S California Ave" in Sweep mode, switch to Parking, and parking results appear immediately for the same address. Mirrors the existing `recentLookups.ts` pattern (silent failures, no synthetic events — each page reads on mount).

## Data sources

### 1. Pay-box meters

- **Endpoint:** ArcGIS Layer 40 `DATA_ADMIN.REV_PARKING_PAYBOXES` on the same MapServer the existing recycling/garbage lookups use:
  ```
  https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/40
  ```
- **Spatial query (bounding box ±400m around lookup point):**
  ```
  /query
    ?geometry={"xmin":..,"ymin":..,"xmax":..,"ymax":..,"spatialReference":{"wkid":4326}}
    &geometryType=esriGeometryEnvelope
    &inSR=4326&outSR=4326
    &spatialRel=esriSpatialRelIntersects
    &outFields=*
    &returnGeometry=true
    &f=json
  ```
  Convert `radiusMeters` to lat/lon deltas with `dLat = r / 111320`, `dLon = r / (111320 * cos(lat·π/180))`.
- **Returned fields used:**
  - `OBJECTID`, `TERMINAL_ID` (stable identifiers)
  - `STREET_NAME` (e.g. `"S WESTERN AVE"` — uppercase, includes directional prefix)
  - `BLOCK_START`, `BLOCK_END`, `PAYBOX_ADDR` (block range + canonical address number)
  - `NUM_SPACES` (small int)
  - `HOUR_LIMIT` (string of digits, e.g. `"2"`, `"3"` — max-time per session in hours)
  - `ATTRIBUTE_DESC` (string — human-readable hours like `"9 AM TO 9 PM MON-SAT"`, or `"."` if blank)
  - `PAY_ZONE` (small int — rate-zone ID; rate amounts are derived externally and out of scope for v1)
  - `geometry.x`, `geometry.y` (lon/lat once `outSR=4326`)
- **Critical quirk:** `HOURLY_RATE` exists as a field but is `0.0` for many rows because the city derives rates from `PAY_ZONE` via Schedule 10 (a published PDF, not in this dataset). v1 does **not** display dollar amounts; it shows "Metered" + `HOUR_LIMIT` only. Wiring rates is a v2 follow-up.
- **Critical quirk:** `ATTRIBUTE_DESC` is `"."` for many rows. We treat blank/dot as "no special hours documented" — the active-now badge falls back to "Hours unspecified" for these rows; the meter is still shown.

### 2. Permit zones

- **Endpoint:** Socrata `u9xt-hiju` — `https://data.cityofchicago.org/resource/u9xt-hiju.json`
- **Critical quirk:** **Tabular, not polygon.** Each row describes a street range:
  ```ts
  {
    row_id: string;
    status: 'ACTIVE' | ...;
    zone: string;                 // permit zone number
    odd_even: 'E' | 'O' | 'B';    // even / odd / both sides of the street
    address_range_low: string;    // numeric string
    address_range_high: string;
    street_direction: string;     // 'N' | 'S' | 'E' | 'W'
    street_name: string;          // e.g. 'KENMORE' (no type suffix)
    street_type: string;          // 'AVE' | 'ST' | 'BLVD' | ...
    buffer: 'Y' | 'N';
    ward_low: string;
    ward_high: string;
  }
  ```
  Because there are no polygons, this dataset cannot be drawn as a map overlay without first joining to a Chicago streets centerline dataset. v1 instead surfaces permit info as a single text badge for the destination address.
- **Lookup query:**
  ```
  ?$where=street_direction='S' AND street_name='CALIFORNIA' AND street_type='AVE'
         AND address_range_low<=1819 AND address_range_high>=1819
         AND status='ACTIVE'
  &$limit=1
  ```
  The `odd_even` field is checked client-side after parsing the input house number's parity. Returns the matching `PermitZone` or `null`.

### 3. Sweep schedule (existing — reused)

The existing `lookupZone()` + `fetchSchedule()` chain (Socrata datasets `2r7q-emq3` for zones / `u5ai-3efk` for schedule). Parking mode reuses these unchanged to compute the next sweep date for the destination address — surfaced as a banner above the meter list.

## Page UX

Section numbering (mirrors Sweep mode's four-section / four-star convention):

- **I — Lookup** (`<AddressInput/>` + "Use current location" — both already exist)
- **II — Notices**
  - II.a — Sweep banner ("Next sweep: Tue Jul 21 (in 4 days)")
  - II.b — Permit badge ("This block is in Permit Zone 143" or hidden if none)
- **III — Map**
- **IV — Meters**

### Layout

**Mobile (<lg):** single column, in section order.

```
[Address input]
[Sweep banner]                  ← II.a
[Permit badge or omitted]       ← II.b
[Map ~280px tall]               ← III
[Meter list]                    ← IV
```

**Desktop (≥1024px):** broadsheet, mirrors the Sweep page's hero+sidebar pattern.

```
[Address input — constrained to lg:max-w-2xl]
[Sweep banner | Permit badge]   ← side-by-side
[       Map (1.6fr)       ][ Meter list (1fr) ]
```

### Map

- **Library:** Leaflet (~40kb gzipped). Simpler API than MapLibre, raster tiles, no API key needed.
- **Tiles:** Stamen Toner Lite via Stadia (`https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png`). Free for noncommercial use with attribution. Minimalist B&W rendering that reads like a 1930s WPA street map — fits the parchment-broadsheet aesthetic.
- **Dark mode:** swap to `stamen_toner` (the dark variant) when `.dark` is on `<html>`. Verify the dark URL pattern during implementation; if missing, render light tiles in dark mode (acceptable degradation, document in code).
- **Initial center / zoom:** lookup point centered, zoom level chosen so the ~3-block radius (~400m) fills most of the visible map.
- **Pins:**
  - User's lookup point: a chicago-blue `<ChicagoStar size={20}/>` rendered into a Leaflet `divIcon` (re-uses the project's iconography for the user's own location only).
  - Meter pins: small filled red circle when **active now**, small **outlined** red circle when **free now**, small grey circle when hours are **unspecified** (`ATTRIBUTE_DESC === '.'`). All ~10px, no labels.
  - Selected meter (clicked or list-row hovered): chicago-blue ring around the pin.
- **No clustering for v1.** Radius cap (~400m) keeps pin counts to roughly 5–30. Add clustering only if a real downtown lookup overwhelms the map (revisit after smoke).
- **Attribution:** small "© OpenStreetMap · Stamen via Stadia" in the bottom-right per the Stadia ToS.

### Map ↔ list sync

- Click a pin → list scrolls to that row, row highlights with a chicago-blue underline.
- Hover a list row → corresponding pin gets the chicago-blue ring.
- Both interactions managed by a `selectedTerminalId` state in `<ParkingPage/>`.

### Meter list rows

```
S WESTERN AVE · 4006                       ★ ACTIVE
350 ft NW · 4 spaces · 2hr max · 9a-9p Mon-Sat
                                           Active until 9pm (in 1h 14m)
```

- **Top line:** mono caps street name + canonical pay-box address (`PAYBOX_ADDR`).
- **Second line:** distance-and-cardinal (computed client-side from haversine + bearing), `NUM_SPACES`, `HOUR_LIMIT` formatted as `"{n}hr max"`, then the parsed-or-raw schedule string from `ATTRIBUTE_DESC`.
- **Right column:** active-now badge — `★ ACTIVE`, `★ FREE NOW`, or `★ HOURS UNSPECIFIED`. Below it, the human-readable detail line (`"Active until 9pm (in 1h 14m)"` / `"Free until 9am Mon"` / blank for unspecified).
- **Grouping:** consecutive rows on the same `BLOCK_START + STREET_NAME` are visually grouped (single street header, indented entries).

### Empty / edge states

- **No address yet (page first load):** map area shows a Roman-numeral theatrical placeholder matching the Sweep mode's empty state — `II — TYPE AN ADDRESS OR USE CURRENT LOCATION`.
- **No meters within radius:** "No metered parking within 3 blocks. Try a larger area or different address." (No automatic radius widening — keeps results predictable.)
- **GPS denied:** falls back silently to typing; input stays focused.
- **Sweep banner fetch fails:** banner quietly omitted; permit badge + meters still render.
- **Permit zones fetch fails:** badge quietly omitted.
- **ArcGIS paybox endpoint down:** map renders with no pins, list shows `Pay-box data unavailable` notice.
- **Geocode chain fully fails:** same `<ErrorPanel/>` as Sweep mode.

## Data flow

```
User input (address or GPS)
        │
        ▼
   geocode()     ←──────────────────────  (existing — unchanged)
        │  { lat, lon }
        ▼
Promise.all (parallel):
  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
  │ fetchPayboxes()     │  │ lookupZone()         │  │ lookupPermitZone() │
  │ ArcGIS Layer 40     │  │ Socrata 2r7q-emq3    │  │ Socrata u9xt-hiju  │
  │ bbox ±400m          │  │ (existing, reused)   │  │ (street + addr no.)│
  └─────────────────────┘  └──────────────────────┘  └────────────────────┘
        │                          │                          │
        │ Paybox[]                 │ { ward, section }        │ PermitZone | null
        │                          ▼
        │                  fetchSchedule(ward, section)  ← (existing)
        │                          │
        │                          ▼
        │                  pickNextSweep(today)
        │                          │
        │                          ▼ SweepDate | null
        ▼
   Each Paybox annotated with computeActiveStatus(now, attributeDesc)
        │
        ▼ ParkingResult { payboxes: AnnotatedPaybox[], nextSweep, permitZone }
```

Each fetch is independent; partial success is the norm. Mirrors CLAUDE.md's "always design data calls with a fallback chain" rule.

## Modules

### `src/lib/parkingMeters.ts`

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
  hourLimit: string;         // '2'
  attributeDesc: string;     // '9 AM TO 9 PM MON-SAT' or '.'
  payZone: number;
  lat: number;
  lon: number;
}

export const fetchPayboxes = async (
  lat: number,
  lon: number,
  radiusMeters = 400,
): Promise<Paybox[]>;
```

Silent-fail returns `[]`. Non-OK HTTP and JSON parse errors both swallowed with a `console.warn` (matching the recycling/garbage modules' style).

### `src/lib/permitZones.ts`

```ts
export interface PermitZone {
  zone: string;              // '143'
  oddEven: 'E' | 'O' | 'B';
  buffer: boolean;
  wardLow: string;
  wardHigh: string;
}

export const lookupPermitZone = async (
  parsedAddress: { direction: string; name: string; type: string; number: number },
): Promise<PermitZone | null>;
```

Address parsing into `{ direction, name, type, number }` is a small new helper `parseChicagoAddress()` exported from `src/lib/address.ts` (extends the existing `cleanAddress` lib without breaking it). The parser tokenizes a cleaned input string and returns `null` if it can't disambiguate (in which case `lookupPermitZone` returns `null` silently).

### `src/lib/meterHours.ts`

```ts
export interface ActiveStatus {
  state: 'active' | 'free' | 'unknown';
  until?: Date;             // when state changes next
  detail: string;           // 'Active until 9pm (in 1h 14m)' | 'Free until 9am Mon' | raw fallback
}

export const computeActiveStatus = (now: Date, attributeDesc: string): ActiveStatus;
```

Best-effort regex parser. Recognized patterns:
- `(\d{1,2})\s*(AM|PM)\s*TO\s*(\d{1,2})\s*(AM|PM)` for hours
- `MON-FRI`, `MON-SAT`, `MON-SUN`, `DAILY`, `SUN` (alone) for day patterns
- Combinations: `"9 AM TO 9 PM MON-SAT"` → active 9-21 Mon-Sat; free Sun all day

If parser can't match, returns `{ state: 'unknown', detail: attributeDesc }` and the badge shows `HOURS UNSPECIFIED`. If `attributeDesc` is `'.'` or empty, returns `{ state: 'unknown', detail: '' }` and the badge is hidden.

The annotated shape consumed by `<ParkingMap/>` and `<MeterList/>`:

```ts
export type AnnotatedPaybox = Paybox & { active: ActiveStatus; distanceMeters: number; bearingDeg: number };
```

Distance + bearing are computed once in `useParking` after the fetch resolves (haversine + initial-bearing formulas), so list rows can render `"350 ft NW"` without recomputing per render.

**Implementation note:** before writing the parser, sample 50 random `ATTRIBUTE_DESC` values from the live API to catalogue the patterns. Aim for ≥80% clean parse coverage. If <50%, ship v1 with raw-string display and no badge.

### `src/hooks/useParking.ts`

Mirrors `useLookup.ts`'s shape:

```ts
export interface UseParkingApi {
  status: 'idle' | 'loading' | 'ready' | 'error';
  result: ParkingResult | null;
  error: string | null;
  lookup: (input: { kind: 'address'; text: string } | { kind: 'gps'; lat: number; lon: number }) => Promise<void>;
}
```

No cache — fresh per session, matching the existing app's pattern.

### `src/lib/lastLookup.ts`

```ts
export interface LastLookup {
  address: string;
  lat: number;
  lon: number;
  timestamp: number;
}

export const readLastLookup = (): LastLookup | null;
export const writeLastLookup = (lookup: LastLookup): void;
```

Single localStorage key `sweep.lastLookup`. Both `useLookup` and `useParking` write here on success. Both pages call `readLastLookup` in a `useEffect` on mount and pre-populate input + auto-trigger a lookup if a value exists.

### `src/components/ModeToggle.tsx`

Two `wouter` `<Link>` elements, styled identically to `<ThemeToggle/>` (mono caps, active in red, hover transition). Lives in the masthead's edition bar.

### `src/components/ParkingMap.tsx`

Leaflet wrapper. Props:
```ts
interface Props {
  center: { lat: number; lon: number };
  payboxes: AnnotatedPaybox[];
  selectedTerminalId: number | null;
  onSelectMeter: (terminalId: number) => void;
  isDark: boolean;
}
```

Initializes the map on mount, swaps tile URLs when `isDark` changes, manages markers as a `useEffect` keyed on the `payboxes` array. Cleanup in unmount removes the map instance.

### `src/components/MeterList.tsx`

Pure render of `AnnotatedPaybox[]`. Highlights the selected row. Calls back on hover/click for the map sync.

### `src/components/PermitBadge.tsx`

Renders the permit zone notice (or null). Single-purpose, small.

## File structure (additions)

```
src/
├── App.tsx                          # Now: <Masthead/> + <Switch/> route → page + <Footnotes/>
├── pages/                           # NEW
│   ├── SweepPage.tsx                # The current App.tsx body, extracted
│   └── ParkingPage.tsx              # Lazy-loaded; wraps map + list + notices
├── lib/
│   ├── address.ts                   # ADDS parseChicagoAddress() helper
│   ├── lastLookup.ts                # NEW — sweep.lastLookup localStorage façade
│   ├── meterHours.ts                # NEW — best-effort active-now parser
│   ├── parkingMeters.ts             # NEW — ArcGIS Layer 40 fetch + types
│   └── permitZones.ts               # NEW — Socrata u9xt-hiju lookup
├── hooks/
│   └── useParking.ts                # NEW — orchestrates parking lookup
└── components/
    ├── MeterList.tsx                # NEW
    ├── ModeToggle.tsx               # NEW — Sweep · Parking <Link> in edition bar
    ├── ParkingMap.tsx               # NEW — Leaflet wrapper
    └── PermitBadge.tsx              # NEW
```

Plus modifications:
- `App.tsx` — extract body to `pages/SweepPage.tsx`, add wouter `<Switch/>`, mount lazy `<ParkingPage/>`
- `src/components/Masthead.tsx` — render `<ModeToggle/>` in edition bar
- `src/hooks/useLookup.ts` — write to `lastLookup` on success; read on mount
- `netlify.toml` — add SPA rewrite
- `package.json` — add `wouter`, `leaflet`, `@types/leaflet`
- `CLAUDE.md` — document the two new data sources, the routing layer, the lastLookup façade, the new files; v6 entry in roadmap

## Out of scope (intentional)

- **Loading zones, tow / rush-hour zones, no-stopping signs.** v2 — same MapServer probably has them; build them after v1 lands and the data shape proves itself.
- **Dollar rate per hour.** Wiring `PAY_ZONE` → Schedule 10 PDF lookup is its own project. v1 shows "Metered" + max-time only.
- **Map clusters.** Radius cap usually keeps pin counts manageable. Revisit only if dense downtown lookups overwhelm the map.
- **Bookmarkable lookup permalinks** (`/parking?address=...`). Pairs naturally with the share-feature already on the radar; not part of this v1.
- **Per-meter sweep cross-reference.** Only the address-level banner ships in v1 (the Q6(b) decision). Per-meter granularity is v2 if real-world use shows the radius straddling section boundaries.
- **Print stylesheet for parking.** `/parking` is `print:hidden` at root. Sweep mode print stylesheet untouched.
- **PWA-specific offline support for map tiles.** Leaflet + Stadia don't ship offline by default; not solving here.

## Verify-during-implementation (risk items)

1. **`ATTRIBUTE_DESC` parse coverage.** Before writing `meterHours.ts`, sample 50 random payboxes citywide. Confirm ≥80% match the regex strategy. If <50%, ship v1 with raw-string display and no active-now badge.
2. **Stamen Toner dark variant.** Confirm `stamen_toner` exists via Stadia and renders. If missing, leave light tiles in dark mode and document in code.
3. **wouter + React 18 strict mode.** Trivial check; bail to `react-router-dom` if anything weird shows up. (Very unlikely.)
4. **Address parsing for permit-zone lookup.** `"1819 S. California Ave"` → `{ direction: 'S', name: 'CALIFORNIA', type: 'AVE', number: 1819 }`. Handle directional with/without dot, type abbreviation variants (`Ave` / `AVE` / `AVENUE`).
5. **CORS on ArcGIS Layer 40.** Layers 76/127 work browser-side; verify 40 does too with a one-line browser-side test before deep implementation.

## Verification

Manual smoke at the canonical address `1819 S California Ave` (Pilsen, dense parking) under both light and dark mode:

1. **`/` → Sweep mode** renders unchanged from current state.
2. **Edition bar shows `Sweep · Parking`** alongside `Light · Dark`.
3. **Click `Parking`** → URL changes to `/parking`, parking page loads (Suspense fallback briefly during first hit).
4. **Map renders** with Stamen Toner Lite tiles, meter pins (red filled / outlined / grey by active state), and a chicago-blue star at the lookup point.
5. **Meter list** shows 5+ meters with active-now badges. Each row's distance-and-cardinal points back to the lookup star direction.
6. **Sweep banner (II.a)** shows "Next sweep: ... (in N days)".
7. **Permit badge (II.b)** shows the correct zone (or is omitted if none).
8. **Map ↔ list sync:** click a pin → list scrolls to that row + chicago-blue underline. Hover a list row → pin gets chicago-blue ring.
9. **Switch back to `/`** → Sweep mode shows the same address pre-populated (lastLookup memory works).
10. **Browser back / forward** navigates correctly between routes.
11. **Direct nav to `http://localhost:5173/parking`** (no prior `/`) loads correctly via vite-history-api-fallback. Production verifies via Netlify SPA rewrite.
12. **Toggle dark mode** → map tiles swap to dark variant; pins remain legible.
13. **Print preview from `/parking`** → page hides cleanly (`print:hidden`).
14. **Print preview from `/`** → unchanged from existing.
15. **Downtown stress test** at `100 N State St` — meter list dense, pin count manageable (or clustering decision is forced).
16. **GPS path** — click "Use current location" in parking mode, verify the same flow runs from coordinates.

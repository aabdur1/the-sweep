# Routine Pickups (Recycling + Garbage) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chicago recycling + garbage pickup pattern lookup to "The Sweep" alongside the existing street-sweeping schedule, surfacing the day-of-week + week-color cadence and any holiday-driven shifts.

**Architecture:** Two new ArcGIS spatial-intersect lookups (`lookupRecycling`, `lookupGarbage`) fan out in parallel after the existing geocode in `useLookup`. A new `RoutinePickups` component renders both as pattern cards (day + week color) with a holiday-shift callout when applicable. Pure-function decoder for the recycling `AREA_DETAIL` string. Hand-encoded 2026 holiday-shift table.

**Tech Stack:** Same as v1 — Vite + React 18 + TypeScript (strict) + Tailwind. New external dependency: Chicago's ArcGIS REST endpoint at `gisapps.chicago.gov`. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-05-02-routine-pickups-design.md`

**Note on testing:** Per project preference (carried forward from v1), no automated tests. Verification is manual against the canonical address `1819 S California Ave, Chicago` → recycling Mondays / Yellow week, garbage Fridays / weekly. Each task ends with a manual verification + commit.

**Working directory:** All paths relative to `/Users/amirabdurrahim/repos/chi-street-sweep/`.

---

## Task 1: CORS spike for ArcGIS endpoint

Research task. Goal: confirm whether browser fetches succeed against `gisapps.chicago.gov` from our origin before building the lookups. If they don't, the rest of the plan needs a Netlify Function proxy step.

**Files:** none modified.

- [ ] **Step 1: Test the ArcGIS layer-76 endpoint with curl to confirm it works server-side**

```bash
curl -s "https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/76/query?geometry=-87.694,41.857&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json" | python3 -c "import json, sys; d = json.load(sys.stdin); print(d.get('features', [{}])[0].get('attributes'))"
```

Expected: dict containing `AREA_DETAIL` like `"4IN-WK A-YLW-CTY-MO"`. This proves the API works.

- [ ] **Step 2: Test for CORS support via response headers**

```bash
curl -s -I -H "Origin: https://example.com" "https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/76/query?geometry=-87.694,41.857&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json" | grep -i "access-control"
```

Possible outputs:
- **No matching lines** → CORS NOT supported. Browser will block. Need a proxy.
- `access-control-allow-origin: *` or matching the Origin header → CORS supported. Direct browser access works.

- [ ] **Step 3: If CORS is supported, document and proceed**

Append to the spec at `docs/superpowers/specs/2026-05-02-routine-pickups-design.md` in the "Risks and gotchas" section:

```
- ArcGIS CORS confirmed supported (verified 2026-05-02). No proxy needed.
```

Skip Step 4 and proceed to Task 2.

- [ ] **Step 4: If CORS is NOT supported, add a Netlify Function proxy task**

Insert a new Task 1.5 between this task and Task 2:

```markdown
## Task 1.5: Netlify Function proxy for ArcGIS

**Files:**
- Create: `netlify/functions/arcgis.ts`
- Modify: `netlify.toml` (add functions config)
- Modify: `package.json` (add `@netlify/functions` dev dep)

(Implementer: write the proxy that takes ?layer=76&lat=...&lon=... and forwards to the ArcGIS query URL with CORS headers added.)
```

Then update Tasks 6 and 7 below to point at `/.netlify/functions/arcgis?layer=76&...` instead of the direct ArcGIS URL.

- [ ] **Step 5: Commit the spec update (only if Step 3 ran)**

```bash
git add docs/superpowers/specs/2026-05-02-routine-pickups-design.md
git commit -m "docs(spec): confirm ArcGIS CORS support"
```

---

## Task 2: Type extensions

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new interfaces and extend `LookupResult`**

Open `src/types.ts` and replace its content with:

```ts
export interface GeocodeResult {
  lat: number;
  lon: number;
  display: string;
}

export interface ZoneInfo {
  ward: string;
  section: string;
}

export type Side = 'A' | 'B';

export interface SweepDate {
  date: Date;
  sideLabel: Side;
  pairIdx: 0 | 1;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
export type WeekColor = 'Yellow' | 'Orange';

export interface RecyclingInfo {
  day: DayOfWeek;
  weekColor: WeekColor;
  serviceArea: number;
  vendor: string;
  rawAreaDetail: string;
  pdfUrl: string | null;
  /** Next pickup date, if a 2026 A/B anchor is encoded in lib/recyclingDecode.ts. */
  nextPickup: Date | null;
}

export interface GarbageInfo {
  day: DayOfWeek;
  division: string;
  /** Next pickup date — always computable since garbage is weekly. */
  nextPickup: Date;
}

export interface HolidayShift {
  /** Date of the holiday itself, e.g. 2026-05-25. */
  date: Date;
  name: string;
  /** Description of the shift's effect, e.g. "Friday onward shifts forward one day". */
  affectedDescription: string;
  /** The new pickup date for the affected service day, if applicable. */
  resolveShift: (originalDay: DayOfWeek) => Date | null;
}

export interface LookupResult {
  ward: string;
  section: string;
  dates: SweepDate[];
  display: string;
  coords: { lat: number; lon: number };
  recycling: RecyclingInfo | null;
  garbage: GarbageInfo | null;
}

export type LookupStatus =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: LookupResult };

export const SCHEDULE_YEAR = 2026;
export const SCHEDULE_DATASET_ID = 'u5ai-3efk';
export const ZONES_DATASET_ID_CURRENT = '2r7q-emq3'; // 2026
export const ZONES_DATASET_ID_FALLBACK = 'utb4-q645'; // 2025

export const ARCGIS_RECYCLING_LAYER =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/76';
export const ARCGIS_GARBAGE_LAYER =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/127';
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean OR a complaint that the existing `useLookup` builds a `LookupResult` without `recycling`/`garbage`. Either is fine — Task 8 fixes that.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add RecyclingInfo, GarbageInfo, HolidayShift, ArcGIS layer URLs"
```

---

## Task 3: Date helper extensions

**Files:**
- Modify: `src/lib/dates.ts`

- [ ] **Step 1: Replace `src/lib/dates.ts` with the extended version**

```ts
import type { DayOfWeek } from '../types';

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const daysFromToday = (target: Date): number => {
  const today = startOfDay(new Date());
  const t = startOfDay(target);
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions): string =>
  d.toLocaleDateString('en-US', opts);

export const dayOfWeek = (d: Date): string => fmt(d, { weekday: 'long' });
export const dayShort = (d: Date): string => fmt(d, { weekday: 'short' });
export const monthName = (d: Date): string => fmt(d, { month: 'long' });
export const monthShort = (d: Date): string => fmt(d, { month: 'short' });

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

/**
 * The next date whose weekday matches `day`, on or after `from`.
 * If `from` already falls on `day`, returns `from` (start-of-day).
 */
export const nextDayOfWeek = (day: DayOfWeek, from: Date = new Date()): Date => {
  const target = DAY_INDEX[day];
  const start = startOfDay(from);
  const todayIdx = start.getDay();
  const delta = (target - todayIdx + 7) % 7;
  const result = new Date(start);
  result.setDate(start.getDate() + delta);
  return result;
};

const EPOCH_MONDAY = (() => {
  // First Monday of 2026.
  const d = new Date(2026, 0, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return startOfDay(d);
})();

/**
 * Monday-anchored ISO week index of `d`, counted from the first Monday of 2026
 * (= week 0). Used to alternate Yellow/Orange weeks for biweekly recycling.
 */
export const weekIndexFrom2026 = (d: Date): number => {
  const ms = startOfDay(d).getTime() - EPOCH_MONDAY.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors from `dates.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dates.ts
git commit -m "feat(dates): add nextDayOfWeek and weekIndexFrom2026 helpers"
```

---

## Task 4: Holiday shift table

**Files:**
- Create: `src/lib/holidays.ts`

The 2026 holiday shifts come from chicago.gov's "Holiday Garbage Schedule" page. Chicago's policy: when a holiday falls on Mon-Fri, the holiday-day pickup and all later weekdays in that week slide forward one day. Holidays on weekends don't shift weekday pickups.

**2026 Mon-Fri holidays:**
- Jan 1 (Thu) — New Year's Day
- Jan 19 (Mon) — Martin Luther King Jr. Day
- Feb 16 (Mon) — Presidents' Day
- May 25 (Mon) — Memorial Day
- Jun 19 (Fri) — Juneteenth
- Jul 3 (Fri) — Independence Day observed (since Jul 4 is Sat)
- Sep 7 (Mon) — Labor Day
- Oct 12 (Mon) — Columbus Day
- Nov 11 (Wed) — Veterans Day
- Nov 26 (Thu) — Thanksgiving
- Dec 25 (Fri) — Christmas

- [ ] **Step 1: Create `src/lib/holidays.ts`**

```ts
import type { DayOfWeek, HolidayShift } from '../types';
import { startOfDay } from './dates';

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

interface HolidayEntry {
  date: [number, number, number]; // [year, monthIdx, day]
  name: string;
}

const HOLIDAYS_2026: HolidayEntry[] = [
  { date: [2026, 0, 1],   name: "New Year's Day" },
  { date: [2026, 0, 19],  name: 'Martin Luther King Jr. Day' },
  { date: [2026, 1, 16],  name: "Presidents' Day" },
  { date: [2026, 4, 25],  name: 'Memorial Day' },
  { date: [2026, 5, 19],  name: 'Juneteenth' },
  { date: [2026, 6, 3],   name: 'Independence Day (observed)' },
  { date: [2026, 8, 7],   name: 'Labor Day' },
  { date: [2026, 9, 12],  name: 'Columbus Day' },
  { date: [2026, 10, 11], name: 'Veterans Day' },
  { date: [2026, 10, 26], name: 'Thanksgiving' },
  { date: [2026, 11, 25], name: 'Christmas' },
];

const dayName = (idx: number): string =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx];

const buildShift = (entry: HolidayEntry): HolidayShift => {
  const [y, m, d] = entry.date;
  const holidayDate = startOfDay(new Date(y, m, d));
  const holidayDow = holidayDate.getDay();

  return {
    date: holidayDate,
    name: entry.name,
    affectedDescription: dayName(holidayDow) + ' onward shifts forward one day',
    resolveShift: (originalDay: DayOfWeek): Date | null => {
      const targetIdx = DAY_INDEX[originalDay];
      // Affected only if targetIdx is in the holiday's week and >= holidayDow.
      if (targetIdx < holidayDow || targetIdx > 5) return null;

      // Find that pickup's original date in the holiday's calendar week.
      const sundayOfWeek = new Date(holidayDate);
      sundayOfWeek.setDate(holidayDate.getDate() - holidayDow);
      const original = new Date(sundayOfWeek);
      original.setDate(sundayOfWeek.getDate() + targetIdx);
      const shifted = new Date(original);
      shifted.setDate(original.getDate() + 1);
      return shifted;
    },
  };
};

const SHIFTS_2026: HolidayShift[] = HOLIDAYS_2026
  .filter((h) => {
    const dow = new Date(h.date[0], h.date[1], h.date[2]).getDay();
    return dow >= 1 && dow <= 5; // Mon–Fri only
  })
  .map(buildShift);

/**
 * Find the next holiday shift affecting `serviceDay`, on or after `from`.
 * Returns null if none in scope (~next 8 weeks).
 *
 * TODO: refresh HOLIDAYS_2026 each year from chicago.gov's "Holiday Garbage
 * Schedule" page; rename and bump the year.
 */
export const findUpcomingShift = (
  serviceDay: DayOfWeek,
  from: Date = new Date()
): { shift: HolidayShift; shiftedDate: Date } | null => {
  const fromTime = startOfDay(from).getTime();
  const horizonMs = 8 * 7 * 24 * 60 * 60 * 1000; // 8 weeks
  for (const shift of SHIFTS_2026) {
    if (shift.date.getTime() < fromTime) continue;
    if (shift.date.getTime() > fromTime + horizonMs) break;
    const shifted = shift.resolveShift(serviceDay);
    if (shifted) return { shift, shiftedDate: shifted };
  }
  return null;
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors from `holidays.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/holidays.ts
git commit -m "feat(holidays): add 2026 Chicago Streets and San holiday shift table"
```

---

## Task 5: Recycling decoder

**Files:**
- Create: `src/lib/recyclingDecode.ts`

The `AREA_DETAIL` field is a 5-segment dash-separated string like `"4IN-WK A-YLW-CTY-MO"`. We parse it into structured fields and provide a Yellow/Orange parity helper.

- [ ] **Step 1: Create `src/lib/recyclingDecode.ts`**

```ts
import type { DayOfWeek, WeekColor } from '../types';

/**
 * 2026 anchor: the city's Blue Cart calendar PDF for 2026 shows that the week
 * starting Mon Jan 5, 2026 was a YELLOW pickup week (verify against the schedule
 * PDF linked from the ArcGIS layer's URL_PDF field). Anchor at week index 0.
 *
 * If the user reports the week color is wrong on launch day, flip this constant.
 */
const ANCHOR_WEEK_INDEX_IS_YELLOW = true;

const DAY_CODE: Record<string, DayOfWeek> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri',
};

const COLOR_CODE: Record<string, WeekColor> = {
  YLW: 'Yellow', ORG: 'Orange',
};

export interface DecodedAreaDetail {
  day: DayOfWeek | null;
  weekColor: WeekColor | null;
  weekLetter: 'A' | 'B' | null;
  serviceArea: number | null;
  vendor: string | null;
}

/** Robust dash-segment parser: order varies; identify each segment by shape. */
export const decodeAreaDetail = (raw: string): DecodedAreaDetail => {
  const segments = raw.split('-').map((s) => s.trim());
  const out: DecodedAreaDetail = {
    day: null, weekColor: null, weekLetter: null, serviceArea: null, vendor: null,
  };
  for (const seg of segments) {
    // "4IN" / "12OUT" — service area number
    const areaMatch = /^(\d+)(IN|OUT)?$/.exec(seg);
    if (areaMatch) {
      out.serviceArea = parseInt(areaMatch[1], 10);
      continue;
    }
    // "WK A" / "WK B"
    const weekMatch = /^WK\s*(A|B)$/.exec(seg);
    if (weekMatch) {
      out.weekLetter = weekMatch[1] as 'A' | 'B';
      continue;
    }
    if (seg in COLOR_CODE) {
      out.weekColor = COLOR_CODE[seg];
      continue;
    }
    if (seg in DAY_CODE) {
      out.day = DAY_CODE[seg];
      continue;
    }
    // Anything else is the vendor (e.g. CTY, WMI, RES).
    if (!out.vendor) out.vendor = seg;
  }
  return out;
};

/**
 * Determine whether `weekIdx` is a pickup week for an address with `weekColor`.
 * Even week indices are Yellow when ANCHOR_WEEK_INDEX_IS_YELLOW = true.
 */
export const isPickupWeek = (
  weekIdx: number,
  weekColor: WeekColor
): boolean => {
  const evenIsYellow = ANCHOR_WEEK_INDEX_IS_YELLOW;
  const weekIsYellow = (weekIdx % 2 === 0) === evenIsYellow;
  return weekIsYellow === (weekColor === 'Yellow');
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/recyclingDecode.ts
git commit -m "feat(recycling): parser for AREA_DETAIL + Yellow/Orange week predicate"
```

---

## Task 6: Recycling lookup

**Files:**
- Create: `src/lib/recycling.ts`

- [ ] **Step 1: Create `src/lib/recycling.ts`**

```ts
import type { RecyclingInfo } from '../types';
import { ARCGIS_RECYCLING_LAYER } from '../types';
import { decodeAreaDetail, isPickupWeek } from './recyclingDecode';
import { nextDayOfWeek, weekIndexFrom2026, startOfDay } from './dates';

interface RecyclingFeature {
  attributes: {
    SERVICE_AREA?: number;
    AREA_DETAIL?: string;
    VENDOR?: string;
    URL_PDF?: string;
  };
}

interface ArcGISResponse {
  features?: RecyclingFeature[];
}

const buildQueryUrl = (lat: number, lon: number): string => {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ARCGIS_RECYCLING_LAYER}/query?${params.toString()}`;
};

export const lookupRecycling = async (
  lat: number,
  lon: number
): Promise<RecyclingInfo | null> => {
  const resp = await fetch(buildQueryUrl(lat, lon));
  if (!resp.ok) return null;
  const data = (await resp.json()) as ArcGISResponse;
  const feature = data.features?.[0];
  if (!feature) return null;
  const attrs = feature.attributes;
  const detail = attrs.AREA_DETAIL ?? '';
  const decoded = decodeAreaDetail(detail);
  if (!decoded.day || !decoded.weekColor) return null;

  // Compute next pickup: next occurrence of `day` that falls in a pickup week.
  const today = startOfDay(new Date());
  const candidate = nextDayOfWeek(decoded.day, today);
  for (let i = 0; i < 4; i++) {
    if (isPickupWeek(weekIndexFrom2026(candidate), decoded.weekColor)) break;
    candidate.setDate(candidate.getDate() + 7);
  }

  return {
    day: decoded.day,
    weekColor: decoded.weekColor,
    serviceArea: decoded.serviceArea ?? attrs.SERVICE_AREA ?? -1,
    vendor: decoded.vendor ?? attrs.VENDOR ?? '',
    rawAreaDetail: detail,
    pdfUrl: attrs.URL_PDF ?? null,
    nextPickup: candidate,
  };
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/recycling.ts
git commit -m "feat(recycling): ArcGIS spatial lookup with next-pickup computation"
```

---

## Task 7: Garbage lookup

**Files:**
- Create: `src/lib/garbage.ts`

- [ ] **Step 1: Create `src/lib/garbage.ts`**

```ts
import type { GarbageInfo, DayOfWeek } from '../types';
import { ARCGIS_GARBAGE_LAYER } from '../types';
import { nextDayOfWeek } from './dates';

interface GarbageFeature {
  attributes: {
    DAY?: string;
    DIVISION?: string;
    SAN_DAY?: string;
  };
}

interface ArcGISResponse {
  features?: GarbageFeature[];
}

const DAY_FROM_FULL: Record<string, DayOfWeek> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
};

const buildQueryUrl = (lat: number, lon: number): string => {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ARCGIS_GARBAGE_LAYER}/query?${params.toString()}`;
};

export const lookupGarbage = async (
  lat: number,
  lon: number
): Promise<GarbageInfo | null> => {
  const resp = await fetch(buildQueryUrl(lat, lon));
  if (!resp.ok) return null;
  const data = (await resp.json()) as ArcGISResponse;
  const feature = data.features?.[0];
  if (!feature) return null;
  const attrs = feature.attributes;
  const dayFull = attrs.DAY ?? '';
  const day = DAY_FROM_FULL[dayFull];
  if (!day) return null;
  return {
    day,
    division: attrs.DIVISION ?? '',
    nextPickup: nextDayOfWeek(day),
  };
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/garbage.ts
git commit -m "feat(garbage): ArcGIS spatial lookup for weekly pickup day"
```

---

## Task 8: Extend `useLookup` to fan out

**Files:**
- Modify: `src/hooks/useLookup.ts`

- [ ] **Step 1: Replace `src/hooks/useLookup.ts` with the extended version**

```ts
import { useCallback, useState } from 'react';
import type { LookupStatus, LookupResult } from '../types';
import { geocode } from '../lib/geocode';
import { lookupZone } from '../lib/zones';
import { fetchSchedule } from '../lib/schedule';
import { lookupRecycling } from '../lib/recycling';
import { lookupGarbage } from '../lib/garbage';

export interface UseLookupApi {
  status: LookupStatus;
  result: LookupResult | null;
  error: string | null;
  isLoading: boolean;
  isLocating: boolean;
  lookup: (address: string) => Promise<void>;
  lookupByCoords: (lat: number, lon: number, displayOverride?: string) => Promise<void>;
  startLocating: () => void;
  reset: () => void;
}

export const useLookup = (): UseLookupApi => {
  const [status, setStatus] = useState<LookupStatus>({ kind: 'idle' });

  const runLookup = useCallback(
    async (lat: number | null, lon: number | null, address: string, displayOverride?: string) => {
      setStatus({ kind: 'loading' });
      try {
        let coords = lat !== null && lon !== null ? { lat, lon } : null;
        let display = displayOverride ?? '';
        if (!coords) {
          const g = await geocode(address);
          coords = { lat: g.lat, lon: g.lon };
          display = g.display;
        }
        // Sweep is the primary, must succeed. Recycling/garbage are nice-to-haves
        // — failures resolve to null without blocking the result.
        const zone = await lookupZone(coords.lat, coords.lon);
        const [dates, recycling, garbage] = await Promise.all([
          fetchSchedule(zone.ward, zone.section),
          lookupRecycling(coords.lat, coords.lon).catch(() => null),
          lookupGarbage(coords.lat, coords.lon).catch(() => null),
        ]);
        setStatus({
          kind: 'done',
          result: {
            ward: zone.ward,
            section: zone.section,
            dates,
            display,
            coords,
            recycling,
            garbage,
          },
        });
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message || 'Something went wrong.' });
      }
    },
    []
  );

  const lookup = useCallback(
    async (address: string) => {
      if (!address.trim()) return;
      await runLookup(null, null, address);
    },
    [runLookup]
  );

  const lookupByCoords = useCallback(
    async (lat: number, lon: number, displayOverride?: string) => {
      await runLookup(lat, lon, '', displayOverride ?? 'Current location');
    },
    [runLookup]
  );

  const startLocating = useCallback(() => {
    setStatus({ kind: 'locating' });
  }, []);

  const reset = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  return {
    status,
    result: status.kind === 'done' ? status.result : null,
    error: status.kind === 'error' ? status.message : null,
    isLoading: status.kind === 'loading',
    isLocating: status.kind === 'locating',
    lookup,
    lookupByCoords,
    startLocating,
    reset,
  };
};
```

- [ ] **Step 2: Smoke test in dev**

Open `http://localhost:5173/` (or restart `npm run dev`), type `1819 S California Ave`, click Find. Open DevTools and inspect the React tree or use the JSX result rendering — `result.recycling` and `result.garbage` should be populated. Expected:
- `recycling.day === 'Mon'`, `recycling.weekColor === 'Yellow'`, `recycling.serviceArea === 4`
- `garbage.day === 'Fri'`

If recycling/garbage are null, check the browser console for CORS errors. If CORS is blocking and Task 1 didn't catch it, fall back to the Netlify Function proxy (Task 1.5).

- [ ] **Step 3: Verify build**

```bash
npm run typecheck
npm run build
```

Both must pass.

- [ ] **Step 4: Commit (data layer milestone)**

```bash
git add src/hooks/useLookup.ts
git commit -m "feat(useLookup): fan out to recycling and garbage in parallel"
```

---

## Task 9: `RoutinePickups` component

**Files:**
- Create: `src/components/RoutinePickups.tsx`

- [ ] **Step 1: Create `src/components/RoutinePickups.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';
import type { RecyclingInfo, GarbageInfo } from '../types';
import { findUpcomingShift } from '../lib/holidays';
import { dayOfWeek, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  recycling: RecyclingInfo | null;
  garbage: GarbageInfo | null;
}

const dayLong: Record<string, string> = {
  Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays',
  Thu: 'Thursdays', Fri: 'Fridays',
};

const fmtDate = (d: Date): string => `${monthName(d).slice(0, 3)} ${d.getDate()}`;

export const RoutinePickups = ({ recycling, garbage }: Props) => {
  if (!recycling && !garbage) {
    return (
      <section className="mx-5 mt-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-ink-soft flex items-center gap-1.5">
          <ChicagoStar size={9} /> Section II.b — Routine pickups
        </div>
        <div className="border border-ink/40 p-3 text-sm font-mono text-ink-soft italic">
          Routine pickup data unavailable for this address.
        </div>
      </section>
    );
  }

  const recyclingShift = recycling ? findUpcomingShift(recycling.day) : null;
  const garbageShift = garbage ? findUpcomingShift(garbage.day) : null;

  return (
    <section className="mx-5 mt-6 slide-up">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-blue flex items-center gap-1.5">
        <ChicagoStar size={9} /> Section II.b — Routine pickups
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recycling && (
          <article className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
            <ChicagoStar size={10} className="text-chicago-blue mb-2" />
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
              Recycling
            </div>
            <div className="font-serif text-3xl text-ink leading-none mt-1">
              {dayLong[recycling.day]}
            </div>
            <div className="font-serif italic text-chicago-blue text-sm mt-1">
              — {recycling.weekColor} week —
            </div>
            <div className="border-t border-ink/30 mt-3 pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              {recycling.nextPickup ? <>Next · {fmtDate(recycling.nextPickup)}</> : 'Biweekly'}
            </div>
          </article>
        )}
        {garbage && (
          <article className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
            <ChicagoStar size={10} className="text-chicago-blue mb-2" />
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
              Garbage
            </div>
            <div className="font-serif text-3xl text-ink leading-none mt-1">
              {dayLong[garbage.day]}
            </div>
            <div className="font-serif italic text-ink-soft text-sm mt-1">
              every week
            </div>
            <div className="border-t border-ink/30 mt-3 pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              Next · {fmtDate(garbage.nextPickup)}
            </div>
          </article>
        )}
      </div>

      {(recyclingShift || garbageShift) && (
        <div className="mt-3 border-2 border-chicago-red p-3 flex items-start gap-2" style={{ background: '#FAEBEB' }}>
          <AlertTriangle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-chicago-red" />
          <div className="text-sm leading-snug">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red mb-1">
              Holiday shift
            </div>
            {recyclingShift && (
              <div className="font-serif italic text-ink">
                {recyclingShift.shift.name}: recycling shifts to {dayOfWeek(recyclingShift.shiftedDate)}, {fmtDate(recyclingShift.shiftedDate)}.
              </div>
            )}
            {garbageShift && (
              <div className="font-serif italic text-ink">
                {garbageShift.shift.name}: garbage shifts to {dayOfWeek(garbageShift.shiftedDate)}, {fmtDate(garbageShift.shiftedDate)}.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
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
git add src/components/RoutinePickups.tsx
git commit -m "feat(component): RoutinePickups card pair with holiday-shift callout"
```

---

## Task 10: Wire `RoutinePickups` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Edit `src/App.tsx`**

Add the import:

```tsx
import { RoutinePickups } from './components/RoutinePickups';
```

Then in the JSX, between `<NextSweepHero ... />` and `<ScheduleAlmanac ... />`, insert:

```tsx
<RoutinePickups recycling={result.recycling} garbage={result.garbage} />
```

The full result block becomes:

```tsx
{result && (
  <>
    <NextSweepHero next={next} ward={result.ward} section={result.section} />
    <RoutinePickups recycling={result.recycling} garbage={result.garbage} />
    <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
    <Footnotes address={result.display} />
  </>
)}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
npm run build
```

Both must pass. Run the dev server, perform a lookup against `1819 S California Ave`, verify visually:
- Sweep hero (Section II.a) appears with ward 25 / §03
- Routine pickups (Section II.b) appears below with two cards
- Recycling card: "Mondays — Yellow week — Next: <date>"
- Garbage card: "Fridays — every week — Next: <date>"
- No holiday callout this week (Memorial Day is May 25; if testing after May 18, callout should appear)

- [ ] **Step 3: Commit (visual milestone)**

```bash
git add src/App.tsx
git commit -m "feat(app): wire RoutinePickups between NextSweepHero and ScheduleAlmanac"
```

---

## Task 11: NextSweepHero section label update

**Files:**
- Modify: `src/components/NextSweepHero.tsx`

The spec calls for the sweep hero to read "Section II.a — Sweep" so the II.a / II.b sub-numbering is consistent.

- [ ] **Step 1: Update the section header text**

In `src/components/NextSweepHero.tsx`, find:

```tsx
<ChicagoStar size={9} /> Section II — Your Next Sweep
```

Replace with:

```tsx
<ChicagoStar size={9} /> Section II.a — Sweep
```

Apply the same edit to the no-result branch's header (`Section II — Status` becomes `Section II.a — Status`).

- [ ] **Step 2: Verify**

```bash
npm run typecheck
npm run build
```

Both pass. Run dev server, confirm the Sweep hero now says "Section II.a — Sweep" and Routine Pickups says "Section II.b — Routine pickups". Section III (Almanac) and Section IV (Footnotes) labels unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/NextSweepHero.tsx
git commit -m "feat(hero): rename to Section II.a so II.a/II.b sub-numbering is consistent"
```

---

## Task 12: Routine ICS export

**Files:**
- Modify: `src/lib/ics.ts`
- Modify: `src/components/RoutinePickups.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Refactor and extend `src/lib/ics.ts`**

Replace the file with:

```ts
import type { SweepDate, RecyclingInfo, GarbageInfo, DayOfWeek } from '../types';
import { findUpcomingShift } from './holidays';
import { weekIndexFrom2026, startOfDay } from './dates';
import { isPickupWeek } from './recyclingDecode';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const HORIZON_DAYS = 90;
const DAY_INDEX: Record<DayOfWeek, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };

const beginCalendar = (prodId: string): string[] => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:-//Chicago Sweep//${prodId}//EN`,
  'CALSCALE:GREGORIAN',
];

const emitEvent = (
  lines: string[],
  d: Date,
  uid: string,
  summary: string,
  description: string,
  alarmMessage: string
): void => {
  const next = new Date(d); next.setDate(next.getDate() + 1);
  lines.push(
    'BEGIN:VEVENT',
    `UID:${uid}@chicago-sweep`,
    `DTSTAMP:${fmtICS(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${fmtICS(d)}`,
    `DTEND;VALUE=DATE:${fmtICS(next)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT12H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${alarmMessage}`,
    'END:VALARM',
    'END:VEVENT'
  );
};

const finalize = (lines: string[]): string => {
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

export const generateICS = (dates: SweepDate[], ward: string, section: string): string => {
  const lines = beginCalendar('Sweep');
  dates.forEach((entry, i) => {
    const d = entry.date;
    emitEvent(
      lines,
      d,
      `sweep-${ward}-${section}-${i}-${fmtICS(d)}`,
      `MOVE CAR — Street sweeping (Ward ${ward} §${section})`,
      `Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
      'Move car — street sweeping tomorrow'
    );
  });
  return finalize(lines);
};

const dayMatches = (d: Date, day: DayOfWeek): boolean => d.getDay() === DAY_INDEX[day];

const datesForDay = (day: DayOfWeek, days: number): Date[] => {
  const out: Date[] = [];
  const cursor = startOfDay(new Date());
  for (let i = 0; i < days; i++) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    if (dayMatches(d, day)) out.push(d);
  }
  return out;
};

const applyShiftIfAny = (d: Date, day: DayOfWeek): Date => {
  const shift = findUpcomingShift(day, d);
  if (!shift) return d;
  // Only swap if the shift's holiday is in the same calendar week as `d`.
  const sundayOfD = new Date(d);
  sundayOfD.setDate(d.getDate() - d.getDay());
  const shiftSunday = new Date(shift.shift.date);
  shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
  return sundayOfD.getTime() === shiftSunday.getTime() ? shift.shiftedDate : d;
};

export const generateRoutineICS = (
  recycling: RecyclingInfo | null,
  garbage: GarbageInfo | null
): string => {
  const lines = beginCalendar('Routine');

  if (recycling) {
    for (const d of datesForDay(recycling.day, HORIZON_DAYS)) {
      if (!isPickupWeek(weekIndexFrom2026(d), recycling.weekColor)) continue;
      const actual = applyShiftIfAny(d, recycling.day);
      emitEvent(
        lines,
        actual,
        `recycling-${recycling.serviceArea}-${fmtICS(actual)}`,
        `Recycling — ${recycling.weekColor} week`,
        `Blue cart recycling (${recycling.weekColor} week\\, biweekly).`,
        'Set out blue cart tomorrow'
      );
    }
  }
  if (garbage) {
    for (const d of datesForDay(garbage.day, HORIZON_DAYS)) {
      const actual = applyShiftIfAny(d, garbage.day);
      emitEvent(
        lines,
        actual,
        `garbage-${garbage.division}-${fmtICS(actual)}`,
        'Garbage pickup',
        `Black cart garbage (weekly\\, division ${garbage.division}).`,
        'Set out black cart tomorrow'
      );
    }
  }
  return finalize(lines);
};
```

- [ ] **Step 2: Add a download button inside `RoutinePickups`**

In `src/components/RoutinePickups.tsx`, change the props interface to:

```tsx
interface Props {
  recycling: RecyclingInfo | null;
  garbage: GarbageInfo | null;
  onDownload: () => void;
}
```

Update the destructure: `({ recycling, garbage, onDownload }: Props)`.

After the holiday callout block (before the closing `</section>`), insert:

```tsx
{(recycling || garbage) && (
  <div className="mt-3 text-right">
    <button
      onClick={onDownload}
      className="border border-ink px-3 py-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-ink hover:bg-ink hover:text-cream transition-colors"
    >
      Filed · routine.ics
    </button>
  </div>
)}
```

- [ ] **Step 3: Wire the download in `App.tsx`**

Add the import:

```tsx
import { generateRoutineICS } from './lib/ics';
```

(Add `generateRoutineICS` to the existing `import { generateICS } from './lib/ics';` line.)

Add the handler near `handleDownload`:

```tsx
const handleRoutineDownload = () => {
  if (!result) return;
  const url = generateRoutineICS(result.recycling, result.garbage);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chicago-routine-pickups-${SCHEDULE_YEAR}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

Pass it to `<RoutinePickups>`:

```tsx
<RoutinePickups
  recycling={result.recycling}
  garbage={result.garbage}
  onDownload={handleRoutineDownload}
/>
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm run build
```

Both must pass. Run dev server, perform a lookup, click "Filed · routine.ics", verify a `.ics` file downloads. Open it in a text editor — confirm VEVENTs covering the next ~90 days with both recycling (biweekly Yellow weeks) and garbage (every Friday) entries. Holiday-shifted dates should already be reflected in the DTSTART of any affected event.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ics.ts src/components/RoutinePickups.tsx src/App.tsx
git commit -m "feat(ics): generateRoutineICS for recycling and garbage 90-day export"
```

---

## Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a new entry under "Data sources"**

Find the "Data sources (memorize these)" section. After entry 4 (Address cleaning), append:

```markdown
### 5. ArcGIS layers (recycling + garbage)

Chicago's Socrata recycling dataset (`edks-4g3b`) is empty/deprecated. The live data lives on the city's ArcGIS REST endpoint:

- **Recycling base URL:** `https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/76`
- **Garbage base URL:** `https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/127`
- **Spatial query shape:** append `/query?geometry=<lon>,<lat>&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`
- **Recycling fields:** `SERVICE_AREA`, `AREA_DETAIL` (e.g. `"4IN-WK A-YLW-CTY-MO"`), `VENDOR`, `URL_PDF`.
- **`AREA_DETAIL` decoding** (in `src/lib/recyclingDecode.ts`):
  - Service area number (e.g. `4IN`)
  - `WK A` / `WK B` — week pattern letter
  - `YLW` / `ORG` — display color label
  - Vendor code (`CTY` = city)
  - Day of week code (`MO` etc.)
- **Garbage fields:** `DAY` (full English weekday), `DIVISION`, `SAN_DAY`.
- **Critical quirk:** the `WEEK A` letter and the `YLW` color label are NOT redundant. Use the color label for display; use the calendar week parity for "is this a pickup week" math (anchored by `lib/recyclingDecode.ts`'s `ANCHOR_WEEK_INDEX_IS_YELLOW` constant).
- **Holiday shifts** are NOT in the ArcGIS data. We hand-encode them in `src/lib/holidays.ts` annually. **TODO: refresh this table at the end of each calendar year from chicago.gov's "Holiday Garbage Schedule" page.**
```

- [ ] **Step 2: Add a sub-section convention note to "Design motif: the four stars"**

Find the "Design motif: the four stars" subsection and append:

```markdown
**Sub-section convention:** when a top-level Section needs to split, use letter sub-numbering (II.a / II.b) rather than promoting to its own Section. This preserves the four-section / four-star mapping (I Lookup, II Pickups, III Almanac, IV Footnotes). Currently II.a = Sweep hero, II.b = Routine pickups (recycling + garbage).
```

- [ ] **Step 3: Update the file structure tree**

Find the `src/` tree and update `lib/` and `components/` to include the new files in alphabetical order:

```
    ├── lib/                        # Pure functions, no React imports
    │   ├── address.ts              # cleanAddress()
    │   ├── dates.ts                # daysFromToday(), startOfDay(), nextDayOfWeek(), weekIndexFrom2026(), formatters
    │   ├── garbage.ts              # lookupGarbage() — ArcGIS layer 127
    │   ├── geocode.ts              # geocode() + Census→Nominatim chain
    │   ├── holidays.ts             # 2026 Chicago Streets and San holiday-shift table
    │   ├── ics.ts                  # generateICS() (sweep) + generateRoutineICS() (recycling+garbage)
    │   ├── recycling.ts            # lookupRecycling() — ArcGIS layer 76
    │   ├── recyclingDecode.ts      # AREA_DETAIL parser + isPickupWeek predicate
    │   ├── schedule.ts             # fetchSchedule()
    │   └── zones.ts                # lookupZone() + 2026→2025 fallback
    └── components/
        ├── AddressInput.tsx
        ├── ChicagoStar.tsx
        ├── ErrorPanel.tsx
        ├── Footnotes.tsx
        ├── HowItWorks.tsx
        ├── Masthead.tsx
        ├── NextSweepHero.tsx
        ├── RoutinePickups.tsx
        ├── ScheduleAlmanac.tsx
        └── Seal.tsx
```

- [ ] **Step 4: Verify**

```bash
grep -n "edks-4g3b\|gisapps.chicago.gov\|RoutinePickups\|II.a\|II.b" CLAUDE.md
```

Expected: at least 5 matches confirming the new content is present.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document ArcGIS layers, AREA_DETAIL decoding, II.a/II.b structure"
```

---

## Self-review (author)

**Spec coverage:**
- Recycling lookup → Tasks 5 + 6.
- Garbage lookup → Task 7.
- Holiday shifts hand-encoded → Task 4.
- Recycling A/B anchor (configurable) → Task 5 (`ANCHOR_WEEK_INDEX_IS_YELLOW`).
- `useLookup` extension with parallel fan-out → Task 8.
- `RoutinePickups` component (pattern-only + holiday callout) → Task 9.
- App.tsx wiring → Task 10.
- Section II.a / II.b numbering → Task 11.
- Routine .ics export → Task 12.
- CLAUDE.md update → Task 13.
- Type extensions → Task 2.
- ArcGIS endpoint constants → Task 2.
- CORS verification (with proxy fallback path) → Task 1.
- Graceful degradation when recycling/garbage fail → Task 8 (`.catch(() => null)` per service).
- Two .ics downloads (sweep vs routine) → Task 12 retains existing sweep export, adds routine.

**Placeholder scan:** No "TBD"/"fill in details". Holiday data has a `// TODO: refresh this table` annual maintenance reminder, also surfaced in CLAUDE.md (Task 13).

**Type consistency:**
- `DayOfWeek` defined in Task 2; used identically in Tasks 3, 4, 5, 6, 7, 9, 12.
- `WeekColor` defined in Task 2; used in Tasks 5, 6, 9, 12.
- `RecyclingInfo`, `GarbageInfo`, `HolidayShift` shapes defined in Task 2; consumers in Tasks 6, 7, 8, 9, 12 match.
- `findUpcomingShift` signature `(serviceDay: DayOfWeek, from?: Date) => { shift: HolidayShift; shiftedDate: Date } | null` — defined in Task 4, consumed identically in Tasks 9 and 12.
- `lookupRecycling`/`lookupGarbage` return `Promise<RecyclingInfo | null>` / `Promise<GarbageInfo | null>` — defined in Tasks 6/7, consumed identically in Task 8.
- ArcGIS layer URL constants in Task 2, consumed in Tasks 6 and 7.

**Build sequence sanity:** Task 8 (`useLookup` extension) makes the hook return a complete `LookupResult` with `recycling`/`garbage` fields. App.tsx initially doesn't read those fields; TypeScript permits the extra fields, so typecheck passes through Task 8. Task 10 then consumes the new fields. Task 11 is purely a label change. Task 12 adds the ICS download. Task 13 is docs only.

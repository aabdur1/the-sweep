# The Sweep — v2: Routine Pickups (Recycling + Garbage)

**Date:** 2026-05-02
**Owner:** Amir
**Status:** Approved design, awaiting implementation plan
**Builds on:** `docs/superpowers/specs/2026-05-01-chi-sweep-port-design.md` (v1 port)

---

## Goal

Extend "The Sweep" to also surface a household's recycling and garbage pickup pattern alongside the existing street-sweeping schedule. Pattern-first (day-of-week + week-color), not date-by-date — the routine cadence is the answer for these. Holiday-driven shifts are surfaced when they apply.

The street-sweeping urgency hierarchy stays intact: $60 ticket avoidance is still the top-of-page moment.

## Why

Chicagoans mentally bundle "when does my cart get picked up?" with "when does my street get swept?" — they're all "things city services do at my address on a schedule." The app currently solves one and leaves the user looking elsewhere for the other. With this feature, one address lookup answers all three questions.

## Scope

**In v2:**
- Add recycling pickup lookup (day-of-week + biweekly A/B week color).
- Add garbage pickup lookup (day-of-week, weekly).
- Surface holiday shifts when they affect the current or upcoming pickup.
- New `RoutinePickups` component sitting between the sweep hero and the almanac.
- `.ics` export gains routine pickup events ("Filed · routine.ics" download).
- Update CLAUDE.md to document the new datasets and component.

**Out of v2:**
- Bulk pickup (on-demand, not scheduled — punt).
- Yard waste (different program, low priority).
- A queryable "next 6 months of pickups" almanac (the pattern is enough; if a user wants every Friday, they can read "every Friday").
- Push notifications (still on the v3 roadmap).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Data source | Chicago **ArcGIS REST** at `gisapps.chicago.gov` (not Socrata) | Socrata's `edks-4g3b` recycling dataset is empty/deprecated; ArcGIS layers 76 + 127 are the live source |
| Default UI | Pattern-only ("Mondays, Yellow week" / "Fridays") | The cadence IS the answer; listing 52 garbage dates is noise. Confirmed with user |
| Exceptions | Surface holiday shifts inline when applicable | User explicitly asked for "the pattern unless it's different any day" |
| State management | Extend `useLookup` (one hook, three parallel queries after geocode) | Single loading state, single error state, coherent UX |
| Section numbering | Rename Section II to "Pickups": sweep hero + routine sub-block | Preserves the four-star structural mapping (I Lookup, II Pickups, III Almanac, IV Footnotes) |
| Holiday data | Hand-encoded `lib/holidays.ts` table for 2026 | Chicago publishes shifts as a webpage table, not a queryable API; ~5–8 entries per year is small enough |
| Recycling anchor | Verify A/B week for one known address against city's Blue Cart calendar PDF | The 2012 description doesn't apply directly; need a 2026 anchor week to compute "next pickup" |

## Data sources

### Layer 76 — Recycling Pick-up Schedule

- **Endpoint:** `https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/76/query`
- **Spatial query:**
  ```
  ?geometry=<lon>,<lat>
   &geometryType=esriGeometryPoint
   &inSR=4326
   &spatialRel=esriSpatialRelIntersects
   &outFields=*
   &returnGeometry=false
   &f=json
  ```
- **Schema (relevant fields):**
  ```ts
  {
    SERVICE_AREA: number;     // 4
    AREA_DETAIL: string;      // "4IN-WK A-YLW-CTY-MO" — the encoded pattern
    VENDOR: string;           // "CTY" (city) | "WMI" | other private
    URL_PDF: string;          // link to city's blue-cart schedule
  }
  ```
- **`AREA_DETAIL` decoding:** dash-separated codes
  - `4IN` — area number + IN/OUT flag (interior vs perimeter route, ignore for now)
  - `WK A` or `WK B` — week pattern
  - `YLW` or `ORG` — color label (display)
  - `CTY` / `WMI` — vendor (city or contractor; same field as `VENDOR`)
  - `MO` / `TU` / `WE` / `TH` / `FR` — day of week
- **Schedule semantics:** biweekly. Each address belongs to one week (A/B = Yellow/Orange) on a fixed day of week. The city alternates which color gets picked up each calendar week.

### Layer 127 — DSS Garbage Pickup

- **Endpoint:** `https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/operational/MapServer/127/query` (same spatial query shape)
- **Schema (relevant fields):**
  ```ts
  {
    DAY: string;            // "Friday" — full English day of week
    DIVISION: string;       // "3" — operational division code (display only)
    SAN_DAY: string;        // "3FR" — combined code (display only)
  }
  ```
- **Schedule semantics:** weekly. One pickup day, every week. No A/B alternation.

### Holiday shift data (manual)

Source: `chicago.gov/city/en/depts/streets/provdrs/streets_san/svcs/non-scheduled_garbage.html` (the city's "Holiday Garbage Schedule" page). Format on that page is a table: holiday → "no pickup that day, all subsequent days slide forward by one." E.g. if Memorial Day is Monday May 25, then Mon→Tue, Tue→Wed, …, Fri→Sat for that week.

We hand-encode this for 2026 in `src/lib/holidays.ts`. Schema:

```ts
interface HolidayShift {
  date: string;       // "2026-05-25" — the holiday itself
  name: string;       // "Memorial Day"
  affects: 'all' | 'after'; // 'after' = days after the holiday slide; 'all' = whole week shifts (rare)
}
```

The `applyHoliday(serviceDay, today)` helper returns the actual pickup date if a shift applies, else null.

## Architecture

```
chi-street-sweep/
└── src/
    ├── types.ts                          (extended: RecyclingInfo, GarbageInfo, ExtendedLookupResult)
    ├── lib/
    │   ├── geocode.ts                    (unchanged)
    │   ├── zones.ts                      (unchanged — sweep zones)
    │   ├── schedule.ts                   (unchanged — sweep dates)
    │   ├── recycling.ts                  NEW — lookupRecycling(lat, lon)
    │   ├── recyclingDecode.ts            NEW — parse AREA_DETAIL → { day, color, week }
    │   ├── garbage.ts                    NEW — lookupGarbage(lat, lon)
    │   ├── holidays.ts                   NEW — 2026 shift table + applyHoliday()
    │   ├── ics.ts                        (extended: generateRoutineICS for recycling+garbage)
    │   ├── address.ts                    (unchanged)
    │   └── dates.ts                      (extended: nextDayOfWeek, weekColorOn)
    ├── hooks/
    │   └── useLookup.ts                  (extended: fans out to all three lookups in parallel)
    └── components/
        ├── Masthead.tsx                  (unchanged)
        ├── AddressInput.tsx              (unchanged)
        ├── ErrorPanel.tsx                (unchanged)
        ├── NextSweepHero.tsx             (heading copy: "Section II — Pickups · Sweep")
        ├── RoutinePickups.tsx            NEW
        ├── ScheduleAlmanac.tsx           (heading copy: "Section III" stays)
        ├── Footnotes.tsx                 (unchanged — still "Section IV")
        ├── HowItWorks.tsx                (unchanged)
        ├── ChicagoStar.tsx               (unchanged)
        └── Seal.tsx                      (unchanged)
```

### Data flow

```
Address (typed or GPS)
    │
    ▼
geocode(address)       → { lat, lon }
    │
    ├─→ lookupZone(lat, lon)        → { ward, section }       → fetchSchedule(...)   → SweepDate[]
    ├─→ lookupRecycling(lat, lon)   → RecyclingInfo
    └─→ lookupGarbage(lat, lon)     → GarbageInfo
    
(all three run in parallel via Promise.all after geocode)
    │
    ▼
LookupResult { ward, section, dates, recycling, garbage, display, coords }
```

### Boundaries (carry-forward)

- `src/lib/` stays React-free. ArcGIS query helpers are pure async functions.
- `recyclingDecode.ts` is a pure parser; `holidays.ts` is a pure date helper. No fetches in either.
- The hook still owns orchestration. Components still just render.

## UI: `RoutinePickups` component

**Layout (mobile-first, max-width ~600px stays):**

```
✦ Section II.b — Routine pickups
─────────────────────────────────────────────

┌──── Recycling ────┐  ┌──── Garbage ────┐
│ ★                 │  │ ★               │
│ MONDAYS           │  │ FRIDAYS         │
│ — Yellow week —   │  │ every week      │
│                   │  │                 │
│ Next: May 18      │  │ Next: May 8     │
└───────────────────┘  └─────────────────┘

[ ⚠ Holiday: Memorial Day shifts Friday garbage    ]
[   to Saturday May 30. Recycling unaffected.       ]
```

- Two-column on screens ≥ 480px, stacked on smaller.
- Each card: ChicagoStar marker top-left, big serif day-of-week (display), italic week-color subtitle (recycling only) or italic "every week" (garbage), mono "Next: …" line.
- Holiday callout below cards when the next normal pickup is affected. Subtle red border, AlertTriangle icon, mono kicker, italic-serif body.
- Same border / typography / star vocabulary as the rest of the broadsheet.

**Heading treatment:** to keep the four-star mapping, the section header inside `RoutinePickups` reads "II.b — Routine pickups" (a sub-section of "II — Pickups"). The almanac and footnotes keep their current Section III / Section IV labels.

**`NextSweepHero` heading update:** rename internal label from "Section II — Your Next Sweep" to "Section II.a — Sweep" so the II.a / II.b sub-numbering is consistent.

## ICS export changes

- The current single `.ics` button in `ScheduleAlmanac` exports sweep dates only. Keep it.
- Add a second smaller `.ics` link inside `RoutinePickups`: "Filed · routine.ics" — downloads recycling + garbage events for the next 90 days, including any holiday-shifted dates.
- We don't pre-generate 52 weekly garbage events for the whole year — 90 days is enough; the user can re-download if they need more.

## Risks and gotchas

- **ArcGIS endpoint stability.** The Chicago ArcGIS REST URL is unofficial relative to Socrata. It could be moved or restricted. Mitigation: graceful failure — if recycling/garbage lookups fail, render the sweep result as we do today and show a small "Routine pickups unavailable" notice. Do not block the sweep result on these queries.
- **ArcGIS CORS confirmed supported (verified 2026-05-02).** `access-control-allow-origin` reflects the Origin header and `access-control-allow-credentials: true`. No proxy needed. This is the opposite of Census — Chicago's ArcGIS is browser-friendly.
- **`AREA_DETAIL` parser robustness.** The format is undocumented; some addresses may have variant codes (e.g. multiple days, vendor-specific routes). Decoder must default safely (return what it can parse, leave unknowns blank, never throw).
- **Recycling A/B anchor.** Need a known calendar week → A or B mapping for 2026. If we can't pin one down deterministically, fall back to displaying the color label without a "next date" prediction. The decoded color (`YLW` / `ORG`) is still useful on its own.
- **Holiday list ages.** The hand-encoded 2026 list works for 2026; we'll need to refresh annually. Add a TODO comment + a CLAUDE.md note for the next-year rollover.
- **Two `.ics` files vs one combined.** Decision is two: separating sweep from routine lets users pick what to import. Combining would be simpler but mixes very different cadences in one calendar.

## Open items deferred to the implementation plan

- The exact CORS test command for `gisapps.chicago.gov` (Task 1 of the new plan should verify before building).
- Decoder edge cases for `AREA_DETAIL` strings observed in the wild (will discover during testing).
- Whether the `URL_PDF` field is worth surfacing as a "view official schedule" link (probably yes, footer-style — confirm in implementation).
- Bulk pickup integration (out of scope for v2 but the dataset shape might overlap; revisit).

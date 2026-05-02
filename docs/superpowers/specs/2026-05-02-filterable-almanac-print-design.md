# The Sweep — v4: Filterable Almanac + Print

**Date:** 2026-05-02
**Owner:** Amir
**Status:** Approved design, awaiting implementation plan
**Builds on:** v1 (port + visual), v2 (routine pickups), v3 (Google Places + saved), v3.5 (desktop broadsheet)

---

## Goal

Convert the Almanac from a sweep-only schedule into a **unified, filterable, full-calendar-year view** of all three pickup types (sweep, recycling, garbage), and turn the page into a properly-formatted **printed broadsheet** that someone could pin to their fridge.

These two changes ship together because the print case validates the filter — a "garbage-only fridge calendar" is exactly the kind of artifact this app should be able to produce.

## Why

The current state has a useful but partial almanac (sweep dates only) and a routine-pickups card that shows recycling/garbage as patterns without concrete dates. A user who wants "every Friday garbage day for the next quarter" has no clean way to extract that. Print is also broken — the screen-optimized cream/blue/red palette renders as a dingy wash on B&W home printers.

A unified, filterable, print-ready Almanac solves both: it becomes the canonical reference for "everything happening at this address," on screen and on paper.

## Scope

**In v4:**
- Three checkboxes at the top of Section III: ☐ Sweep ☐ Recycling ☐ Garbage. All three default on.
- Almanac shows the full calendar year (Jan–Dec of `SCHEDULE_YEAR`).
- Type-rows-per-month layout — each month divides into up to three labelled rows.
- Holiday-shifted garbage dates display the shift inline.
- Single unified `.ics` export driven by current filter state (replaces today's two separate exports).
- "Print" button next to the `.ics` button.
- `@media print` stylesheet: hides screen-only chrome, forces B&W broadsheet on paper.
- Pure `lib/buildAlmanac.ts` helper that other components can consume.

**Out of v4:**
- Dark mode (separate spec).
- Print preview UI (rely on browser native print preview).
- Filter persistence across sessions (filter state is per-page-load).
- Filter sharing via URL params.
- Snow route status, 311 quick links, etc. (separate specs).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Combine print + filter | One spec | Filter state drives what prints; shipping print first would force a refactor |
| Layout when all three on | Type rows per month (option ii) | Most legible on print, matches the "almanac entry" framing |
| Default checkbox state | All three on | Almanac becomes maximally useful out of the box |
| Date horizon | Full calendar year (Jan–Dec) | Matches the "annual civic almanac" framing; off-season Sweep months read as `— off-season —` |
| Print color treatment | Force B&W broadsheet (override CSS vars in `@media print`) | Most home printers are B&W; cream → grey wash. Real newspapers print B&W |
| ICS export | Single button in Almanac header, respects filter | Removes the now-redundant routine `.ics` button in RoutinePickups |
| Filter persistence | None (per-page-load) | Lookups are session-scoped already; over-engineering otherwise |

## Data model

Today, `LookupResult.dates` is `SweepDate[]`. We extend the unified date stream to a discriminated union and centralize date generation:

```ts
export type ScheduleEntry =
  | { type: 'sweep'; date: Date; sideLabel: 'A' | 'B'; pairIdx: 0 | 1 }
  | { type: 'recycling'; date: Date; weekColor: 'Yellow' | 'Orange' }
  | {
      type: 'garbage';
      date: Date;
      /** Set when the date was shifted from a holiday week. */
      shiftedFrom?: { date: Date; holidayName: string };
    };

export type ScheduleType = ScheduleEntry['type'];
```

A new pure helper `src/lib/buildAlmanac.ts` exports:

```ts
buildAlmanac(result: LookupResult, year: number): ScheduleEntry[]
```

Behavior:
- Sweep: pulls from `result.dates` (existing).
- Recycling: walks every Mon-of-the-pickup-day from Jan 1 to Dec 31, filters by `isPickupWeek(weekIdx, recycling.weekColor)` from `recyclingDecode.ts`, applies holiday shift via `findUpcomingShift`.
- Garbage: walks every pickup-day-of-the-week from Jan 1 to Dec 31, applies holiday shift.
- Returns sorted by `date.getTime()`.
- Pure: no fetches, no React, no time-of-day side effects (uses `startOfDay` consistently).

This refactor consolidates the date-generation logic that today lives split across `lib/recycling.ts`, `lib/ics.ts`, and `lib/holidays.ts`.

## Architecture

```
chi-street-sweep/
└── src/
    ├── types.ts                      (extended: ScheduleEntry, ScheduleType union)
    ├── lib/
    │   ├── buildAlmanac.ts           NEW — pure ScheduleEntry[] generator
    │   ├── ics.ts                    (rewritten: generateICS(entries, filter, ward, section))
    │   ├── recycling.ts              (unchanged)
    │   ├── garbage.ts                (unchanged)
    │   ├── holidays.ts               (unchanged)
    │   ├── recyclingDecode.ts        (unchanged)
    │   └── ...                       (unchanged)
    └── components/
        ├── ScheduleAlmanac.tsx       (rebuilt: filter checkboxes, type rows, compact pills)
        ├── RoutinePickups.tsx        (modified: remove the routine .ics button)
        ├── App.tsx                   (modified: route both downloads through Almanac)
        └── ...                       (unchanged)
└── src/index.css                     (extended: @media print block)
```

### Data flow

```
App → useLookup() → LookupResult { sweep, recycling, garbage }
                             ↓
                    buildAlmanac(result, SCHEDULE_YEAR)
                             ↓
                    ScheduleEntry[] (full year, sorted)
                             ↓
                    ScheduleAlmanac
                       - filter state: Set<ScheduleType>
                       - displays only entries whose .type ∈ filter
                       - .ics download builds from same filter
                       - Print button calls window.print()
```

The filter set is local component state; it doesn't propagate up. The `.ics` and Print buttons read it directly from the same component.

### Boundaries

- `lib/buildAlmanac.ts` is the single source of truth for what dates exist. UI and ICS export both consume its output. Pure function, no React, no fetches.
- `ScheduleAlmanac` owns the filter UI and reads `entries` from props. The filter state is internal.
- `lib/ics.ts` `generateICS` takes `(entries: ScheduleEntry[], ward, section, types: Set<ScheduleType>)` and produces a blob URL. Replaces today's two separate functions (`generateICS`, `generateRoutineICS`).

## UI: filterable almanac with type rows

### Section III header bar

Mobile (`<lg:`):

```
✦ SECTION III
Full Almanac
[ Sweep ] [ Recycling ] [ Garbage ]   ← toggle chips
12 months · 168 dates                                    [Print]  [.ics]
```

Desktop (`lg:`):

```
✦ SECTION III                                ☐ Sweep  ☐ Recycling  ☐ Garbage   [Print]  [.ics]
Full Almanac
12 months · 168 dates
```

- The summary line (`N months · M dates`) updates live with the filter.
- Mobile: filters render as toggle chips (sharp rectangles, ChicagoStar + mono label, ink/cream when on, ink-soft outline when off) so they remain tappable.
- Desktop: filters render as proper checkboxes with mono labels.
- Both Print and .ics buttons share the existing `border-2 border-ink` button styling.

### Type-rows per month (when ≥1 type checked)

```
April                                                                17 dates
─────────────────────────────────────────────────────────────────────────
✦ SWEEP      [Tue Apr 7]  [Wed Apr 8]
✦ RECYCLE    [Mon Apr 6]  [Mon Apr 20]
✦ GARBAGE    [Fri Apr 3]  [Fri Apr 10]  [Fri Apr 17]  [Fri Apr 24]
```

- The month name is unchanged from current Almanac (`font-serif text-2xl text-ink`, with the rule line + dates count).
- Each type row has a tiny kicker (ChicagoStar + mono uppercase label, `text-[10px] tracking-[0.25em]`) followed by date pills.
- **Type kicker color:**
  - Sweep: chicago-red (urgency category)
  - Recycling: chicago-blue
  - Garbage: ink
- **Date pills:** ~88px wide, ~52px tall. Mono day-of-week (top), serif numeral (middle), small mono month abbreviation (bottom). Border `1px ink` by default.
- **Compact in two ways:** smaller than today's sweep cells (which are 50% of column width); horizontally laid out instead of in a 2-up grid.
- **Today border:** `border-2 border-chicago-red` for any pill where `daysFromToday(entry.date) === 0`, regardless of type.
- **Past dates:**
  - Sweep: keeps the "Swept" diagonal stamp (high-stakes, the visible cancellation reads as "you survived").
  - Recycling / Garbage: 40% opacity, no stamp. Past pickup is just past.
- **Holiday-shifted garbage:** the date pill shows the shifted date (e.g. `Sat May 30`) with a small italic mono note inside the pill: `(was Fri)`. The pill border picks up the chicago-red color to flag the unusual date.
- **Empty type for a month:** if Sweep is checked but the month is off-season (Jan, Feb, Mar, Dec), the row reads:
  ```
  ✦ SWEEP    — off-season —
  ```
  in italic mono ink-soft text. Editorially honest.

### Mobile vs desktop layout

- **Mobile (`<lg:`):** type rows stack within each month; date pills wrap onto multiple lines.
- **Desktop (`lg:`):** the existing 4-column-month grid stays. Each month tile has its three type rows stacked vertically inside it.

### Filter behavior

- Toggling a type animates the entries in/out (300ms `slide-up` reuse from existing animations). No layout shift on the rest of the page.
- If all three are unchecked, the Almanac shows a small placeholder: `✦ Pick at least one type to see your schedule.`
- Filter state is initialized from a default constant `DEFAULT_FILTER: Set<ScheduleType> = new Set(['sweep', 'recycling', 'garbage'])`.

### `.ics` filename

- Today: two separate filenames (`chicago-sweeps-W{ward}S{section}-{year}.ics`, `chicago-routine-pickups-{year}.ics`).
- After v4: one filename, types-aware:
  - All three: `chicago-schedule-W{ward}S{section}-{year}.ics`
  - Subset: `chicago-{type1}-{type2}-W{ward}S{section}-{year}.ics` (alphabetical, e.g. `chicago-garbage-recycling-W25S03-2026.ics`)
  - Single: `chicago-{type}-W{ward}S{section}-{year}.ics`

## Print stylesheet

Lives in `src/index.css` in a new `@media print` block. Key behaviors:

### Hidden on print

- `AddressInput` (Section I — Lookup form)
- `SavedAddressChips`
- `SaveAddressPrompt`
- `Marginalia` (both gutters — they're decorative chrome that matters only on screen)
- `HowItWorks` (only renders when no result; if you're printing, you have a result)
- All hover-tooltips
- The Print and `.ics` buttons themselves
- The `.grain` texture overlay
- The footer's "End of edition" + four-star row (the printed page IS the edition)
- The flag stripe at the top of the masthead

### Color overrides

```css
@media print {
  :root {
    --cream: #ffffff;
    --cream-dark: #ffffff;
    --ink: #000000;
    --ink-soft: #1a1a1a;
    --chicago-red: #000000;
    --red-deep: #000000;
    --chicago-blue: #000000;
    --blue-deep: #000000;
    --rule: #000000;
  }
  body {
    background: white;
    color: black;
  }
}
```

White paper, black ink. The cream/red/blue palette is screen-only.

### Urgency without color

When the page prints, urgency that previously relied on chicago-red needs to read on B&W:

- The "Move your car." headline in NextSweepHero gets `font-weight: 800` and a `▮ ` block prefix in print mode (e.g. `▮ Move your car.`).
- Sweep type kickers in the Almanac get the same `▮ ` prefix on print: `▮ SWEEP` instead of `★ SWEEP`. (Black star + black "SWEEP" reads weakly; the block prefix gives it visual weight.)
- Today's date pill keeps its 2px border (was chicago-red, now black) but bumps to `border-width: 3px` so it stands out among 1px-bordered pills.

### Page setup

```css
@media print {
  @page {
    margin: 0.5in;
    size: letter;
  }
  /* The desktop broadsheet outer frame and grain are screen affectations */
  .grain { background-image: none !important; }
  body { background: white !important; }
}
```

### Single-column print layout

The desktop broadsheet's three-column body grid (`[140px _ 1fr _ 140px]`) collapses to a single column on print, since the marginalia are hidden anyway:

```css
@media print {
  /* Collapse the lg three-column grid */
  [data-page-grid] { display: block; }
  /* Hide outer frame */
  [data-page-frame] { border: none; box-shadow: none; max-width: none; }
}
```

(We add `data-page-grid` and `data-page-frame` data attributes to the App.tsx wrappers as targeted hooks.)

### Page-break behavior

- Each month block in the Almanac gets `break-inside: avoid` so a month doesn't split across pages.
- The masthead is allowed to break naturally (won't repeat).
- A `break-before: page` is set on the Almanac so it starts on its own page after the hero/routine.

### Running header

A small running header appears at the top of every print page, scoped via a print-only element in App.tsx:

```tsx
<div data-print-header className="hidden print:block">
  THE SWEEP · {result?.display ?? '—'} · printed {todayLong}
</div>
```

Tiny mono caps, centered, with a hairline rule below. Reads as the "page banner" of a real printed sheet.

## Risks and gotchas

- **Type-row vertical density.** Three rows × 4–5 garbage cells per month × 12 months = a lot of cells. The compact pill design (88×52) is essential — if pills stay at the current 50%-of-column size, the page becomes scrolling-only. Verify density at mobile (414px) early.
- **Past dates dominate.** By August in real-world use, ~30 weeks of garbage are in the past at 40% opacity. The page risks looking like a wall of greyed-out cells. Consider auto-scrolling the Almanac to the current month on mount, or rendering past months in a collapsed/summarized form. **Plan implementation note:** add `auto-scroll to current month` on mount.
- **Holiday-shifted dates with multiple holidays in one week.** The data already handles this (each holiday has its own `resolveShift`), but the Almanac UI has to label only the *actually-applied* shift, not every nearby holiday. Verify against Memorial Day week (May 25, 2026) where Friday → Saturday shifts.
- **Print of an extremely tall page.** With type rows × 12 months × 168 dates, the printed output may be 3–4 letter pages. That's acceptable (it's an annual almanac), but page-break-inside-avoid on each month is essential to prevent month-mid breaks.
- **`@media print` testing in dev.** Browser print preview behaves slightly differently across Chrome / Safari / Firefox. Verify in at least Chrome and Safari.
- **`.ics` parser sensitivity.** When all three types are exported into one VCALENDAR, the filename change and the SUMMARY field changes need care so existing calendar subscriptions don't dedup or break.
- **Auto-collapse vs. show-all.** If a user has had 30 weeks of garbage already happen, do they want to see them grey-stamped or hidden? The default in this spec is "show greyed; let the user scroll." Open to revisiting if real use proves it overwhelming.

## Open items deferred to the implementation plan

- Exact pill dimensions and spacing — refine during implementation against real data density.
- Whether `.ics` SUMMARY field includes the type prefix (e.g. `[GARBAGE] Pickup`) — likely yes, helps distinguish in calendar apps.
- Filter chip vs checkbox styling specifics on mobile vs desktop — finalize during implementation.
- Whether to pre-scroll the Almanac to the current month on mount, or rely on natural top-of-section scroll. Default: auto-scroll the *current month* into view.
- Print page numbers (Page 1 of 3) — nice-to-have, defer.

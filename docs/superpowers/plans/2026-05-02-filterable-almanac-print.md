# Filterable Almanac + Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Almanac from a sweep-only schedule into a unified, filterable, full-calendar-year view of all three pickup types (sweep, recycling, garbage), and add a print stylesheet that turns the page into a B&W broadsheet on paper.

**Architecture:** A new pure helper `lib/buildAlmanac.ts` consolidates date generation across all three pickup types into a sorted `ScheduleEntry[]`. The Almanac component becomes self-contained: it consumes `LookupResult`, owns filter state, renders type-rows-per-month, collapses fully-past months by default, and exports its own `.ics` plus calls `window.print()`. A new `@media print` block in `index.css` overrides CSS variables to force B&W and hides screen-only chrome.

**Tech Stack:** Same as v1–v3 (Vite + React 18 + TS + Tailwind). No new npm packages.

**Spec:** `docs/superpowers/specs/2026-05-02-filterable-almanac-print-design.md`

**Note on testing:** No automated tests (project convention). Verification is manual against the canonical address `1819 S California Ave, Chicago` → Ward 25 §03, Mondays Yellow recycling, Fridays garbage. Print verification uses the browser's native print preview.

**Working directory:** All paths relative to `/Users/amirabdurrahim/repos/chi-street-sweep/`.

---

## Task 1: Type extensions

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Append the discriminated union to `src/types.ts`**

Add to the file (after `SweepDate` and `RecyclingInfo` / `GarbageInfo` are already defined, near the v3 section comment):

```ts
// ─── v4: filterable almanac ────────────────────────────────────────────────

export type ScheduleEntry =
  | { type: 'sweep'; date: Date; sideLabel: Side; pairIdx: 0 | 1 }
  | { type: 'recycling'; date: Date; weekColor: WeekColor }
  | {
      type: 'garbage';
      date: Date;
      /** Set when this date was shifted from a holiday week. */
      shiftedFrom?: { date: Date; holidayName: string };
    };

export type ScheduleType = ScheduleEntry['type'];
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. `Side` and `WeekColor` already exist in `types.ts`; nothing else changes shape yet.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): ScheduleEntry discriminated union + ScheduleType for filterable almanac"
```

---

## Task 2: `lib/buildAlmanac.ts` — pure full-year date generator

**Files:**
- Create: `src/lib/buildAlmanac.ts`

This consolidates the date-generation logic that today lives split across `lib/recycling.ts`, `lib/ics.ts`, and `lib/holidays.ts`. The output is a sorted `ScheduleEntry[]` for the full calendar year.

- [ ] **Step 1: Create `src/lib/buildAlmanac.ts`**

```ts
import type {
  LookupResult,
  ScheduleEntry,
  DayOfWeek,
} from '../types';
import { startOfDay, weekIndexFrom2026 } from './dates';
import { isPickupWeek } from './recyclingDecode';
import { findUpcomingShift } from './holidays';

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

/**
 * Generate every garbage pickup date for `year`, applying any holiday shifts
 * that fall in the same calendar week as a candidate pickup day.
 */
const buildGarbageEntries = (
  day: DayOfWeek,
  year: number
): ScheduleEntry[] => {
  const out: ScheduleEntry[] = [];
  const targetIdx = DAY_INDEX[day];
  const cursor = startOfDay(new Date(year, 0, 1));
  const end = new Date(year, 11, 31);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getDay() === targetIdx) {
      const original = new Date(cursor);
      const shift = findUpcomingShift(day, original);
      if (shift) {
        const sundayOfOriginal = new Date(original);
        sundayOfOriginal.setDate(original.getDate() - original.getDay());
        const shiftSunday = new Date(shift.shift.date);
        shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
        if (sundayOfOriginal.getTime() === shiftSunday.getTime()) {
          out.push({
            type: 'garbage',
            date: shift.shiftedDate,
            shiftedFrom: { date: original, holidayName: shift.shift.name },
          });
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
      }
      out.push({ type: 'garbage', date: original });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/**
 * Generate every recycling pickup date for `year`, applying holiday shifts
 * the same way garbage does (a yellow-week Monday shifts forward when the
 * holiday lands earlier in the week).
 */
const buildRecyclingEntries = (
  day: DayOfWeek,
  weekColor: 'Yellow' | 'Orange',
  year: number
): ScheduleEntry[] => {
  const out: ScheduleEntry[] = [];
  const targetIdx = DAY_INDEX[day];
  const cursor = startOfDay(new Date(year, 0, 1));
  const end = new Date(year, 11, 31);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getDay() === targetIdx) {
      const original = new Date(cursor);
      if (isPickupWeek(weekIndexFrom2026(original), weekColor)) {
        const shift = findUpcomingShift(day, original);
        let actual = original;
        if (shift) {
          const sundayOfOriginal = new Date(original);
          sundayOfOriginal.setDate(original.getDate() - original.getDay());
          const shiftSunday = new Date(shift.shift.date);
          shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
          if (sundayOfOriginal.getTime() === shiftSunday.getTime()) {
            actual = shift.shiftedDate;
          }
        }
        out.push({ type: 'recycling', date: actual, weekColor });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/**
 * Build the unified almanac for the address — every sweep / recycling / garbage
 * date for the full calendar year, sorted ascending by date.
 *
 * Recycling and garbage are skipped when their lookup didn't return data
 * (rare; ArcGIS misses or unconfigured). Sweep is always included from
 * `result.dates` whether or not the season is in progress.
 */
export const buildAlmanac = (
  result: LookupResult,
  year: number
): ScheduleEntry[] => {
  const sweep: ScheduleEntry[] = result.dates.map((d) => ({
    type: 'sweep',
    date: d.date,
    sideLabel: d.sideLabel,
    pairIdx: d.pairIdx,
  }));

  const recycling = result.recycling
    ? buildRecyclingEntries(result.recycling.day, result.recycling.weekColor, year)
    : [];

  const garbage = result.garbage ? buildGarbageEntries(result.garbage.day, year) : [];

  const all = [...sweep, ...recycling, ...garbage];
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  return all;
};
```

- [ ] **Step 2: Smoke-test it**

Add a temporary `console.log` test by editing `src/App.tsx` (we'll revert in Step 4):

In `App.tsx`, near the top of the function, add (just for this task):

```tsx
import { buildAlmanac } from './lib/buildAlmanac';
import { SCHEDULE_YEAR as YR } from './types';

// near the result useMemo:
useEffect(() => {
  if (result) {
    const entries = buildAlmanac(result, YR);
    const counts = entries.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('ALMANAC entries:', entries.length, counts);
    console.log('First 5:', entries.slice(0, 5));
    console.log('Holiday-shifted:', entries.filter((e) => e.type === 'garbage' && e.shiftedFrom));
  }
}, [result]);
```

You'll need `import { useEffect } from 'react'` at the top if not already imported.

Run `npm run dev`, open the browser, look up the canonical address. Console should show:
- `ALMANAC entries: ~170 sweep:16 recycling:~26 garbage:~52`
- `Holiday-shifted` should include at least one garbage entry around Memorial Day (May 25, 2026 is a Monday → Friday May 29 stays normal, but Friday May 29 isn't shifted; check Independence Day observed July 3 which is a Friday → shifted to Saturday).

Wait — actually verify: which holidays affect Friday garbage in 2026?
- Jan 1 (Thu): doesn't affect Friday — Friday is after the holiday → shifts to Saturday Jan 2.
- Jul 3 (Fri): Friday IS the holiday → Friday Jul 3 garbage shifts to Saturday Jul 4.
- Dec 25 (Fri): same — shifts to Saturday Dec 26.

So expect at least 3 garbage entries with `shiftedFrom` set (Jan, Jul, Dec).

- [ ] **Step 3: Verify output then revert the smoke harness**

Once you've seen reasonable counts in the console, REMOVE the temporary `useEffect` and the unused imports from `App.tsx`. Do NOT commit the smoke harness.

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/buildAlmanac.ts
git commit -m "feat(buildAlmanac): full-year ScheduleEntry generator with holiday shifts"
```

(Confirm the diff shows ONLY the new file, not App.tsx changes.)

---

## Task 3: Refactor `lib/ics.ts` to a unified filter-aware generator

**Files:**
- Modify: `src/lib/ics.ts` (full rewrite)

Replace today's two functions (`generateICS` for sweep, `generateRoutineICS` for routine) with one that takes `ScheduleEntry[]` and a filter set.

- [ ] **Step 1: Replace `src/lib/ics.ts`**

```ts
import type { ScheduleEntry, ScheduleType } from '../types';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const beginCalendar = (): string[] => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Chicago Sweep//EN',
  'CALSCALE:GREGORIAN',
];

const finalize = (lines: string[]): string => {
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

const emitEvent = (
  lines: string[],
  d: Date,
  uid: string,
  summary: string,
  description: string,
  alarmMessage: string
): void => {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
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

const sweepEvent = (
  lines: string[],
  d: Date,
  ward: string,
  section: string,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `sweep-${ward}-${section}-${i}-${fmtICS(d)}`,
    `[SWEEP] MOVE CAR — Ward ${ward} §${section}`,
    `Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
    'Move car — street sweeping tomorrow'
  );

const recyclingEvent = (
  lines: string[],
  d: Date,
  weekColor: string,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `recycling-${weekColor}-${i}-${fmtICS(d)}`,
    `[RECYCLE] ${weekColor} week pickup`,
    `Blue cart recycling (${weekColor} week\\, biweekly).`,
    'Set out blue cart tomorrow'
  );

const garbageEvent = (
  lines: string[],
  d: Date,
  shifted: boolean,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `garbage-${i}-${fmtICS(d)}`,
    `[GARBAGE] Pickup${shifted ? ' (holiday shift)' : ''}`,
    `Black cart garbage (weekly${shifted ? '\\, holiday-shifted' : ''}).`,
    'Set out black cart tomorrow'
  );

/**
 * Build a single VCALENDAR blob URL containing every entry whose type is in `filter`.
 * Returns the blob URL (caller is responsible for `URL.revokeObjectURL`).
 */
export const generateICS = (
  entries: ScheduleEntry[],
  filter: Set<ScheduleType>,
  ward: string,
  section: string
): string => {
  const lines = beginCalendar();
  entries.forEach((entry, i) => {
    if (!filter.has(entry.type)) return;
    if (entry.type === 'sweep') {
      sweepEvent(lines, entry.date, ward, section, i);
    } else if (entry.type === 'recycling') {
      recyclingEvent(lines, entry.date, entry.weekColor, i);
    } else {
      garbageEvent(lines, entry.date, !!entry.shiftedFrom, i);
    }
  });
  return finalize(lines);
};

const TYPE_ORDER: ScheduleType[] = ['sweep', 'recycling', 'garbage'];

/**
 * Build the download filename for a filtered .ics export.
 *   all three: chicago-schedule-W25S03-2026.ics
 *   subset:    chicago-garbage-recycling-W25S03-2026.ics  (alphabetical)
 *   single:    chicago-sweep-W25S03-2026.ics
 */
export const buildICSFilename = (
  filter: Set<ScheduleType>,
  ward: string,
  section: string,
  year: number
): string => {
  const types = TYPE_ORDER.filter((t) => filter.has(t));
  const all = types.length === 3;
  const slug = all
    ? 'schedule'
    : [...types].sort().join('-');
  return `chicago-${slug}-W${ward}S${section}-${year}.ics`;
};
```

- [ ] **Step 2: Typecheck — expect breakage**

```bash
npm run typecheck
```

Expected: errors in `src/App.tsx` (still imports old `generateICS` with sweep signature, and `generateRoutineICS`). These get fixed in Tasks 7 and 8.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ics.ts
git commit -m "refactor(ics): unified generateICS(entries, filter, ward, section) + buildICSFilename"
```

---

## Task 4: ScheduleAlmanac — skeleton + filter UI + month grouping

**Files:**
- Modify: `src/components/ScheduleAlmanac.tsx` (full rewrite)

This rebuilds the Almanac as a self-contained component that owns its filter state and consumes `LookupResult` directly. We start with the header + filter checkboxes + month grouping; type rows and past-collapse come in Tasks 5 and 6.

- [ ] **Step 1: Replace `src/components/ScheduleAlmanac.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { LookupResult, ScheduleEntry, ScheduleType } from '../types';
import { SCHEDULE_YEAR } from '../types';
import { buildAlmanac } from '../lib/buildAlmanac';
import { generateICS, buildICSFilename } from '../lib/ics';
import { startOfDay, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  result: LookupResult;
}

const ALL_TYPES: ScheduleType[] = ['sweep', 'recycling', 'garbage'];
const TYPE_LABELS: Record<ScheduleType, string> = {
  sweep: 'Sweep',
  recycling: 'Recycling',
  garbage: 'Garbage',
};

interface MonthGroup {
  monthIdx: number; // 0-11
  label: string;
  entries: ScheduleEntry[];
}

const groupByMonth = (entries: ScheduleEntry[]): MonthGroup[] => {
  const groups: MonthGroup[] = [];
  for (let m = 0; m < 12; m++) {
    const monthEntries = entries.filter((e) => e.date.getMonth() === m);
    groups.push({
      monthIdx: m,
      label: monthName(new Date(SCHEDULE_YEAR, m, 1)),
      entries: monthEntries,
    });
  }
  return groups;
};

export const ScheduleAlmanac = ({ result }: Props) => {
  const [filter, setFilter] = useState<Set<ScheduleType>>(
    () => new Set<ScheduleType>(ALL_TYPES)
  );

  const allEntries = useMemo(() => buildAlmanac(result, SCHEDULE_YEAR), [result]);
  const filteredEntries = useMemo(
    () => allEntries.filter((e) => filter.has(e.type)),
    [allEntries, filter]
  );
  const months = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);
  const totalCount = filteredEntries.length;
  const monthCount = months.filter((m) => m.entries.length > 0).length;

  const toggle = (t: ScheduleType) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const handleDownload = () => {
    const url = generateICS(filteredEntries, filter, result.ward, result.section);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildICSFilename(filter, result.ward, result.section, SCHEDULE_YEAR);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <section className="px-5 mt-10 lg:px-8 lg:mt-12">
      {/* Header */}
      <header className="mb-4 lg:mb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5 lg:text-[11px] lg:tracking-[0.35em]">
              <ChicagoStar size={9} /> Section III
            </div>
            <h3 className="font-serif text-4xl mt-1 text-ink leading-none lg:text-6xl lg:mt-2">
              Full Almanac
            </h3>
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-ink-soft mt-2 lg:text-[10px] lg:tracking-[0.35em] lg:mt-3">
              {monthCount} months · {totalCount} dates
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="border-2 border-ink px-3 py-2 font-mono text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5 text-ink hover:bg-ink hover:text-cream transition-colors lg:px-5 lg:py-3 lg:text-[10px]"
            >
              <Printer size={11} strokeWidth={2.5} /> Print
            </button>
            <button
              onClick={handleDownload}
              className="border-2 border-ink px-3 py-2 font-mono text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5 text-ink hover:bg-ink hover:text-cream transition-colors lg:px-5 lg:py-3 lg:text-[10px]"
            >
              <Download size={11} strokeWidth={2.5} /> .ics
            </button>
          </div>
        </div>

        {/* Filter checkboxes */}
        <div className="flex flex-wrap items-center gap-2 mt-4 print:hidden">
          {ALL_TYPES.map((t) => {
            const on = filter.has(t);
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                aria-pressed={on}
                className={`border-2 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase flex items-center gap-1.5 transition-colors ${
                  on
                    ? 'bg-ink text-cream border-ink'
                    : 'border-ink/40 text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                <ChicagoStar
                  size={9}
                  className={on ? 'text-cream' : 'text-ink-soft'}
                />
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Top double-rule */}
      <div className="border-t-2 border-ink" />
      <div className="border-t border-ink mt-[2px] mb-5" />

      {filter.size === 0 && (
        <div className="font-serif italic text-ink-soft text-center py-8">
          <ChicagoStar size={11} className="text-chicago-red inline-block mr-2" />
          Pick at least one type to see your schedule.
        </div>
      )}

      {filter.size > 0 && (
        <div className="lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
          {months.map((month, gi) => (
            <div
              key={month.monthIdx}
              className={`mb-7 lg:mb-0 ${
                gi % 4 !== 0 ? 'lg:pl-5 lg:border-l lg:border-ink/30' : ''
              } print:break-inside-avoid`}
            >
              <div className="flex items-baseline gap-3 mb-3 lg:flex-col lg:items-start lg:gap-1 lg:mb-4">
                <h4 className="font-serif text-2xl text-ink leading-none lg:text-3xl">
                  {month.label}
                </h4>
                <span className="flex-1 border-b border-ink/40 mb-1 lg:hidden" />
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
                  {String(month.entries.length).padStart(2, '0')} dates
                </span>
                <span className="hidden lg:block w-full border-t-2 border-ink mt-2" />
              </div>

              {/* Type rows render in Task 5; placeholder list for now */}
              <div className="font-mono text-[10px] text-ink-soft">
                {month.entries.length === 0 ? '— no dates —' : `${month.entries.length} entries`}
              </div>
            </div>
          ))}
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

Expected: errors in `App.tsx` (passes wrong props — `dates` and `onDownload` instead of `result`). Task 7 fixes them.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScheduleAlmanac.tsx
git commit -m "feat(almanac): rebuild with filter checkboxes + Print/.ics buttons (skeleton)"
```

---

## Task 5: Type rows + date pills

**Files:**
- Modify: `src/components/ScheduleAlmanac.tsx`

Replace the placeholder `month.entries.length === 0 ? '— no dates —' : ...` body with three type rows containing compact date pills.

- [ ] **Step 1: Add helper imports + type-row constants near the top**

In `src/components/ScheduleAlmanac.tsx`, update the imports to include `daysFromToday`, `dayShort`, `monthShort`:

```tsx
import { startOfDay, monthName, daysFromToday, dayShort, monthShort } from '../lib/dates';
```

After the `groupByMonth` helper, add:

```tsx
const TYPE_KICKER_COLOR: Record<ScheduleType, string> = {
  sweep: 'text-chicago-red',
  recycling: 'text-chicago-blue',
  garbage: 'text-ink',
};

const SWEEP_OFF_SEASON_MONTHS = new Set([0, 1, 2, 11]); // Jan, Feb, Mar, Dec
```

- [ ] **Step 2: Add the date-pill render helper**

Add this component definition just below `groupByMonth` (still in the same file):

```tsx
interface PillProps {
  entry: ScheduleEntry;
  today: Date;
}

const DatePill = ({ entry, today }: PillProps) => {
  const isToday = daysFromToday(entry.date) === 0;
  const isPast = startOfDay(entry.date).getTime() < today.getTime();
  const accent = isToday ? 'border-2 border-chicago-red' : 'border border-ink';
  const opacity = isPast && entry.type !== 'sweep' ? 0.4 : 1;

  return (
    <div
      className={`inline-flex flex-col items-start min-w-[88px] px-2 py-1.5 ${accent} mr-2 mb-2`}
      style={{ opacity }}
    >
      <span className={`font-mono text-[9px] tracking-[0.2em] uppercase ${isToday ? 'text-chicago-red' : 'text-ink-soft'}`}>
        {dayShort(entry.date)}
      </span>
      <span className="font-serif text-[24px] leading-none text-ink tabular-nums">
        {entry.date.getDate()}
      </span>
      <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-ink-soft mt-0.5">
        {monthShort(entry.date)}
      </span>
      {entry.type === 'garbage' && entry.shiftedFrom && (
        <span className="font-mono italic text-[8px] text-chicago-red mt-1">
          (was {dayShort(entry.shiftedFrom.date)})
        </span>
      )}
      {entry.type === 'sweep' && isPast && (
        <span className="font-mono text-[7px] tracking-[0.2em] uppercase text-ink-soft border border-ink-soft px-1 mt-1 rotate-[-12deg] origin-left inline-block">
          Swept
        </span>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Replace the month-body placeholder with type rows**

In the `months.map(...)` JSX, replace the placeholder div:

```tsx
{/* Type rows render in Task 5; placeholder list for now */}
<div className="font-mono text-[10px] text-ink-soft">
  {month.entries.length === 0 ? '— no dates —' : `${month.entries.length} entries`}
</div>
```

with this:

```tsx
<div className="space-y-3">
  {ALL_TYPES.filter((t) => filter.has(t)).map((t) => {
    const typeEntries = month.entries.filter((e) => e.type === t);
    const isOffSeason =
      t === 'sweep' && SWEEP_OFF_SEASON_MONTHS.has(month.monthIdx);

    return (
      <div key={t}>
        <div className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5 ${TYPE_KICKER_COLOR[t]}`}>
          <ChicagoStar size={8} /> {TYPE_LABELS[t]}
        </div>
        {typeEntries.length === 0 ? (
          <div className="font-mono italic text-[10px] text-ink-soft pl-4">
            {isOffSeason ? '— off-season —' : '— none this month —'}
          </div>
        ) : (
          <div className="flex flex-wrap pl-4">
            {typeEntries.map((entry, i) => (
              <DatePill key={`${t}-${i}`} entry={entry} today={todayRef} />
            ))}
          </div>
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Memoize `today` for use in the render**

At the top of the `ScheduleAlmanac` body (just after the `useMemo` calls), add:

```tsx
const todayRef = useMemo(() => startOfDay(new Date()), []);
```

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/components/ScheduleAlmanac.tsx
git commit -m "feat(almanac): type rows per month with compact date pills + off-season placeholder"
```

(Will still typecheck-fail on App.tsx until Task 7. That's expected.)

---

## Task 6: Collapse fully-past months by default

**Files:**
- Modify: `src/components/ScheduleAlmanac.tsx`

A month is "fully past" when its last entry's date is before today. Render those as a single summary line by default with a single Show/Hide toggle that expands them all.

- [ ] **Step 1: Add the collapsed-summary helper and state**

At the top of the `ScheduleAlmanac` function body (with the other state hooks), add:

```tsx
const [showPast, setShowPast] = useState(false);
```

After `monthCount`, add:

```tsx
const isMonthFullyPast = (m: MonthGroup): boolean => {
  if (m.entries.length === 0) return false; // empty months don't count as past
  const last = m.entries[m.entries.length - 1].date;
  return startOfDay(last).getTime() < todayRef.getTime();
};

const pastMonths = months.filter(isMonthFullyPast);
const futureMonths = months.filter((m) => !isMonthFullyPast(m));
```

- [ ] **Step 2: Add the "Past months · N collected" toggle bar**

Just before the `<div className="lg:grid lg:grid-cols-4 ...">` that renders months, change the rendering so past and future are split. Replace:

```tsx
{filter.size > 0 && (
  <div className="lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
    {months.map((month, gi) => (
```

with:

```tsx
{filter.size > 0 && pastMonths.length > 0 && (
  <div className="mb-6 print:hidden">
    <button
      onClick={() => setShowPast((v) => !v)}
      className="w-full flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] uppercase text-ink-soft border-y border-ink/30 py-2 hover:bg-ink/5 transition-colors"
    >
      <ChicagoStar size={9} className="text-chicago-red" />
      <span>Past months · {pastMonths.length} collected</span>
      <span className="flex-1 border-t border-ink/20" />
      <span>{showPast ? 'Hide ▴' : 'Show ▾'}</span>
    </button>
  </div>
)}

{filter.size > 0 && pastMonths.length > 0 && !showPast && (
  <div className="space-y-1 mb-6 print:hidden">
    {pastMonths.map((month) => {
      const counts = ALL_TYPES.filter((t) => filter.has(t)).map((t) => {
        const n = month.entries.filter((e) => e.type === t).length;
        return n > 0 ? `${n} ${TYPE_LABELS[t].toLowerCase()}` : null;
      }).filter(Boolean) as string[];
      return (
        <div
          key={month.monthIdx}
          className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft flex items-center gap-2"
        >
          <ChicagoStar size={8} className="text-ink-soft" />
          <span className="font-serif italic text-[13px] tracking-normal text-ink normal-case">
            {month.label}
          </span>
          <span className="text-ink-soft">·</span>
          <span>{counts.join(' · ')}</span>
          <span className="text-ink-soft">· all swept</span>
        </div>
      );
    })}
  </div>
)}

{filter.size > 0 && (
  <div className="lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
    {(showPast ? months : futureMonths).map((month, gi) => (
```

(Keep the rest of the months.map body unchanged. Note: when expanded past months are shown, sweep entries inside them keep their "Swept" stamp via the existing `DatePill` logic.)

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/components/ScheduleAlmanac.tsx
git commit -m "feat(almanac): collapse fully-past months with Show/Hide toggle"
```

(App.tsx still typecheck-fails until Task 7.)

---

## Task 7: Wire `App.tsx` and remove `RoutinePickups` `.ics`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/RoutinePickups.tsx`

The Almanac is now self-contained, so we drop the old `handleDownload` / `handleRoutineDownload` handlers and the `onDownload` prop on RoutinePickups.

- [ ] **Step 1: Remove `onDownload` from `RoutinePickups`**

In `src/components/RoutinePickups.tsx`:

1. Update the `Props` interface — remove `onDownload`:

```tsx
interface Props {
  recycling: RecyclingInfo | null;
  garbage: GarbageInfo | null;
}
```

2. Update the destructure — remove `onDownload`:

```tsx
export const RoutinePickups = ({ recycling, garbage }: Props) => {
```

3. Remove the entire `Filed · routine.ics` button block at the bottom of the JSX. Find and delete:

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

- [ ] **Step 2: Update `App.tsx`**

In `src/App.tsx`:

1. Remove these imports:

```tsx
import { generateICS, generateRoutineICS } from './lib/ics';
import { SCHEDULE_YEAR } from './types';
```

(SCHEDULE_YEAR may still be needed elsewhere; remove only if unused. Check; keep if needed.)

2. Remove `handleDownload` and `handleRoutineDownload` entirely.

3. Update the `<RoutinePickups>` usage — drop `onDownload`:

```tsx
<RoutinePickups
  recycling={result.recycling}
  garbage={result.garbage}
/>
```

4. Update the `<ScheduleAlmanac>` usage — pass `result`:

```tsx
<ScheduleAlmanac result={result} />
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck
npm run build
```

Both must pass cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/RoutinePickups.tsx
git commit -m "refactor(app): wire self-contained Almanac, remove RoutinePickups onDownload"
```

---

## Task 8: Smoke verify the filterable almanac in the browser

**Files:** none modified — verification only.

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify against the canonical address**

Open `http://localhost:5173/`. Type `1819 S California Ave`. Pick the suggestion (or click Find). Verify:

1. **Default state:** All three filter chips are filled (selected). Section III shows ~12 months grouped, ~170 entries total. Past months should be collapsed at the top into a single "Past months · N collected" bar with `Show ▾`.
2. **Expand past months:** Click `Show ▾`. The collapsed bar's button changes to `Hide ▴`. Past months render with their full type-rows-per-month layout. Past sweep dates have the rotated "Swept" stamp; past garbage/recycling pills are dimmed.
3. **Toggle filters:** Click "Garbage" filter chip — chip outlines, all garbage rows disappear from every month, count line at top updates (e.g. `12 months · 42 dates`). Click again to restore.
4. **Off-season sweep:** Inside any expanded January / February / March / December block, the Sweep row reads `— off-season —` in italic mono.
5. **Holiday-shifted garbage:** Find July (or expand past months and check May). The Friday July 3 entry should show date "4" with `(was Fri)` in chicago-red italic. The pill's chicago-red border indicates the unusual date.
6. **`.ics` download:** Click `.ics` with all three on. File downloads as `chicago-schedule-W25S03-2026.ics`. Open it in a text editor — should contain ~170 VEVENT entries with `[SWEEP]`, `[RECYCLE]`, `[GARBAGE]` summaries.
7. **Filtered `.ics`:** Toggle off Sweep and Recycling. Click `.ics`. File downloads as `chicago-garbage-W25S03-2026.ics` and contains only garbage events.
8. **Print preview:** Click Print. The browser's native print preview should open. Verify visually:
   - Lookup form, saved chips, marginalia, HowItWorks all hidden.
   - Masthead, hero, routine pickups (no .ics button), filtered almanac, footnotes, footer all visible.
   - Background is white; ink is pure black.
   - Sweep type kicker shows `▮ SWEEP` (block prefix); chicago-red elements are now black + bolded.
   - Today's date pill has a thicker (3px) black border.
   - Page header at top of every page reads `THE SWEEP · 1819 S California Ave, Chicago · printed <today>`.

(Print-stylesheet items 8.4–8.7 fail until Task 9 ships. For now the print should at least look acceptable but won't have B&W enforcement.)

- [ ] **Step 3: Stop the dev server**

```bash
pkill -f "vite"
```

- [ ] **Step 4: Commit (verification milestone — no code change)**

If everything in Steps 1–7 above worked, no commit is needed for this task. Only commit if you found and fixed bugs.

---

## Task 9: Print stylesheet + running header

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx` (add `data-page-frame`, `data-page-grid`, `data-print-header` markers)

- [ ] **Step 1: Add the `@media print` block to `src/index.css`**

Append this at the end of the file:

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

  @page {
    size: letter;
    margin: 0.5in;
  }

  body {
    background: white !important;
    color: black !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .grain {
    background-image: none !important;
  }

  /* Hide screen-only chrome */
  [data-print-hide],
  [aria-label="Powered by Google"],
  .print\:hidden {
    display: none !important;
  }

  /* Collapse desktop broadsheet to single column on paper */
  [data-page-grid] {
    display: block !important;
  }

  [data-page-frame] {
    border: none !important;
    box-shadow: none !important;
    max-width: none !important;
  }

  /* Sweep urgency without color: bold + block prefix */
  [data-sweep-kicker]::before {
    content: '▮ ';
    font-weight: 800;
  }

  [data-sweep-kicker] [data-star] {
    display: none !important; /* hide the chicago star prefix on print since we use the block char */
  }

  [data-move-car-headline] {
    font-weight: 800 !important;
  }

  [data-move-car-headline]::before {
    content: '▮ ';
  }

  /* Today's pill stands out with a thicker border on B&W */
  [data-pill-today] {
    border-width: 3px !important;
  }

  /* Page-break behavior */
  [data-month-block] {
    break-inside: avoid;
  }

  /* Print-only running header */
  [data-print-header] {
    display: block !important;
    position: running(header);
    text-align: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8.5pt;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: black;
    border-bottom: 1px solid black;
    padding-bottom: 4pt;
    margin-bottom: 8pt;
  }

  @page {
    @top-center {
      content: element(header);
    }
  }
}
```

- [ ] **Step 2: Add the `data-page-frame` and `data-page-grid` markers in `App.tsx`**

In `src/App.tsx`, find the outer container divs and add `data-page-frame` to the broadsheet "page" wrapper, `data-page-grid` to the three-column body grid:

```tsx
return (
  <div className="min-h-screen grain bg-cream text-ink lg:py-8 lg:bg-cream-dark">
    <div
      data-page-frame
      className="max-w-xl mx-auto bg-cream lg:max-w-[1280px] lg:border-2 lg:border-ink lg:shadow-[0_2px_0_0_rgba(15,26,46,0.15)]"
    >
      <Masthead />
      <div data-page-grid className="lg:grid lg:grid-cols-[140px_minmax(0,1fr)_140px]">
        ...
```

- [ ] **Step 3: Add the print-only running header**

In `src/App.tsx`, just inside the `data-page-frame` div (before `<Masthead />`), add:

```tsx
<div
  data-print-header
  className="hidden"
>
  THE SWEEP · {result?.display ?? '—'} · printed {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
</div>
```

- [ ] **Step 4: Add `data-month-block` to each month in ScheduleAlmanac**

In `src/components/ScheduleAlmanac.tsx`, find the months.map div and add the data attribute:

```tsx
{(showPast ? months : futureMonths).map((month, gi) => (
  <div
    key={month.monthIdx}
    data-month-block
    className={`mb-7 lg:mb-0 ${
      gi % 4 !== 0 ? 'lg:pl-5 lg:border-l lg:border-ink/30' : ''
    }`}
  >
```

(Drop the existing `print:break-inside-avoid` Tailwind class — the data-attribute selector handles it now.)

- [ ] **Step 5: Add `data-sweep-kicker`, `data-star`, `data-move-car-headline`, `data-pill-today` markers**

In `src/components/ScheduleAlmanac.tsx`, the type-row kicker for sweep needs `data-sweep-kicker`:

```tsx
<div
  data-sweep-kicker={t === 'sweep' ? '' : undefined}
  className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5 flex items-center gap-1.5 ${TYPE_KICKER_COLOR[t]}`}
>
  <span data-star><ChicagoStar size={8} /></span> {TYPE_LABELS[t]}
</div>
```

In `DatePill`, add `data-pill-today` when `isToday`:

```tsx
<div
  data-pill-today={isToday ? '' : undefined}
  className={`inline-flex flex-col items-start min-w-[88px] px-2 py-1.5 ${accent} mr-2 mb-2`}
  style={{ opacity }}
>
```

In `src/components/NextSweepHero.tsx`, find the "Move your car." `<h3>` and add `data-move-car-headline`:

```tsx
<h3
  data-move-car-headline
  className={`font-serif italic leading-[1] ${isUrgent ? 'text-chicago-red' : 'text-ink'}`}
  style={{ fontSize: 'clamp(36px, 7.5vw, 76px)' }}
>
  Move your car.
</h3>
```

- [ ] **Step 6: Verify in print preview**

```bash
npm run dev
```

Open `http://localhost:5173/`, look up the canonical address, then trigger print preview (`Cmd+P` in Chrome). Expected:

1. Background pure white, ink pure black.
2. Lookup form, marginalia, HowItWorks, all-hover-tooltips, the Print/.ics buttons in the Almanac header, the filter chips, all hidden.
3. Sweep kicker reads `▮ SWEEP` (no star, with block prefix). Recycling and Garbage kickers read `RECYCLING` and `GARBAGE` (their stars are gone too because the print style hides `[data-star]` for sweep only — RG kickers keep their stars). Wait — re-check Step 1: the rule `[data-sweep-kicker] [data-star]` hides only the sweep star. Good.
4. "Move your car." headline is bold with `▮ ` prefix.
5. Today's date pill has a thicker border than other pills.
6. Page header at the top of every printed page: `THE SWEEP · 1819 S California Ave, Chicago · printed <today>`.
7. Months don't split across page breaks.

If anything fails, debug via DevTools' "Emulate CSS media type: print" toggle.

- [ ] **Step 7: Stop dev server and commit**

```bash
pkill -f "vite" 2>/dev/null
git add src/index.css src/App.tsx src/components/ScheduleAlmanac.tsx src/components/NextSweepHero.tsx
git commit -m "feat(print): @media print stylesheet — B&W broadsheet with running header"
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture data-flow diagram**

Find the "Promise.all (parallel after geocode + zone):" block in the Architecture section and add a note about `buildAlmanac` afterward:

After the Promise.all sub-diagram, before the closing UI line, insert:

```
                           ▼
                   buildAlmanac(result, year)
                   → ScheduleEntry[] for full year
                           ▼
   UI: Masthead + AddressInput + NextSweepHero (II.a)
       + RoutinePickups (II.b) + ScheduleAlmanac + Footnotes
```

- [ ] **Step 2: Update the file-structure tree**

In the `src/lib/` block, insert `buildAlmanac.ts` in alphabetical order:

```
    │   ├── address.ts
    │   ├── buildAlmanac.ts         # Pure full-year ScheduleEntry[] generator (consumed by Almanac + ICS)
    │   ├── dates.ts
```

In the `src/components/` block, replace the `ScheduleAlmanac.tsx` line:

```
    │   ├── ScheduleAlmanac.tsx     # Filterable + collapsible past, Print + unified .ics
```

- [ ] **Step 3: Update "Adding a new feature" common task**

Find the "Adding a new feature" subsection in Common tasks and add a fifth bullet:

```
5. If the feature involves new dates/events at the address, add them to `lib/buildAlmanac.ts` so they flow into both the Almanac UI and the unified `.ics` export.
```

- [ ] **Step 4: Move v4 to "Shipped" in the roadmap**

Find the `### Shipped` block and add a line after v3.5:

```
- **v4 — Filterable Almanac + Print.** Three-checkbox filter (Sweep/Recycling/Garbage), full-year view, type-rows per month, collapsed-past-months by default, B&W broadsheet print stylesheet.
```

- [ ] **Step 5: Verify and commit**

```bash
grep -n "buildAlmanac\|ScheduleEntry\|v4" CLAUDE.md
```

Expected: at least 4 matches.

```bash
git add CLAUDE.md
git commit -m "docs(claude): document v4 filterable almanac + print"
```

---

## Task 11: Push to live + deploy verification

**Files:** none modified — deployment only.

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```

Netlify auto-deploys (~90 seconds).

- [ ] **Step 2: Wait for the deploy and verify**

```bash
until curl -s https://sweep.amirabdurrahim.com/ 2>/dev/null | grep -oE 'src="/assets/index-[A-Za-z0-9_-]+\.js"' | head -1 | grep -qv "$(curl -s https://sweep.amirabdurrahim.com/?cb=$RANDOM | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)"; do
  sleep 10
done
echo "Deploy landed"
```

(Or just wait 2 minutes and reload the live site.)

- [ ] **Step 3: Smoke test on `sweep.amirabdurrahim.com`**

Open the live site on any device. Repeat the verification from Task 8 against the live URL. Confirm:
- Filter chips toggle correctly.
- Past months are collapsed by default.
- .ics download produces a valid `.ics` reflecting the filter.
- Browser print preview shows the B&W broadsheet.

- [ ] **Step 4: No commit needed (deploy verification only)**

If you spotted issues, fix them and re-push. Otherwise, this task is done.

---

## Self-review (author)

**Spec coverage:**
- `ScheduleEntry` discriminated union → Task 1.
- `buildAlmanac.ts` pure full-year generator with holiday shifts → Task 2.
- Unified `generateICS(entries, filter, ward, section)` + filename builder → Task 3.
- Filter checkboxes (default all on) + Print + .ics buttons in Almanac header → Task 4.
- Type-rows-per-month with compact pills, type kicker color coding, off-season placeholder, holiday-shift annotation → Task 5.
- Collapse fully-past months by default + Show/Hide toggle + collapsed summary line → Task 6.
- App.tsx wiring + remove RoutinePickups .ics button → Task 7.
- Browser smoke verification at canonical address → Task 8.
- `@media print` stylesheet (B&W vars override, page setup, page-break-avoid, running header, sweep urgency without color) → Task 9.
- CLAUDE.md update → Task 10.
- Live deploy verification → Task 11.

**Placeholder scan:** No "TBD"/"fill in details"/"add appropriate handling." All steps have concrete code or commands.

**Type consistency:**
- `ScheduleEntry` defined in Task 1, consumed in Tasks 2, 3, 4, 5 with the same shape.
- `ScheduleType` defined in Task 1, used as `Set<ScheduleType>` consistently across Tasks 3, 4, 5, 6.
- `buildAlmanac(result, year)` signature defined in Task 2, called identically in Task 4.
- `generateICS(entries, filter, ward, section)` and `buildICSFilename(filter, ward, section, year)` defined in Task 3, called identically in Task 4.
- `data-` attribute names (`data-page-frame`, `data-page-grid`, `data-month-block`, `data-sweep-kicker`, `data-star`, `data-pill-today`, `data-move-car-headline`, `data-print-header`) defined in Task 9 Step 1's CSS and used in the matching JSX edits in Steps 2–5. No drift.

**Build sequence sanity:** Task 3 introduces a typecheck failure (App.tsx still imports old function names), Task 4 introduces another (Almanac props change), Task 5 inherits both, Task 6 inherits both. Task 7 resolves them all. Tasks 8–11 should all typecheck cleanly. The plan acknowledges the in-progress typecheck-fail at each task and clears it at Task 7. An executor could squash Tasks 3+7 to keep typecheck green, but the diff stays cleaner reviewed independently.

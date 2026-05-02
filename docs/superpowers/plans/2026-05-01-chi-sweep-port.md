# The Sweep — v1 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the working `sweep_finder.jsx` prototype into a production Vite + React + TypeScript + Tailwind app structured per `CLAUDE.md`, with a Chicago-flag-incorporated visual direction and PWA install support.

**Architecture:** Static SPA with no backend. Three pure data-layer modules (`geocode`, `zones`, `schedule`) chained inside one `useLookup` hook, consumed by composed React components. Tokens live as CSS variables in `index.css` and are surfaced through Tailwind's `theme.extend.colors`. PWA via `vite-plugin-pwa`.

**Tech Stack:** Vite 5, React 18, TypeScript (strict), Tailwind CSS 3, lucide-react, vite-plugin-pwa, Netlify hosting.

**Spec:** `docs/superpowers/specs/2026-05-01-chi-sweep-port-design.md`

**Reference source:** `sweep_finder.jsx` (root of repo). Will be renamed to `sweep_finder.reference.jsx` in Task 1 and deleted in Task 16 once parity is confirmed.

**Note on testing:** Per the approved spec, v1 ships with no automated tests. Verification is manual against the canonical address `1819 S California Ave, Chicago` → Ward `25` § `04`. Each task ends with a manual verification step + commit.

**Working directory:** All paths are relative to `/Users/amirabdurrahim/repos/chi-street-sweep/`.

## Deviations recorded during execution

These were resolved during Task 1 and are codified here so later tasks don't trip on them.

- **Vite pinned to `^7`** (not the latest `^8`). Reason: `vite-plugin-pwa@1.2.0` (used in Task 18) peer-deps to Vite 7. Picking Vite 8 would force a vite-plugin-pwa downgrade.
- **`tsconfig.json` is consolidated** — no `references` field, no separate `tsconfig.app.json`. Reason: project references require `composite: true` and `noEmit: false` on the referenced project, which conflicts with our `noEmit: true` in `tsc && vite build`. `tsconfig.node.json` exists and Vite consults it internally for the config file's own typing.
- **React types pinned to `^18`** to match React 18 (Vite 8's scaffold defaults to React 19 types).
- **`npm audit` reports 4 high-severity vulns** in `serialize-javascript` (transitive via `workbox-build` → `@rollup/plugin-terser`). Build-time only, no runtime exposure. Acknowledged; do not "fix" by downgrading `vite-plugin-pwa`.
- **Future scaffolding warning:** modern `create-vite` replaced `--force` with `--overwrite`, which **deletes** existing files instead of just bypassing the prompt. Task 1's `npm create vite@latest .` deleted `CLAUDE.md`, `docs/`, and the renamed prototype before we caught it. All four were recovered (CLAUDE.md from session reminder, prototype from `~/Downloads`, spec/plan from `~/.claude/file-history/` snapshots) and verified intact. If re-scaffolding is ever needed, scaffold to a temp dir and `rsync` into the project.

---

## Task 1: Scaffold Vite + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `.gitignore`, `postcss.config.js`, `tailwind.config.ts`, `netlify.toml`
- Rename: `sweep_finder.jsx` → `sweep_finder.reference.jsx`

- [ ] **Step 1: Rename the prototype out of the way**

```bash
mv sweep_finder.jsx sweep_finder.reference.jsx
```

This keeps the prototype as a reference during the port without colliding with Vite's scaffolding.

- [ ] **Step 2: Scaffold Vite into the current directory**

```bash
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty… Ignore files and continue?" select **Ignore files and continue** (or pass `--force`). This keeps `CLAUDE.md`, `docs/`, and `sweep_finder.reference.jsx` intact.

- [ ] **Step 3: Install runtime dependencies**

```bash
npm install react@^18 react-dom@^18 lucide-react
```

- [ ] **Step 4: Install dev dependencies**

```bash
npm install -D tailwindcss@^3 postcss autoprefixer vite-plugin-pwa workbox-window
```

- [ ] **Step 5: Initialize Tailwind**

```bash
npx tailwindcss init -p
```

This creates `tailwind.config.js` and `postcss.config.js`. Rename the Tailwind config to TypeScript:

```bash
mv tailwind.config.js tailwind.config.ts
```

- [ ] **Step 6: Replace `tailwind.config.ts` with the project's color theme**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        'cream-dark': 'var(--cream-dark)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'chicago-red': 'var(--chicago-red)',
        'red-deep': 'var(--red-deep)',
        'chicago-blue': 'var(--chicago-blue)',
        'blue-deep': 'var(--blue-deep)',
        rule: 'var(--rule)',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 7: Tighten `tsconfig.json` to strict mode**

Open `tsconfig.json` (created by Vite) and ensure these compiler options are present (Vite's template ships strict on, but verify):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json` exists separately for Vite's own config typing but is not declared as a project reference (see "Deviations recorded during execution" above).

- [ ] **Step 8: Add the typecheck npm script**

In `package.json`, add `"typecheck": "tsc --noEmit"` to the `scripts` block. Final scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 9: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 10: Verify the scaffold builds and serves**

```bash
npm run build
```

Expected: build succeeds, `dist/` is created.

```bash
npm run dev
```

Expected: dev server starts on `http://localhost:5173`. Open it in a browser; you should see the default Vite + React starter page. Stop the server (`Ctrl+C`) when verified.

- [ ] **Step 11: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind project"
```

---

## Task 2: Tokens, fonts, and global CSS

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`

- [ ] **Step 1: Replace `src/index.css` with the token system + font import + base styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --cream:        #F1E9D2;
  --cream-dark:   #E8DFC4;
  --ink:          #0F1A2E;
  --ink-soft:     #1A2540;
  --chicago-red:  #C8102E;
  --red-deep:     #8A2828;
  --chicago-blue: #41B6E6;
  --blue-deep:    #2E8AB5;
  --rule:         #1A2540;
}

@layer base {
  body {
    font-family: 'IBM Plex Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
    background: var(--cream);
    color: var(--ink);
  }
}

@layer utilities {
  .grain {
    background-image:
      radial-gradient(rgba(26,37,64,0.04) 1px, transparent 1px),
      radial-gradient(rgba(200,16,46,0.03) 1px, transparent 1px);
    background-size: 3px 3px, 7px 7px;
    background-position: 0 0, 1px 2px;
  }
  .pulse-dot { animation: pulseDot 1.6s ease-in-out infinite; }
  .slide-up { animation: slideUp 0.5s ease-out forwards; }
}

@keyframes pulseDot {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Update `index.html` `<title>` and `<meta>`**

Open `index.html` and replace the `<title>` line and add a meta description:

```html
<title>The Sweep — Chicago Street Sweeping Almanac</title>
<meta name="description" content="Find your Chicago street sweeping schedule by address. Never miss a $60 ticket again." />
<meta name="theme-color" content="#F1E9D2" />
```

- [ ] **Step 3: Verify tokens compile**

Replace the body of `src/App.tsx` with a sanity-check render:

```tsx
import './index.css';

export default function App() {
  return (
    <div className="min-h-screen bg-cream text-ink p-8 grain">
      <h1 className="font-serif text-5xl">The Sweep</h1>
      <p className="font-sans">Body in IBM Plex Sans.</p>
      <p className="font-mono text-chicago-red">Mono accent in chicago-red.</p>
      <p className="font-mono text-chicago-blue">Mono accent in chicago-blue.</p>
    </div>
  );
}
```

```bash
npm run dev
```

Expected: cream background, navy serif heading, two mono lines in the new red and blue token colors, fonts visibly load (no Times/Arial fallback). Stop the server when verified.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add design tokens, fonts, and global styles"
```

---

## Task 3: Type definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

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

export interface LookupResult {
  ward: string;
  section: string;
  dates: SweepDate[];
  display: string;
  coords: { lat: number; lon: number };
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
```

- [ ] **Step 2: Verify it typechecks**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add type definitions and dataset constants"
```

---

## Task 4: Pure date helpers (`lib/dates.ts`)

**Files:**
- Create: `src/lib/dates.ts`

- [ ] **Step 1: Create `src/lib/dates.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/dates.ts
git commit -m "feat: add lib/dates date helpers"
```

---

## Task 5: Address cleaner (`lib/address.ts`)

**Files:**
- Create: `src/lib/address.ts`

- [ ] **Step 1: Create `src/lib/address.ts`**

```ts
/**
 * Strip apartment/unit/suite/floor markers, ZIP codes, and trailing ", Chicago, IL".
 * Geocoders choke on these; we re-append the city context ourselves.
 */
export const cleanAddress = (raw: string): string => {
  let s = raw.trim();
  s = s.replace(
    /,?\s*(apt|apartment|unit|suite|ste|#|floor|fl|rm|room|bldg)\.?\s*[\w-]+/gi,
    ''
  );
  s = s.replace(/\b\d{5}(-\d{4})?\b/g, '');
  s = s.replace(/,?\s*chicago\s*,?\s*(il|illinois)?/gi, '');
  s = s.replace(/,?\s*(il|illinois)\b/gi, '');
  s = s.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,|,\s*$/g, '').trim();
  return s;
};
```

- [ ] **Step 2: Quick manual sanity check in dev**

Temporarily add to `src/App.tsx` (above the existing component):

```tsx
import { cleanAddress } from './lib/address';
console.log(cleanAddress('1819 S. California Ave, APT BST, Chicago, IL 60608'));
// Expected: "1819 S. California Ave"
```

```bash
npm run dev
```

Open the page, check the browser console for `1819 S. California Ave`. Remove the temporary lines from `App.tsx` after verifying.

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/address.ts src/App.tsx
git commit -m "feat: add lib/address cleaner"
```

---

## Task 6: Geocoder chain (`lib/geocode.ts`)

**Files:**
- Create: `src/lib/geocode.ts`

- [ ] **Step 1: Create `src/lib/geocode.ts`**

```ts
import type { GeocodeResult } from '../types';
import { cleanAddress } from './address';

/** Primary: U.S. Census Geocoder — free, no rate limits, designed for U.S. addresses. */
const geocodeCensus = async (cleaned: string): Promise<GeocodeResult | null> => {
  const full = `${cleaned}, Chicago, IL`;
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(full)}&benchmark=Public_AR_Current&format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Census geocoder unreachable');
  const data = await resp.json();
  const matches = data?.result?.addressMatches ?? [];
  if (!matches.length) return null;
  const m = matches[0];
  return {
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    display: m.matchedAddress,
  };
};

/** Fallback: Nominatim (OpenStreetMap). Rate-limited; throws "Load failed" with no body when blocked. */
const geocodeNominatim = async (cleaned: string): Promise<GeocodeResult | null> => {
  const queries = [`${cleaned}, Chicago, IL`, `${cleaned}, Chicago, Illinois`, cleaned];
  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=us&addressdetails=1`;
    let resp: Response;
    try {
      resp = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      continue;
    }
    if (!resp.ok) continue;
    const results = (await resp.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { city?: string; town?: string; village?: string; county?: string };
    }>;
    if (!results || results.length === 0) continue;
    const match =
      results.find((r) => {
        const city = (r.address?.city || r.address?.town || r.address?.village || '').toLowerCase();
        const county = (r.address?.county || '').toLowerCase();
        return city.includes('chicago') || county.includes('cook');
      }) ?? results[0];
    return {
      lat: parseFloat(match.lat),
      lon: parseFloat(match.lon),
      display: match.display_name,
    };
  }
  return null;
};

export const geocode = async (rawAddress: string): Promise<GeocodeResult> => {
  const cleaned = cleanAddress(rawAddress);
  if (!cleaned) throw new Error('Please enter a street address.');

  const providers = [geocodeCensus, geocodeNominatim];
  let networkFailures = 0;
  for (const fn of providers) {
    try {
      const result = await fn(cleaned);
      if (result) return result;
    } catch {
      networkFailures++;
    }
  }
  if (networkFailures === providers.length) {
    throw new Error(
      "Address lookup services aren't responding. Check your connection and try again, or tap \"Use current location\" instead."
    );
  }
  throw new Error(
    `Couldn't find "${cleaned}". Try just the street number and street name (e.g. "1819 S California Ave"). Skip apartment numbers and ZIP.`
  );
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/geocode.ts
git commit -m "feat: add lib/geocode with Census→Nominatim fallback chain"
```

---

## Task 7: Zone lookup (`lib/zones.ts`)

**Files:**
- Create: `src/lib/zones.ts`

- [ ] **Step 1: Create `src/lib/zones.ts`**

```ts
import type { ZoneInfo } from '../types';
import { ZONES_DATASET_ID_CURRENT, ZONES_DATASET_ID_FALLBACK } from '../types';

const BASE = 'https://data.cityofchicago.org/resource';

interface ZoneRow {
  ward: string;
  section: string;
}

const fetchZone = async (datasetId: string, lon: number, lat: number): Promise<ZoneRow | null> => {
  const point = `POINT(${lon} ${lat})`;
  const url = `${BASE}/${datasetId}.json?$where=intersects(the_geom,'${point}')&$limit=1`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = (await resp.json()) as ZoneRow[];
  return data.length ? data[0] : null;
};

export const lookupZone = async (lat: number, lon: number): Promise<ZoneInfo> => {
  let row = await fetchZone(ZONES_DATASET_ID_CURRENT, lon, lat);
  if (!row) row = await fetchZone(ZONES_DATASET_ID_FALLBACK, lon, lat);
  if (!row) throw new Error("That address isn't inside a Chicago street sweeping zone.");
  return {
    ward: String(row.ward).padStart(2, '0'),
    section: String(row.section).padStart(2, '0'),
  };
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/zones.ts
git commit -m "feat: add lib/zones with 2026→2025 dataset fallback"
```

---

## Task 8: Schedule fetcher (`lib/schedule.ts`)

**Files:**
- Create: `src/lib/schedule.ts`

- [ ] **Step 1: Create `src/lib/schedule.ts`**

```ts
import type { SweepDate, Side } from '../types';
import { SCHEDULE_YEAR, SCHEDULE_DATASET_ID } from '../types';

interface ScheduleRow {
  ward_section_concatenated: string;
  ward: string;
  section: string;
  month_name: string;
  month_number: string;
  dates: string;
}

export const fetchSchedule = async (ward: string, section: string): Promise<SweepDate[]> => {
  const url = `https://data.cityofchicago.org/resource/${SCHEDULE_DATASET_ID}.json?ward=${ward}&section=${section}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Schedule service is unavailable. Try again in a moment.');
  const rows = (await resp.json()) as ScheduleRow[];

  const dates: SweepDate[] = [];
  rows.forEach((row) => {
    const month = parseInt(row.month_number, 10);
    const days = String(row.dates)
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    days.forEach((day, idx) => {
      const sideLabel: Side = idx === 0 ? 'A' : 'B';
      const pairIdx = (idx === 0 ? 0 : 1) as 0 | 1;
      dates.push({
        date: new Date(SCHEDULE_YEAR, month - 1, day),
        sideLabel,
        pairIdx,
      });
    });
  });
  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return dates;
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/schedule.ts
git commit -m "feat: add lib/schedule fetcher"
```

---

## Task 9: ICS calendar export (`lib/ics.ts`)

**Files:**
- Create: `src/lib/ics.ts`

- [ ] **Step 1: Create `src/lib/ics.ts`**

```ts
import type { SweepDate } from '../types';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export const generateICS = (dates: SweepDate[], ward: string, section: string): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chicago Sweep//EN',
    'CALSCALE:GREGORIAN',
  ];
  dates.forEach((entry, i) => {
    const d = entry.date;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:sweep-${ward}-${section}-${i}-${fmtICS(d)}@chicago-sweep`,
      `DTSTAMP:${fmtICS(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${fmtICS(d)}`,
      `DTEND;VALUE=DATE:${fmtICS(next)}`,
      `SUMMARY:MOVE CAR — Street sweeping (Ward ${ward} §${section})`,
      `DESCRIPTION:Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Move car — street sweeping tomorrow',
      'END:VALARM',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/ics.ts
git commit -m "feat: add lib/ics calendar export"
```

---

## Task 10: End-to-end smoke test of the data layer

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx` with a temporary smoke harness**

```tsx
import { useState } from 'react';
import { geocode } from './lib/geocode';
import { lookupZone } from './lib/zones';
import { fetchSchedule } from './lib/schedule';
import './index.css';

export default function App() {
  const [out, setOut] = useState<string>('');

  const run = async () => {
    setOut('Running…');
    try {
      const g = await geocode('1819 S California Ave');
      const z = await lookupZone(g.lat, g.lon);
      const s = await fetchSchedule(z.ward, z.section);
      setOut(
        JSON.stringify(
          { geocode: g, zone: z, scheduleCount: s.length, first: s[0], last: s[s.length - 1] },
          null,
          2
        )
      );
    } catch (e) {
      setOut(`ERROR: ${(e as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink p-8 font-mono text-sm">
      <button
        className="bg-ink text-cream px-4 py-2 mb-4"
        onClick={() => void run()}
      >
        Run smoke test
      </button>
      <pre className="whitespace-pre-wrap">{out}</pre>
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and verify the canonical address**

```bash
npm run dev
```

Open `http://localhost:5173`, click **Run smoke test**, and verify the output:
- `geocode.lat` ≈ `41.857`, `geocode.lon` ≈ `-87.694`
- `zone.ward` = `"25"`, `zone.section` = `"04"`
- `scheduleCount` > 0 (typically 14–20 dates)
- `first.date` is in April or May 2026
- `last.date` is in October or November 2026

If anything is off, debug the relevant `lib/*` file before continuing. Stop the dev server when verified.

- [ ] **Step 3: Commit (data layer milestone)**

```bash
git add src/App.tsx
git commit -m "chore: smoke-test data layer end-to-end against canonical address"
```

---

## Task 11: `useLookup` hook

**Files:**
- Create: `src/hooks/useLookup.ts`

- [ ] **Step 1: Create `src/hooks/useLookup.ts`**

```ts
import { useCallback, useState } from 'react';
import type { LookupStatus, LookupResult } from '../types';
import { geocode } from '../lib/geocode';
import { lookupZone } from '../lib/zones';
import { fetchSchedule } from '../lib/schedule';

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
        const zone = await lookupZone(coords.lat, coords.lon);
        const dates = await fetchSchedule(zone.ward, zone.section);
        setStatus({
          kind: 'done',
          result: {
            ward: zone.ward,
            section: zone.section,
            dates,
            display,
            coords,
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

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/hooks/useLookup.ts
git commit -m "feat: add useLookup hook orchestrating geocode → zone → schedule"
```

---

## Task 12: Minimal functional App (functional milestone)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx` with a minimal functional UI**

```tsx
import { useState } from 'react';
import { useLookup } from './hooks/useLookup';
import './index.css';

export default function App() {
  const [address, setAddress] = useState('');
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, startLocating } = useLookup();

  const handleLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude),
      () => void 0,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-cream text-ink p-6 font-mono text-sm max-w-xl mx-auto">
      <h1 className="font-serif text-4xl mb-4">The Sweep (dev)</h1>
      <input
        className="border border-ink p-2 w-full mb-2 bg-transparent"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="1819 S California Ave"
      />
      <div className="flex gap-2 mb-4">
        <button className="bg-ink text-cream px-3 py-1" onClick={() => void lookup(address)} disabled={isLoading}>
          {isLoading ? 'Searching…' : 'Find schedule'}
        </button>
        <button className="border border-ink px-3 py-1" onClick={handleLocation} disabled={isLocating}>
          {isLocating ? 'Locating…' : 'Use location'}
        </button>
      </div>
      {error && <pre className="text-chicago-red whitespace-pre-wrap">{error}</pre>}
      {result && (
        <pre className="whitespace-pre-wrap">
          {`Ward ${result.ward} § ${result.section} — ${result.display}\n` +
            result.dates
              .map((d) => `${d.date.toDateString()} (Side ${d.sideLabel})`)
              .join('\n')}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the full chain works in the browser**

```bash
npm run dev
```

Open `http://localhost:5173`. Type `1819 S California Ave`, click **Find schedule**. Expected: ward `25`, section `04`, list of dates. Try **Use location** (allow permission). Try a malformed address (e.g. `asdf`) and verify the error renders. Stop the server when verified.

- [ ] **Step 3: Commit (functional milestone)**

```bash
git add src/App.tsx
git commit -m "feat: minimal functional App with useLookup wiring"
```

---

## Task 13: `ChicagoStar` SVG primitive

**Files:**
- Create: `src/components/ChicagoStar.tsx`

The Chicago flag's six-pointed star. Six points at 60° spacing, with concave inner notches. Drawn as a 12-vertex polygon: alternating outer (point) and inner (notch) radii.

- [ ] **Step 1: Create `src/components/ChicagoStar.tsx`**

```tsx
interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Chicago flag's six-pointed star.
 * 12 vertices: 6 outer points at radius 1.0, 6 inner notches at radius ~0.38.
 * Outer points start at the top (-90°) and step every 60°.
 * Inner notches sit between, offset by 30°.
 */
const buildPath = (): string => {
  const outer = 1;
  const inner = 0.38;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (-90 + i * 30) * (Math.PI / 180);
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ') + ' Z';
};

const PATH = buildPath();

export const ChicagoStar = ({ size = 20, className, title }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="-1.1 -1.1 2.2 2.2"
    className={className}
    fill="currentColor"
    role={title ? 'img' : 'presentation'}
    aria-label={title}
  >
    <path d={PATH} />
  </svg>
);
```

- [ ] **Step 2: Sanity check the rendering**

Temporarily replace `src/App.tsx`:

```tsx
import { ChicagoStar } from './components/ChicagoStar';
import './index.css';

export default function App() {
  return (
    <div className="min-h-screen bg-cream text-ink p-8 flex gap-4 items-center">
      <ChicagoStar size={48} className="text-chicago-red" />
      <ChicagoStar size={32} className="text-chicago-red" />
      <ChicagoStar size={20} className="text-chicago-red" />
      <ChicagoStar size={12} className="text-chicago-red" />
    </div>
  );
}
```

```bash
npm run dev
```

Expected: four red six-pointed Chicago stars on cream background, decreasing in size. They should look distinctly six-pointed (not five-point/sheriff's badge, not generic asterisk) with clear concave notches between points. Stop the server when verified.

- [ ] **Step 3: Restore the minimal App from Task 12 and commit**

Revert `src/App.tsx` to the Task 12 version (the minimal functional UI).

```bash
git add src/App.tsx src/components/ChicagoStar.tsx
git commit -m "feat: add ChicagoStar six-pointed SVG primitive"
```

---

## Task 14: Port presentational components (parity pass)

This task ports each JSX component into its own file, replacing inline `style={{ color: C.ink }}` with Tailwind classes (`text-ink`), replacing `✦` with `<ChicagoStar />`, and updating the flag stripe + token usages to the new palette. The visual goal is **parity with the JSX** but with the new tokens — the creative leap happens in Task 15.

**Files (all created):**
- `src/components/Masthead.tsx`
- `src/components/AddressInput.tsx`
- `src/components/ErrorPanel.tsx`
- `src/components/NextSweepHero.tsx`
- `src/components/ScheduleAlmanac.tsx`
- `src/components/Footnotes.tsx`
- `src/components/HowItWorks.tsx`

Reference the prototype at `sweep_finder.reference.jsx` while porting each. Source JSX line ranges noted per step.

- [ ] **Step 1: Create `src/components/Masthead.tsx`**

(Source: `sweep_finder.reference.jsx:199-233`. Flag stripe colors updated; `⬩` decorative chars kept.)

```tsx
import { SCHEDULE_YEAR } from '../types';
import { ChicagoStar } from './ChicagoStar';

export const Masthead = () => (
  <header className="border-b border-rule">
    {/* Authentic flag stripe: cream–blue–cream–blue–cream */}
    <div className="flex h-1.5">
      <div className="flex-1 bg-cream" />
      <div className="flex-1 bg-chicago-blue" />
      <div className="flex-1 bg-cream" />
      <div className="flex-1 bg-chicago-blue" />
      <div className="flex-1 bg-cream" />
    </div>
    <div className="px-5 py-3 flex items-center justify-between border-t border-b border-rule">
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink">
        Vol. {SCHEDULE_YEAR} · No. 1
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink">
        Apr — Nov
      </div>
    </div>
    <div className="px-5 pt-6 pb-5 text-center">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2 text-chicago-red flex items-center justify-center gap-2">
        <ChicagoStar size={10} /> Chicago Department of Streets <ChicagoStar size={10} />
      </div>
      <h1 className="font-serif leading-[0.92] tracking-tight text-ink" style={{ fontSize: 'clamp(38px, 11vw, 56px)' }}>
        The Sweep
      </h1>
      <h2 className="font-serif italic mt-1 text-chicago-blue" style={{ fontSize: 'clamp(15px, 4vw, 19px)' }}>
        Registry & Almanac
      </h2>
      <div className="mt-4 mx-auto w-16 border-t-2 border-ink" />
      <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto text-ink-soft">
        Find your sweeping schedule by address. Never miss a $60 ticket again.
      </p>
    </div>
  </header>
);
```

- [ ] **Step 2: Create `src/components/AddressInput.tsx`**

(Source: `sweep_finder.reference.jsx:235-275`. Renamed from `InputCard` per spec. Star markers replace `✦`.)

```tsx
import { Loader2, Search, Navigation, ArrowRight } from 'lucide-react';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  address: string;
  setAddress: (v: string) => void;
  onLookup: () => void;
  onUseLocation: () => void;
  loading: boolean;
  locating: boolean;
}

export const AddressInput = ({ address, setAddress, onLookup, onUseLocation, loading, locating }: Props) => (
  <div className="px-5 pt-6">
    <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-red flex items-center gap-1.5">
      <ChicagoStar size={9} /> Section I — Lookup
    </div>
    <div className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase mb-2 text-ink-soft">
        Your address
      </label>
      <div className="flex items-center border-b-2 border-ink pb-2">
        <Search size={16} className="mr-2 shrink-0 text-ink-soft" />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLookup()}
          placeholder="1819 S California Ave"
          className="flex-1 bg-transparent outline-none font-serif text-xl text-ink placeholder:opacity-40"
          autoComplete="street-address"
        />
      </div>
      <button
        onClick={onLookup}
        disabled={loading || !address.trim()}
        className="mt-4 w-full py-3.5 font-mono text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 transition disabled:opacity-40 bg-ink text-cream"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> Searching</>
        ) : (
          <>Find my schedule <ArrowRight size={14} /></>
        )}
      </button>
      <button
        onClick={onUseLocation}
        disabled={locating || loading}
        className="mt-2 w-full py-2.5 border border-ink font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 text-ink"
      >
        {locating ? (
          <><Loader2 size={12} className="animate-spin" /> Locating</>
        ) : (
          <><Navigation size={12} /> Use current location</>
        )}
      </button>
    </div>
  </div>
);
```

- [ ] **Step 3: Create `src/components/ErrorPanel.tsx`**

(Source: `sweep_finder.reference.jsx:277-288`.)

```tsx
import { AlertTriangle } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export const ErrorPanel = ({ message, onDismiss }: Props) => (
  <div className="mx-5 mt-4 border-2 border-chicago-red p-4 slide-up" style={{ background: '#FAEBEB' }}>
    <div className="flex items-start gap-3">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-chicago-red" />
      <div className="flex-1">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1 text-chicago-red">
          Couldn't find it
        </div>
        <div className="text-sm leading-relaxed text-ink">{message}</div>
      </div>
      <button onClick={onDismiss} className="font-mono text-xs px-2 text-chicago-red">✕</button>
    </div>
  </div>
);
```

- [ ] **Step 4: Create `src/components/NextSweepHero.tsx`**

(Source: `sweep_finder.reference.jsx:290-346`. Green replaced with chicago-blue for the calm/non-urgent state.)

```tsx
import type { SweepDate } from '../types';
import { SCHEDULE_YEAR } from '../types';
import { daysFromToday, dayOfWeek, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  next: SweepDate | null;
  ward: string;
  section: string;
}

export const NextSweepHero = ({ next, ward, section }: Props) => {
  if (!next) {
    return (
      <div className="mx-5 mt-6 border-2 border-chicago-blue p-6 text-center" style={{ background: '#E5F4FB' }}>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-blue">
          Season Concluded
        </div>
        <p className="font-serif text-2xl mt-2 text-ink">No more sweeps this year.</p>
        <p className="text-sm mt-1 text-ink-soft">Schedule resumes April {SCHEDULE_YEAR + 1}.</p>
      </div>
    );
  }
  const days = daysFromToday(next.date);
  const isUrgent = days <= 2;
  const accentClass = isUrgent ? 'text-chicago-red' : 'text-chicago-blue';
  const accentBorderClass = isUrgent ? 'border-chicago-red' : 'border-chicago-blue';
  const bg = isUrgent ? '#FAEBEB' : '#E5F4FB';
  const headline =
    days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : days < 0 ? `${Math.abs(days)} days ago` : `In ${days} days`;

  return (
    <div className="mx-5 mt-6 slide-up">
      <div className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 ${accentClass}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full pulse-dot ${isUrgent ? 'bg-chicago-red' : 'bg-chicago-blue'}`} />
        <ChicagoStar size={9} /> Section II — Your Next Sweep
      </div>
      <div className={`border-2 border-ink relative overflow-hidden ${accentBorderClass.replace('border-', 'shadow-')}`} style={{ background: bg }}>
        <div className="absolute top-2 left-2 font-mono text-[9px] text-ink">◢</div>
        <div className="absolute top-2 right-2 font-mono text-[9px] text-ink">◣</div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px] text-ink">◥</div>
        <div className="absolute bottom-2 right-2 font-mono text-[9px] text-ink">◤</div>

        <div className="px-5 py-7 text-center">
          <div className={`font-mono text-[10px] tracking-[0.3em] uppercase ${accentClass}`}>
            {isUrgent && '⚠ '}Move your car{isUrgent && ' ⚠'}
          </div>
          <div className="font-serif mt-3 leading-[0.95] text-ink" style={{ fontSize: 'clamp(48px, 14vw, 76px)' }}>
            {headline}
          </div>
          <div className="font-serif italic mt-1 text-ink-soft" style={{ fontSize: 'clamp(18px, 5vw, 22px)' }}>
            {dayOfWeek(next.date)}, {monthName(next.date)} {next.date.getDate()}
          </div>

          <div className="my-5 mx-auto w-12 border-t border-ink" />

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 text-ink">Ward</div>
              <div className="font-serif text-3xl text-ink">{ward}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 text-ink">Section</div>
              <div className="font-serif text-3xl text-ink">{section}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Create `src/components/ScheduleAlmanac.tsx`**

(Source: `sweep_finder.reference.jsx:348-424`. Star markers replace `✦`.)

```tsx
import { useMemo } from 'react';
import { Download } from 'lucide-react';
import type { SweepDate } from '../types';
import { startOfDay, daysFromToday, dayShort, monthShort, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  dates: SweepDate[];
  onDownload: () => void;
}

export const ScheduleAlmanac = ({ dates, onDownload }: Props) => {
  const today = startOfDay(new Date());

  const grouped = useMemo(() => {
    const g: Record<string, { label: string; entries: SweepDate[] }> = {};
    dates.forEach((d) => {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!g[key]) g[key] = { label: monthName(d.date), entries: [] };
      g[key].entries.push(d);
    });
    return Object.values(g);
  }, [dates]);

  return (
    <div className="px-5 mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
            <ChicagoStar size={9} /> Section III
          </div>
          <h3 className="font-serif text-3xl mt-1 text-ink">Full Almanac</h3>
        </div>
        <button
          onClick={onDownload}
          className="border border-ink px-3 py-2 font-mono text-[9px] tracking-[0.2em] uppercase flex items-center gap-1.5 text-ink"
        >
          <Download size={11} /> .ics
        </button>
      </div>
      <div className="border-t-2 border-ink pt-4">
        {grouped.map((group, gi) => (
          <div key={gi} className="mb-6">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 text-ink-soft">
              <span>{group.label}</span>
              <span className="flex-1 border-t border-ink-soft opacity-30" />
              <span>{group.entries.length} dates</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.entries.map((entry, ei) => {
                const isPast = startOfDay(entry.date) < today;
                const isToday = daysFromToday(entry.date) === 0;
                const borderClass = isToday ? 'border-2 border-chicago-red' : 'border border-ink';
                const bg = isToday ? '#FAEBEB' : isPast ? 'transparent' : '#FAF4E0';
                return (
                  <div
                    key={ei}
                    className={`p-3 relative ${borderClass}`}
                    style={{ background: bg, opacity: isPast ? 0.4 : 1 }}
                  >
                    <div className="absolute top-1 right-1.5 font-mono text-[8px] tracking-wider opacity-50 text-ink">
                      Side {entry.sideLabel}
                    </div>
                    <div className={`font-mono text-[9px] tracking-[0.2em] uppercase ${isToday ? 'text-chicago-red' : 'text-ink-soft'}`}>
                      {dayShort(entry.date)}
                    </div>
                    <div className="font-serif text-3xl leading-none mt-0.5 text-ink">
                      {entry.date.getDate()}
                    </div>
                    <div className="font-mono text-[9px] uppercase mt-1 opacity-60 text-ink">
                      {monthShort(entry.date)}
                    </div>
                    {isPast && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono text-[8px] tracking-[0.2em] uppercase rotate-[-12deg] border border-ink-soft px-2 py-0.5 text-ink-soft">
                          Done
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Create `src/components/Footnotes.tsx`**

(Source: `sweep_finder.reference.jsx:426-446`.)

```tsx
import { SCHEDULE_YEAR } from '../types';

interface Props {
  address: string | null;
}

export const Footnotes = ({ address }: Props) => (
  <div className="px-5 mt-8 mb-6">
    <div className="border-t-2 border-ink pt-4">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-red">
        Fine print
      </div>
      <ul className="text-xs leading-relaxed space-y-1.5 text-ink-soft">
        <li>· <strong>Two consecutive dates = one for each side.</strong> Watch the orange temporary signs to know which side is yours on which day.</li>
        <li>· The fine for parking on a swept street is up to <strong>$60</strong>.</li>
        <li>· Some streets have permanent signs with their own schedule. Always check the post.</li>
        <li>· Sweeping runs roughly 9am–2pm, weekdays, weather permitting.</li>
        <li>· Schedule data: City of Chicago Open Data Portal · {SCHEDULE_YEAR} season.</li>
      </ul>
      {address && (
        <div className="mt-4 pt-3 border-t border-ink-soft font-mono text-[10px] leading-relaxed text-ink-soft opacity-70">
          Looked up: {address}
        </div>
      )}
    </div>
  </div>
);
```

- [ ] **Step 7: Create `src/components/HowItWorks.tsx`**

(Source: `sweep_finder.reference.jsx:543-562` — extracted from the inline JSX in the prototype's App.)

```tsx
const STEPS: Array<{ n: string; t: string; d: string }> = [
  { n: 'i.', t: 'Type your address', d: 'Or tap "current location"' },
  { n: 'ii.', t: 'We find your zone', d: 'Ward + section, automatic' },
  { n: 'iii.', t: 'See every date', d: 'For the whole season' },
];

export const HowItWorks = () => (
  <div className="px-5 mt-8 mb-10">
    <div className="border-t-2 border-ink pt-4">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3 text-chicago-red">
        How it works
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {STEPS.map((s, i) => (
          <div key={i} className="border border-ink p-3">
            <div className="font-serif italic text-2xl text-chicago-red">{s.n}</div>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase mt-1 text-ink">{s.t}</div>
            <div className="text-[10px] mt-1 text-ink-soft opacity-70">{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 8: Typecheck and commit**

```bash
npm run typecheck
git add src/components/
git commit -m "feat: port presentational components with new tokens and ChicagoStar markers"
```

---

## Task 15: Wire components into `App.tsx` (visual milestone)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx` with the composed version**

```tsx
import { useMemo, useState } from 'react';
import { useLookup } from './hooks/useLookup';
import { startOfDay } from './lib/dates';
import { generateICS } from './lib/ics';
import { SCHEDULE_YEAR } from './types';
import { Masthead } from './components/Masthead';
import { AddressInput } from './components/AddressInput';
import { ErrorPanel } from './components/ErrorPanel';
import { NextSweepHero } from './components/NextSweepHero';
import { ScheduleAlmanac } from './components/ScheduleAlmanac';
import { Footnotes } from './components/Footnotes';
import { HowItWorks } from './components/HowItWorks';
import './index.css';

export default function App() {
  const [address, setAddress] = useState('');
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, startLocating, reset } = useLookup();

  const handleLookup = () => {
    if (!address.trim()) return;
    void lookup(address);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude),
      () => void 0,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const next = useMemo(() => {
    if (!result) return null;
    const today = startOfDay(new Date());
    return result.dates.find((d) => startOfDay(d.date) >= today) ?? null;
  }, [result]);

  const handleDownload = () => {
    if (!result) return;
    const url = generateICS(result.dates, result.ward, result.section);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chicago-sweeps-W${result.ward}S${result.section}-${SCHEDULE_YEAR}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen grain bg-cream text-ink">
      <div className="max-w-xl mx-auto bg-cream">
        <Masthead />
        <AddressInput
          address={address}
          setAddress={setAddress}
          onLookup={handleLookup}
          onUseLocation={handleUseLocation}
          loading={isLoading}
          locating={isLocating}
        />
        {error && <ErrorPanel message={error} onDismiss={reset} />}
        {result && (
          <>
            <NextSweepHero next={next} ward={result.ward} section={result.section} />
            <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
            <Footnotes address={result.display} />
          </>
        )}
        {!result && !error && <HowItWorks />}
        <div className="px-5 py-4 border-t-2 border-ink text-center">
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft flex items-center justify-center gap-2">
            ⬩ Built in Chicago ⬩ Data via City Open Data Portal ⬩
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify visual parity in the browser**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify against the prototype JSX:
- Masthead with cream/blue/cream/blue/cream stripe (NOT red — this is the new flag direction)
- "✦" replaced with the six-pointed Chicago star
- "How it works" panel visible before lookup
- Type `1819 S California Ave`, click Find — Ward 25 §04 hero, full almanac, Footnotes appear
- "Use current location" works
- An invalid address shows the ErrorPanel
- The ICS download produces a valid `.ics` file (open it; should contain VEVENT entries)
- No green anywhere on the page

Stop the server when verified.

- [ ] **Step 3: Commit (visual parity milestone)**

```bash
git add src/App.tsx
git commit -m "feat: compose ported components in App with full lookup flow"
```

---

## Task 16: Delete the prototype reference

**Files:**
- Delete: `sweep_finder.reference.jsx`

- [ ] **Step 1: Confirm the prototype is no longer referenced**

```bash
grep -r "sweep_finder.reference" src/ index.html package.json || echo "no references"
```

Expected: `no references`.

- [ ] **Step 2: Delete it and commit**

```bash
git rm sweep_finder.reference.jsx
git commit -m "chore: remove prototype JSX now that port is complete"
```

---

## Task 17: frontend-design creative pass

This task is a **dispatch to the `frontend-design` skill**, not a hand-coded change. Its job is to push the visual direction from "ported but generic" to **bold civic broadsheet** — the spec's target aesthetic.

**Files:** Likely modifies `src/components/Masthead.tsx`, `src/components/NextSweepHero.tsx`, `src/components/ScheduleAlmanac.tsx`, possibly adds new ornament/illustration components. The frontend-design agent decides exactly which.

- [ ] **Step 1: Check git is clean before dispatching**

```bash
git status
```

Expected: working tree clean. If not, commit or stash first.

- [ ] **Step 2: Invoke the `frontend-design` skill with this brief**

Use the Skill tool with `frontend-design:frontend-design`. Pass the following brief verbatim:

> **Project:** The Sweep — Chicago street-sweeping schedule lookup. Current state: working app at `src/App.tsx`, all components in `src/components/`, tokens in `src/index.css`, Tailwind theme in `tailwind.config.ts`.
>
> **Aesthetic target:** Bold civic broadsheet. Editorial almanac skeleton (sections, kicker labels, rule lines, mono metadata) but elevated — the printed Chicago Department of Streets bulletin from a parallel universe where civic publications were beautiful.
>
> **Palette (hard rule, do not extend):** cream `#F1E9D2` background, ink `#0F1A2E` text/borders, chicago-red `#C8102E` (urgency/CTA only, never decorative), chicago-blue `#41B6E6` (section markers, calm states, masthead stripe). No green, no purple, no other hues. Tokens are at `src/index.css` and surfaced as Tailwind classes (`bg-cream`, `text-ink`, `text-chicago-red`, `text-chicago-blue`, `border-rule`).
>
> **Typography (hard rule):** DM Serif Display (display), IBM Plex Sans (body), IBM Plex Mono (labels/metadata). Already loaded. Use `font-serif`, `font-sans`, `font-mono` Tailwind utilities. No substitutions.
>
> **Star motif (hard rule):** the `<ChicagoStar />` SVG (`src/components/ChicagoStar.tsx`) is the only decorative glyph — no `✦`, no emoji. Place four stars in the masthead to mirror the flag. One star anchors each section marker (Lookup, Next Sweep, Almanac, Footnotes).
>
> **Don'ts:** no purple gradients, no glassmorphism, no neumorphism, no `border-radius: 9999px` on buttons (sharp rectangles only), no drop shadows except subtle paper-on-paper, no third color outside the palette.
>
> **Push these specifically:** (1) stronger typographic hierarchy in `Masthead` and `NextSweepHero` (consider a numerical-display dropcap, by-the-numbers callouts); (2) a "four stars across the masthead" treatment that makes the flag reference unmistakable without screaming; (3) refined corner ornaments and rule lines in `NextSweepHero` (the current ◢◣◥◤ are placeholder); (4) a more editorial month divider in `ScheduleAlmanac`; (5) consider a small wordmark/seal device that ties the Chicago star to the app name.
>
> **Constraints:** mobile-first, max-width ~600px stays. `useLookup` and the data layer are off-limits — you're styling presentational components only. Do not change `tailwind.config.ts` color tokens or add new colors. Do not change file structure.
>
> **Verify against** `1819 S California Ave` in the dev server when done.

- [ ] **Step 3: Review the design pass diff**

After the skill returns:

```bash
git diff
```

Read each changed component. Reject anything that violates the hard rules (new colors, new fonts, new decorative glyphs). If acceptable, proceed.

- [ ] **Step 4: Visual verification**

```bash
npm run dev
```

Open `http://localhost:5173`. Run through the canonical address flow and confirm the visual direction matches the brief. Stop the server when done.

- [ ] **Step 5: Commit the creative pass**

```bash
git add -A
git commit -m "feat: frontend-design creative pass — bold civic broadsheet direction"
```

---

## Task 18: PWA configuration

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/favicon.svg`

- [ ] **Step 1: Replace `vite.config.ts` with PWA-enabled config**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'The Sweep — Chicago Street Sweeping',
        short_name: 'The Sweep',
        description: 'Find your Chicago street sweeping schedule by address.',
        theme_color: '#F1E9D2',
        background_color: '#F1E9D2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The schedule data must always be fresh — don't cache the city's API.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://data.cityofchicago.org',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://geocoding.geo.census.gov' ||
              url.origin === 'https://nominatim.openstreetmap.org',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 2: Create the favicon SVG**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2" fill="#C8102E">
  <rect x="-1.1" y="-1.1" width="2.2" height="2.2" fill="#F1E9D2"/>
  <path d="M0,-1 L0.19,-0.329 L0.866,-0.5 L0.38,0 L0.866,0.5 L0.19,0.329 L0,1 L-0.19,0.329 L-0.866,0.5 L-0.38,0 L-0.866,-0.5 L-0.19,-0.329 Z"/>
</svg>
```

- [ ] **Step 3: Generate PNG icons from the SVG**

The maskable variant needs 20% padding around the star so it survives circular/squircle masks. The standard variants can fill more of the canvas.

Use ImageMagick:

```bash
mkdir -p public/icons
# Standard 192 — star fills ~80% of canvas
magick -background "#F1E9D2" -size 192x192 -density 600 public/favicon.svg -resize 192x192 public/icons/icon-192.png
# Standard 512
magick -background "#F1E9D2" -size 512x512 -density 600 public/favicon.svg -resize 512x512 public/icons/icon-512.png
# Maskable 512 — extra padding (resize star to 60% of canvas, center it)
magick -background "#F1E9D2" -size 512x512 -density 600 public/favicon.svg -resize 60% -gravity center -extent 512x512 public/icons/icon-maskable-512.png
```

If `magick` (ImageMagick 7+) is not installed: `brew install imagemagick`. If you only have ImageMagick 6 (`convert`), substitute `convert` for `magick` in each command.

- [ ] **Step 4: Reference favicon in `index.html`**

In `index.html`, replace the existing `<link rel="icon">` tag with:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 5: Build and verify the PWA bundle**

```bash
npm run build
```

Expected output includes `dist/sw.js`, `dist/manifest.webmanifest`, and the icon files in `dist/icons/`.

```bash
npm run preview
```

Open `http://localhost:4173` in Chrome. Open DevTools → Application → Manifest. Verify:
- Name: "The Sweep — Chicago Street Sweeping"
- Theme color: `#F1E9D2`
- All three icons load (no broken images)
- Service Worker is registered

Stop preview when verified.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: configure vite-plugin-pwa with manifest, icons, and network-only API caching"
```

---

## Task 19: Update `CLAUDE.md`

The CLAUDE.md has the old palette (with green) and the old `✦` decorative glyphs. Update so future sessions have accurate context.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the design tokens section**

Find the `### Tokens (CSS vars, defined in src/index.css)` block in `CLAUDE.md` and replace its CSS with:

```css
--cream:        #F1E9D2;   /* Background — warm parchment */
--cream-dark:   #E8DFC4;
--ink:          #0F1A2E;   /* Primary text — deep navy */
--ink-soft:     #1A2540;
--chicago-red:  #C8102E;   /* Pantone 1795 — urgency, errors, CTA, the four stars */
--red-deep:     #8A2828;
--chicago-blue: #41B6E6;   /* Pantone 297 — section markers, calm states, hover */
--blue-deep:    #2E8AB5;
--rule:         #1A2540;   /* Borders */
```

- [ ] **Step 2: Replace the "Color use" subsection**

Find the `### Color use` subsection and replace its bullets with:

```markdown
- **Cream** dominates as background.
- **Ink** for all text and borders by default.
- **Chicago blue** for section markers, ward/section number callouts, calm states (e.g. "season concluded"), the masthead flag stripe, and hover/pressed states.
- **Chicago red** *only* for: urgency (sweep ≤ 2 days away), errors, the primary CTA, and the four-star motif. Reserved — never decorative.
```

- [ ] **Step 3: Replace the "Don'ts" subsection**

Find the `### Don'ts` subsection and replace it with:

```markdown
- No purple gradients, glassmorphism, neumorphism, gradient text
- No emoji except the `<ChicagoStar />` SVG and sparing utility marks (◢ ◣ ◥ ◤, ⬩)
- No `border-radius: 9999px` on buttons. Buttons are sharp rectangles.
- No drop shadows except subtle paper-on-paper for layering
- No third color outside the palette. If a new state needs to feel distinct, do it through weight/border/scale, not a new hue
```

- [ ] **Step 4: Update the file structure section**

Find the `## File structure` block and replace the `└── src/` tree with:

```markdown
└── src/
    ├── main.tsx
    ├── App.tsx                     # Composition only
    ├── index.css                   # Tailwind + font imports + CSS vars
    ├── types.ts                    # SweepDate, ZoneInfo, GeocodeResult, LookupStatus, dataset constants
    ├── lib/                        # Pure functions, no React imports
    │   ├── geocode.ts              # geocode() + Census→Nominatim chain
    │   ├── zones.ts                # lookupZone() + 2026→2025 fallback
    │   ├── schedule.ts             # fetchSchedule()
    │   ├── ics.ts                  # generateICS()
    │   ├── address.ts              # cleanAddress()
    │   └── dates.ts                # daysFromToday(), startOfDay(), formatters
    ├── hooks/
    │   └── useLookup.ts            # Orchestrates the full geocode → zone → schedule flow
    └── components/
        ├── Masthead.tsx
        ├── AddressInput.tsx
        ├── ErrorPanel.tsx
        ├── NextSweepHero.tsx
        ├── ScheduleAlmanac.tsx
        ├── Footnotes.tsx
        ├── HowItWorks.tsx
        └── ChicagoStar.tsx         # Six-pointed flag star, used everywhere as section marker
```

- [ ] **Step 5: Add a "Design motif" note near the design system section**

After the "Don'ts" subsection, add a new subsection:

```markdown
### Design motif: the four stars

The Chicago flag has four six-pointed red stars (Fort Dearborn, Great Fire, Columbian Exposition, Century of Progress). The app reflects this:

- Four stars across the masthead, mirroring the flag.
- One star anchors each major page region: Lookup, Next Sweep, Almanac, Footnotes.
- All stars render via `<ChicagoStar />` in `src/components/ChicagoStar.tsx` — never as `✦` or other glyphs.
```

- [ ] **Step 6: Update tech stack table**

Find the `## Tech stack` table and add a row for PWA:

```markdown
| PWA | **vite-plugin-pwa** | Configured in `vite.config.ts`; manifest, service worker, maskable icons |
```

Remove the "(recommended)" qualifier and the "Why" text on the existing PWA row, since it's now done.

- [ ] **Step 7: Verify by reading the updated file**

Open `CLAUDE.md` and skim — confirm no stale references to `--green`, `#2A4F3A`, or `✦` remain in any section.

```bash
grep -n "green\|2A4F3A\|✦" CLAUDE.md || echo "clean"
```

Expected: `clean`. If any matches, update those passages.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new palette, star motif, and final file structure"
```

---

## Task 20: Production build and Netlify deploy

**Files:**
- (Verify only) `netlify.toml`, `dist/`

- [ ] **Step 1: Final production build**

```bash
npm run build
```

Expected: build succeeds, `dist/` contains `index.html`, `assets/`, `icons/`, `favicon.svg`, `manifest.webmanifest`, `sw.js`. No TypeScript errors.

- [ ] **Step 2: Final preview verification**

```bash
npm run preview
```

Open `http://localhost:4173`:
- Type `1819 S California Ave` → confirm Ward 25 §04 + dates
- Try `Use current location` (allow permission)
- Try a malformed address → confirm error panel
- Click `.ics` download → open the file, confirm valid VCALENDAR with VEVENT entries
- Open DevTools → Lighthouse → run a PWA audit. Expected: PWA installable.
- (Optional) Test "Add to Home Screen" on a real phone via local network IP.

Stop preview when verified.

- [ ] **Step 3: Push to GitHub**

```bash
git remote add origin <github-repo-url>   # if not already set
git push -u origin main
```

Replace `<github-repo-url>` with the project's GitHub remote. If the repo doesn't exist yet, create it first via `gh repo create` or the GitHub UI.

- [ ] **Step 4: Connect to Netlify**

Either via the Netlify UI ("Add new site → Import existing project → pick this repo") or via Netlify CLI:

```bash
npx netlify-cli deploy --build --prod
```

Expected: deploy succeeds; Netlify provides a `*.netlify.app` URL.

- [ ] **Step 5: Verify the live site**

Open the Netlify URL on a phone:
- Lookup `1819 S California Ave` works
- "Use current location" works (HTTPS required, which Netlify provides)
- "Add to Home Screen" works (iOS Safari → Share → Add to Home Screen, or Chrome → install icon)
- Installed app launches in standalone mode with the cream theme color

- [ ] **Step 6: Update CLAUDE.md with the live URL**

In `CLAUDE.md`, find the `**Live at:** \`<TBD — Netlify subdomain>\`` line and replace `<TBD — Netlify subdomain>` with the actual URL.

- [ ] **Step 7: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: add live Netlify URL to CLAUDE.md"
git push
```

---

## Self-review notes (author)

- **Spec coverage:**
  - Vite + React + TS + Tailwind scaffold → Task 1.
  - CSS-var tokens + Tailwind theme extension → Tasks 1 (config) + 2 (CSS).
  - Strict TS → Task 1 step 7.
  - Drop green, add chicago-blue, shift red → Tasks 2 + 19.
  - All `lib/` modules → Tasks 4–9.
  - `useLookup` hook → Task 11.
  - `ChicagoStar` SVG primitive → Task 13.
  - All 7 components ported → Task 14.
  - Stars replace `✦` → Task 14 (parity pass) + Task 17 (creative pass).
  - Authentic flag stripe → Task 14 step 1 (Masthead).
  - Four stars in masthead anchor + four-region star pattern → Task 17 (creative pass brief lists this explicitly).
  - frontend-design pass → Task 17.
  - PWA via vite-plugin-pwa → Task 18.
  - CLAUDE.md update → Task 19.
  - Netlify deploy → Task 20.
  - Manual verification against `1819 S California Ave` → Tasks 10, 12, 15, 18, 20.

- **Placeholders:** none. Every step has either a complete code block, an exact command with expected output, or a precise file edit.

- **Type consistency:**
  - `LookupStatus` is a discriminated union defined in Task 3 (`types.ts`) and consumed in Task 11 (`useLookup`). The `kind` discriminator + `result`/`message` fields match.
  - `SweepDate.sideLabel: 'A' | 'B'` defined in Task 3, produced in Task 8 (`schedule.ts`), consumed in Task 14 (`ScheduleAlmanac.tsx`).
  - `useLookup` API surface (`status`, `result`, `error`, `isLoading`, `isLocating`, `lookup`, `lookupByCoords`, `startLocating`, `reset`) defined in Task 11 and matches the consumer in Task 12 (minimal App) and Task 15 (composed App).

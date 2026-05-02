# The Sweep — v1 Port & Visual Direction

**Date:** 2026-05-01
**Owner:** Amir
**Status:** Approved design, awaiting implementation plan

---

## Goal

Take the working single-file prototype `sweep_finder.jsx` and ship it as a real Vite + React + TypeScript + Tailwind app that matches the architecture in `CLAUDE.md`, with a refined Chicago-flag-incorporated visual direction. v1 is functionally complete (the JSX already does the job) — the work is structural cleanup plus a creative pass to elevate the design.

## Scope

**In v1:**
- Port the prototype to the spec'd file structure (`src/lib`, `src/hooks`, `src/components`).
- Migrate styling from inline `style={{ color: C.ink }}` to Tailwind utilities backed by CSS variables.
- Refresh the visual direction to incorporate authentic Chicago flag colors and the six-pointed star motif.
- PWA install support via `vite-plugin-pwa` (manifest + service worker + maskable icons).
- TypeScript strict mode.
- Deploy to Netlify.

**Out of v1 (deferred to roadmap):**
- Push notifications.
- Save addresses / multi-address recall.
- Sweeper tracker integration.
- 311 reporting shortcut.
- Dark mode.
- Automated tests. (Manual verification against canonical address `1819 S California Ave` → Ward 25 §04 is the v1 quality bar.)

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Design tokens | CSS variables in `index.css` + `tailwind.config.ts` `theme.extend.colors` | Spec-aligned; ergonomic `bg-cream text-ink` shorthand throughout components |
| Visual direction | Elevate the editorial almanac with selective Chicago iconography | Strongest part of the existing design; restraint avoids "tourist poster" |
| TypeScript | `strict: true` from start | Socrata + geocoder response shapes are exactly what TS catches |
| Tests | None in v1 | App is small, manually verifiable; tests start paying off when we add a paid geocoder or backend |
| PWA | Included in v1 | Top of CLAUDE.md roadmap; small lift, big payoff for the "morning check" use case |
| State management | `useState` + a single `useLookup` hook | App is too small for Redux/Zustand |
| Routing | None | Single page in v1; add `react-router` only when we add real subpages |

## Visual direction

The aesthetic is **bold civic broadsheet** — same editorial almanac skeleton as the prototype, brighter signal, unmistakably Chicago.

### Palette (updates `CLAUDE.md` tokens)

```css
--cream:        #F1E9D2;   /* parchment base — unchanged */
--cream-dark:   #E8DFC4;
--ink:          #0F1A2E;   /* text/borders — unchanged */
--ink-soft:     #1A2540;
--chicago-red:  #C8102E;   /* shifted from #B23838 to flag-spec (Pantone 1795) */
--red-deep:     #8A2828;
--chicago-blue: #41B6E6;   /* NEW — flag light blue (Pantone 297) */
--blue-deep:    #2E8AB5;   /* NEW — hover/pressed states */
--rule:         #1A2540;
```

**Dropped:** `--green` (`#2A4F3A`). Not on the flag, didn't pull weight. Calm/safe states (e.g. "season concluded") use blue instead.

### Color use rules

- **Cream** — page background.
- **Ink** — body text, borders, default state. Anchors brightness so blue/red read as accent rather than aggressive.
- **Chicago blue** — section markers, ward/section number callouts, calm states (replaces green), the masthead stripe, hover states.
- **Chicago red** — urgency only (sweep ≤ 2 days), errors, the four stars, the primary CTA. Reserved — never decorative.

### Star motif

The flag's six-pointed star becomes the signature visual element, replacing the generic `✦` decorative chars in the prototype. Implemented as a single SVG component (`<ChicagoStar />`) used at multiple scales and weights:

- **Four of them across the masthead**, mirroring the flag's row of four.
- **One per section marker** (`★ Section I — Lookup`, `★ Section II — Your Next Sweep`, etc.).
- **Subtle watermark** behind `NextSweepHero`.
- **Favicon** and **PWA maskable icon**.

The flag has exactly four stars, each historically representing a Chicago event. We have four major page regions (Lookup, Next Sweep, Almanac, Footnotes) — one star anchors each. Subtle but it gives the four-star count structural meaning.

### Flag stripe

The masthead stripe in the prototype is red–cream–red–cream–red. Update to authentic flag construction: cream–blue–cream–blue–cream (honoring the parchment base while reading as the Chicago flag's two-blue-stripes-on-white).

### Typography

Unchanged from `CLAUDE.md`:
- **Display:** DM Serif Display
- **Body:** IBM Plex Sans
- **Mono:** IBM Plex Mono

The frontend-design pass may strengthen hierarchy (kicker labels, dropcaps, by-the-numbers callouts) but the family stays.

### Don'ts (carried forward from CLAUDE.md, with one addition)

- No purple gradients, glassmorphism, neumorphism, gradient text.
- No `border-radius: 9999px` on buttons.
- No emoji except the Chicago star (now `<ChicagoStar />`) and sparing utility marks.
- **NEW:** No third color outside the flag palette + cream + ink. If a fourth state needs to be visually distinct, do it through weight/border/scale, not a new hue.

## Architecture

```
chi-street-sweep/
├── CLAUDE.md                       # updated: new tokens, dropped green, star convention
├── README.md
├── index.html
├── package.json
├── vite.config.ts                  # vite-plugin-pwa configured
├── tailwind.config.ts              # theme.extend.colors maps to CSS vars
├── tsconfig.json                   # strict: true
├── netlify.toml                    # build = npm run build, publish = dist
├── public/
│   ├── favicon.svg                 # ChicagoStar
│   └── icons/                      # PWA: 192/512 maskable
└── src/
    ├── main.tsx
    ├── App.tsx                     # layout orchestration only
    ├── index.css                   # @tailwind directives, @font-face, CSS vars
    ├── types.ts                    # SweepDate, ZoneInfo, GeocodeResult
    ├── lib/                        # pure functions, no React imports
    │   ├── address.ts              # cleanAddress
    │   ├── geocode.ts              # geocode + Census/Nominatim chain
    │   ├── zones.ts                # lookupZone + 2026/2025 fallback
    │   ├── schedule.ts             # fetchSchedule
    │   ├── ics.ts                  # generateICS
    │   └── dates.ts                # startOfDay, daysFromToday, formatters
    ├── hooks/
    │   └── useLookup.ts            # geocode → zone → schedule state machine
    └── components/
        ├── Masthead.tsx
        ├── AddressInput.tsx        # renamed from JSX's InputCard per spec
        ├── ErrorPanel.tsx
        ├── NextSweepHero.tsx
        ├── ScheduleAlmanac.tsx
        ├── Footnotes.tsx
        ├── HowItWorks.tsx          # extracted from App.tsx in JSX
        └── ChicagoStar.tsx         # SVG primitive
```

### Boundaries

- **`src/lib/`** is React-free. Pure async functions, no hooks, no JSX. Each file exports one or two named functions and the types they need.
- **`src/hooks/`** orchestrates `lib/` calls and owns stateful concerns. `useLookup` returns `{ status, result, error, lookup(address), lookupByCoords(lat, lon) }`. `App.tsx` consumes it.
- **`src/components/`** renders. No fetches inside components. Props in, JSX out.

### Data flow (unchanged from CLAUDE.md)

```
User input (address or GPS)
        │
        ▼
  geocode()        Census → Nominatim fallback chain
        │  { lat, lon, display }
        ▼
  lookupZone()     Spatial intersect query, 2026 → 2025 fallback
        │  { ward, section }
        ▼
  fetchSchedule()  Filtered Socrata query
        │  SweepDate[]
        ▼
   UI: Masthead + AddressInput + NextSweepHero + ScheduleAlmanac + Footnotes
```

Each layer has a fallback chain. If geocoding's primary fails, we fall through. If 2026 zones is empty, we hit 2025. Independent failure modes.

## Build sequence

Ordered so the app works functionally before any visual polish, and `frontend-design` has real components to push on.

1. **Scaffold.** `npm create vite@latest` (React + TS template). Install React 18, lucide-react, tailwindcss, postcss, autoprefixer, vite-plugin-pwa. Initialize git. Wire `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json` (strict), `netlify.toml`. End state: blank Vite app builds and serves.
2. **Tokens & fonts.** Write `src/index.css` with `@tailwind` directives, `@font-face` / `@import` for DM Serif Display + IBM Plex Sans + IBM Plex Mono, and CSS variables. Extend Tailwind theme so `bg-cream text-ink border-rule text-chicago-blue` resolve. End state: tokens compile, fonts load on a hello-world page.
3. **Data layer.** Port `lib/address.ts`, `lib/geocode.ts`, `lib/zones.ts`, `lib/schedule.ts`, `lib/ics.ts`, `lib/dates.ts` from the JSX. Add `types.ts`. End state: throwaway `App.tsx` calls `geocode("1819 S California Ave")` then `lookupZone` then `fetchSchedule` and console-logs the result.
4. **`useLookup` hook + minimal App.** Orchestrate the chain in `useLookup`. Render raw text — address input, button, dump of result. End state: type address, see ward/section/dates as plain text. **App is functionally complete here.**
5. **`ChicagoStar` SVG primitive.** Build first since every component uses it. Accept `size` and `color` props.
6. **Component port + restyle pass 1.** Port each JSX component to its own file, swap inline `style={{ color: C.ink }}` for Tailwind classes (`text-ink`), replace `✦` with `<ChicagoStar />`. End state: visually parity with the JSX but properly structured and using new tokens.
7. **frontend-design creative pass.** Invoke the `frontend-design` skill on the assembled app. Push the visual direction: four-star masthead, blue/red rebalance, section-numbering tied to stars, ornament refinement, stronger typographic hierarchy. This is the creative leap from "ported" to "bold civic broadsheet."
8. **PWA.** Configure `vite-plugin-pwa` with manifest (theme colors, name, short_name, display: standalone). Generate 192 + 512 maskable icons from `ChicagoStar`. End state: installable on iOS and Android.
9. **Update `CLAUDE.md`.** Codify the new tokens, the dropped green, the star motif convention, the file structure as built. So future sessions have accurate project context.
10. **Deploy.** Push to GitHub, connect Netlify, verify against canonical address `1819 S California Ave` (should resolve to Ward 25 §04). Test PWA install on a real phone.

**Step 4 is the functional milestone.** Steps 5–7 are visual. Step 8 is platform polish.

## Risks and gotchas

Carried forward from `CLAUDE.md`:
- **Two-date pairs are sides, not duplicates.** Never deduplicate consecutive dates in `fetchSchedule`.
- **Spatial WKT is `POINT(<lon> <lat>)`** — lon/lat order, not lat/lon.
- **Socrata dates are TZ-naive.** Construct with `new Date(year, month-1, day)`, never `new Date(isoString)`.
- **`month_number` is a string.** `parseInt()` it.
- **Nominatim throws with no body when blocked.** Catch and fall through.
- **Ward zero-padding inconsistent.** Pad to 2 digits on display.
- **Address cleaner test case:** `"1819 S. California Ave, APT BST, Chicago, IL 60608"` — must survive cleaning.
- **Schedule data updates mid-season.** No localStorage caching across sessions.

## Open items deferred to the implementation plan

- Exact `tailwind.config.ts` color extension shape (semantic names like `bg-urgent` vs literal `bg-chicago-red`).
- Whether `useLookup` exposes a discriminated union for `status` or separate booleans.
- Exact PWA manifest values (theme color, background color, name).
- Hosting subdomain on Netlify.

These are implementation-level — the plan in the next phase will resolve them.

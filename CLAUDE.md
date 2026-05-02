# CLAUDE.md

> Project context for Claude Code. Read this first.

## What this is

**The Sweep** — a Chicago street-sweeping schedule lookup tool. Type an address (or use GPS), get your ward + section, see every sweep date for the season, download to your calendar.

The motivating problem: the city's official lookup is a clunky multi-click flow through PDFs and ward maps. People forget to move their cars and get $60 tickets. This app collapses it to one screen.

**Live at:** https://sweep.amirabdurrahim.com (Netlify, custom subdomain on amirabdurrahim.com)
**Owner:** Amir (Chicago)

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast HMR, minimal config |
| Framework | **React 18 + TypeScript** | Type safety on the data shapes is worth it |
| Styling | **Tailwind CSS** | Utility-first matches the editorial design system |
| Icons | **lucide-react** | Already aesthetic-aligned |
| Hosting | **Netlify** | Static site, no backend needed |
| State | **useState / useMemo** | App is too small for Redux/Zustand |
| PWA | **vite-plugin-pwa** | Configured in `vite.config.ts`; manifest, service worker, maskable icons |

**No backend.** All data sources have CORS enabled. Don't add a server unless we add features that genuinely need one (push notifications, multi-user accounts).

**No client-side routing** for now. Single page. Add `react-router` only if we add real subpages (e.g. `/about`, `/ward/25`).

---

## Architecture

```
User input (address or GPS)
        │
        ▼
┌──────────────────┐
│  geocode()       │  Census Geocoder → Nominatim fallback
│  src/lib/geocode │
└──────────────────┘
        │  { lat, lon }
        ▼
┌──────────────────┐
│  lookupZone()    │  Spatial intersects query against
│  src/lib/zones   │  Chicago Data Portal polygon dataset
└──────────────────┘
        │  { ward, section }
        ▼
Promise.all (parallel after geocode + zone):
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  fetchSchedule() │  │ lookupRecycling()│  │  lookupGarbage() │
  │  Socrata sweep   │  │  ArcGIS layer 76 │  │  ArcGIS layer 127│
  └──────────────────┘  └──────────────────┘  └──────────────────┘
        │ SweepDate[]      │ RecyclingInfo     │ GarbageInfo
        └──────────────────┴───────────────────┘
                           ▼
   UI: Masthead + AddressInput + NextSweepHero (II.a)
       + RoutinePickups (II.b) + ScheduleAlmanac + Footnotes
```

Each layer is independent. If geocoding breaks, we still want zone lookup to work for the GPS path. If the 2026 zones dataset breaks, we want a 2025 fallback. **Always design data calls with a fallback chain.**

---

## Data sources (memorize these)

### 1. Schedule dataset

- **Resource ID:** `u5ai-3efk`
- **Endpoint:** `https://data.cityofchicago.org/resource/u5ai-3efk.json`
- **Filter by ward + section:** `?ward=25&section=04`
- **Schema:**
  ```ts
  {
    ward_section_concatenated: string;  // "2504"
    ward: string;                        // "25" (note: zero-padded for some, not others)
    section: string;                     // "04"
    month_name: string;                  // "JULY"
    month_number: string;                // "7" (NOT zero-padded)
    dates: string;                       // "21,22" — comma-separated days of month
  }
  ```
- **Critical quirk:** `dates` is **two consecutive dates**, one for each side of the street. The dataset never tells you which side is A or B — that's only knowable from the orange temporary signs posted on the street. UI must show both dates and explain this.
- **Year:** Dataset rolls over annually. The resource ID changes each year. Currently `u5ai-3efk` for 2026; update `SCHEDULE_DATASET_ID` constant when 2027 drops.

### 2. Zones dataset (polygon boundaries)

- **2026 ID:** `2r7q-emq3`
- **2025 fallback ID:** `utb4-q645`
- **Endpoint:** `https://data.cityofchicago.org/resource/{id}.json`
- **Spatial query:**
  ```
  ?$where=intersects(the_geom,'POINT(<lon> <lat>)')&$limit=1
  ```
- **Critical quirk:** The 2026 zones dataset was **delayed at season start** (March 2026). Always try 2026 first, fall back to 2025 if empty. The boundaries are nearly identical year-to-year so this is safe.
- **Returns:** `{ ward, section, the_geom: { type: "MultiPolygon", coordinates: [...] } }`

### 3. Geocoders (multi-provider chain)

Order matters:

1. **Google Places API (New)** — primary when `VITE_GOOGLE_MAPS_API_KEY` is set
   - Autocomplete: `POST https://places.googleapis.com/v1/places:autocomplete`
   - Place details: `GET https://places.googleapis.com/v1/places/{placeId}` with `X-Goog-FieldMask: location` (cheapest tier)
   - Session-token billing: reuse one UUID across all autocomplete calls AND the follow-up details call for one user-search session
   - Restricted to: HTTP referrers (sweep.amirabdurrahim.com + *.netlify.app + localhost:5173) and APIs (Places + Geocoding)
2. **U.S. Census Geocoder** (fallback for direct text submit)
   - `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?...`
   - Free, government-run, no rate limits — but **CORS-blocked from browsers** (works server-side; in the app it always fails)
3. **Nominatim** (final fallback)
   - `https://nominatim.openstreetmap.org/search?...`
   - Free but rate-limited; OSM coverage

The display string is always the **user-typed input** (`cleaned, Chicago`) or the Google `mainText, secondaryText` — never the verbose Nominatim `display_name`.

### 4. Address cleaning

Geocoders choke on apartment numbers, ZIP codes, and duplicated city/state. Always run input through `cleanAddress()`:

- Strip `apt|apartment|unit|suite|ste|#|floor|fl|rm|room|bldg <token>`
- Strip 5- and 9-digit ZIPs
- Strip trailing `, Chicago, IL` (we re-append it ourselves)
- Collapse whitespace and stray commas

Test case that broke v1: `"1819 S. California Ave, APT BST, Chicago, IL 60608"`. Always test against this when touching the cleaner.

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

### 6. localStorage façades (saved addresses + recents)

- `lib/savedAddresses.ts` — `sweep.savedAddresses` key, capped at 10, de-duped by lat/lon (~1m precision).
- `lib/recentLookups.ts` — `sweep.recentLookups` key, capped at 3, FIFO with re-push on repeat search.
- Writes dispatch a synthetic `storage` event so same-tab subscribers (`useSavedAddresses`) re-render.
- Failures are silent (iOS Safari private mode throws on `setItem`; the app degrades gracefully).
- **Privacy:** addresses never leave the browser. CLAUDE.md "never store on a server" rule still holds — localStorage is local.

---

## Design system

This is **not** a generic SaaS app. The aesthetic is **editorial / civic almanac** — like a printed Chicago Department of Streets bulletin from a parallel universe where civic publications were beautiful. Lean into it.

### Tokens (CSS vars, defined in `src/index.css`)

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

### Typography

- **Display:** `DM Serif Display` — used for the masthead, dates, headlines
- **Body:** `IBM Plex Sans` — UI text, paragraphs
- **Mono:** `IBM Plex Mono` — labels, metadata, "section i / ii / iii" markers

Never substitute Inter, Roboto, system-ui, Arial, or any other generic sans for the body font. The Plex family is non-negotiable to the design.

### Layout principles

- **Single column, max-width ~600px.** This is a mobile-first tool. People check it on their phone in the morning.
- **Heavy 2px borders + 1px rules.** Newspaper-grade structure.
- **Section markers** (a `<ChicagoStar />` plus mono label, e.g. "Section I — Lookup", "Section II — Your Next Sweep") frame each block like an almanac entry.
- **Decorative ornaments** (◢ ◣ ◥ ◤) at corners of major panels.
- **Chicago flag stripe** at the top: cream–blue–cream–blue–cream (matches the actual flag's two-blue-on-white construction, tinted to the cream base).

### Color use

- **Cream** dominates as background.
- **Ink** for all text and borders by default.
- **Chicago blue** for section markers, ward/section number callouts, calm states (e.g. "season concluded"), the masthead flag stripe, and hover/pressed states.
- **Chicago red** *only* for: urgency (sweep ≤ 2 days away), errors, the primary CTA, and the four-star motif. Reserved — never decorative.

### Don'ts

- No purple gradients, glassmorphism, neumorphism, gradient text
- No emoji except the `<ChicagoStar />` SVG and sparing utility marks (◢ ◣ ◥ ◤, ⬩)
- No `border-radius: 9999px` on buttons. Buttons are sharp rectangles.
- No drop shadows except subtle paper-on-paper for layering
- No third color outside the palette. If a new state needs to feel distinct, do it through weight/border/scale, not a new hue

### Design motif: the four stars

The Chicago flag has four six-pointed red stars (Fort Dearborn, Great Fire, Columbian Exposition, Century of Progress). The app reflects this:

- Four stars across the masthead, mirroring the flag.
- One star anchors each major page region: Lookup, Next Sweep, Almanac, Footnotes.
- All stars render via `<ChicagoStar />` in `src/components/ChicagoStar.tsx` — never as Unicode star glyphs (e.g. four-pointed/six-pointed star characters) or other text symbols.

**Sub-section convention:** when a top-level Section needs to split, use letter sub-numbering (II.a / II.b) rather than promoting to its own Section. This preserves the four-section / four-star mapping (I Lookup, II Pickups, III Almanac, IV Footnotes). Currently II.a = Sweep hero, II.b = Routine pickups (recycling + garbage).

---

## File structure

```
chi-sweep/
├── CLAUDE.md
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── netlify.toml
├── public/
│   ├── favicon.svg
│   └── icons/                      # PWA icons
└── src/
    ├── main.tsx
    ├── App.tsx                     # Composition only
    ├── index.css                   # Tailwind + font imports + CSS vars
    ├── types.ts                    # SweepDate, ZoneInfo, GeocodeResult, LookupStatus, dataset constants
    ├── lib/
    │   ├── address.ts
    │   ├── dates.ts
    │   ├── garbage.ts
    │   ├── geocode.ts              # geocode() + geocodeByPlaceId() (Google Places)
    │   ├── googlePlaces.ts         # Places API (New) autocomplete + details, session-token billed
    │   ├── holidays.ts
    │   ├── ics.ts
    │   ├── recentLookups.ts        # sweep.recentLookups localStorage façade
    │   ├── recycling.ts
    │   ├── recyclingDecode.ts
    │   ├── savedAddresses.ts       # sweep.savedAddresses localStorage façade
    │   ├── schedule.ts
    │   └── zones.ts
    ├── hooks/
    │   ├── useAddressSearch.ts     # Debounced typeahead + session token
    │   ├── useLookup.ts            # Orchestrates geocode → zone → schedule + recycling + garbage
    │   └── useSavedAddresses.ts    # Reactive wrapper over saved-address localStorage
    └── components/
        ├── AddressInput.tsx        # Now includes ARIA combobox dropdown
        ├── ChicagoStar.tsx
        ├── ErrorPanel.tsx
        ├── Footnotes.tsx
        ├── HowItWorks.tsx
        ├── Masthead.tsx
        ├── NextSweepHero.tsx
        ├── RoutinePickups.tsx
        ├── SaveAddressPrompt.tsx   # "Save this address" inline form below the hero
        ├── SavedAddressChips.tsx   # Chip row above the input
        ├── ScheduleAlmanac.tsx
        └── Seal.tsx                # Round civic-stamp device — curved text + four-star arc
```

**Pattern:** `src/lib` is pure functions, no React. `src/hooks` orchestrates. `src/components` renders. Don't put fetches inside components.

---

## Common commands

```bash
# Setup
npm install

# Dev server (http://localhost:5173)
npm run dev

# Type check
npm run typecheck

# Production build
npm run build

# Preview production build locally
npm run preview

# Deploy to Netlify (if Netlify CLI installed)
netlify deploy --prod
```

---

## Deployment

- Hosted on **Netlify**. Repo connected via Git, auto-deploys on push to `main`.
- `netlify.toml` configures build command (`npm run build`) and publish dir (`dist/`).
- No environment variables required for the base feature set — all APIs are public, no keys.
- When v3 ships, set `VITE_GOOGLE_MAPS_API_KEY` in Netlify env settings (HTTP-referrer-restricted to `sweep.amirabdurrahim.com/*` + `*.netlify.app/*` + `localhost:5173/*`; APIs limited to Places + Geocoding; daily quota cap below the free-tier ceiling).

---

## Common tasks

### Adding a new data source

1. Add an entry to this CLAUDE.md under **Data sources**.
2. Create a pure function in `src/lib/`.
3. Build a fallback chain — never depend on a single endpoint without a plan B.
4. Type the response shape in `src/types.ts`.

### Adding a new feature

1. Sketch the data flow first. Does it need new fetches? New state? New routes?
2. Pure logic → `src/lib`. Stateful orchestration → `src/hooks`. Pure rendering → `src/components`.
3. Match the existing aesthetic. New components follow the same border / typography / section-marker pattern.
4. Test with the canonical address: `1819 S California Ave` (Pilsen, Ward 25).

### Updating for next year

When the city publishes the 2027 datasets:
1. Find new resource IDs at `data.cityofchicago.org` (search "Street Sweeping Schedule 2027").
2. Update `SCHEDULE_DATASET_ID` and `ZONES_DATASET_ID` in `src/lib/`.
3. Move the prior year's IDs into the fallback slot.
4. Update `SCHEDULE_YEAR` constant.
5. Refresh `src/lib/holidays.ts` from chicago.gov's "Holiday Garbage Schedule" page (filter Mon–Fri only, then bump the table year).
6. Re-anchor the recycling A/B parity in `src/lib/recyclingDecode.ts` — verify `ANCHOR_WEEK_INDEX_IS_YELLOW` against the city's first Yellow week PDF for the new year.

---

## Known gotchas

- **Two-date pairs are sides, not the same date confirmed twice.** Never deduplicate consecutive dates. The schedule dataset's `dates: "21,22"` field literally means "side A on the 21st, side B on the 22nd."
- **Ward numbers are sometimes zero-padded, sometimes not.** Pad to 2 digits on display (`"25"` → `"25"`, `"5"` → `"05"`) for consistency, but the API accepts either. Test both.
- **`month_number` is a string, not a number, in the API response.** `parseInt()` it.
- **Spatial queries need lon/lat order, not lat/lon.** `POINT(<lon> <lat>)`. WKT convention. Mixing this up returns no results silently.
- **Nominatim returns "Load failed" with no body when blocked.** Catch the throw, don't try to parse. Move on to the next provider.
- **Dates from Socrata come in TZ-naive format.** Construct with `new Date(year, month-1, day)` (local time), not `new Date(isoString)` which can shift by a day.
- **The city does corrections mid-season.** Schedule data is occasionally amended. We always fetch fresh, never cache to localStorage. (Memoizing per-session is fine.)
- **Sweepers run ~9am–2pm weekdays, weather permitting.** "Weather permitting" means rain or snow can cancel a day. We can't predict this — show the scheduled date and the city posts orange signs the day before.

---

## What's next (roadmap)

### Shipped
- **v1 — Vite + TS + Tailwind port** with the bold civic broadsheet visual direction.
- **PWA** — installable on iOS/Android via vite-plugin-pwa.
- **v2 — Routine pickups** (recycling + garbage). Holiday-shift detection. Two-`.ics` export.
- **v3 — Google Places autocomplete + saved addresses + recents** with localStorage persistence and graceful Census/Nominatim fallback.

### Backlog (in rough priority order)
1. **Snow route status** — ArcGIS layer 50; high consequence in winter.
2. **311 quick links** from the looked-up address (missed pickup, sign down, pothole).
3. **Calendar push notifications** — closes the loop on the `.ics` download.
4. **Live sweeper tracker integration** — `chicago.gov/.../sweeper_tracker.html`.
5. **Ward office contact** — alderperson and office number, sourced from the ward number we already have.
6. **Dark mode** — needs its own design pass, not just inverted colors.

---

## Things to never do

- **Never store user addresses on a server.** This is a privacy-sensitive city tool. Everything stays client-side.
- **Never add analytics that send addresses to a third party.** Aggregate-only metrics (page views, lookup count) are fine; address data is not.
- **Never silently cache schedule data across sessions.** The city issues corrections.
- **Never substitute the typography or color palette for "more accessible" generic options** without a design conversation. Contrast can be tuned within the palette; the palette itself is the project.
- **Never add a backend "just in case."** If a feature genuinely needs one, we discuss the architecture first. The current zero-server design is intentional.

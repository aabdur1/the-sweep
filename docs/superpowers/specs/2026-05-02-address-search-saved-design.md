# The Sweep — v3: Address Search & Saved Addresses

**Date:** 2026-05-02
**Owner:** Amir
**Status:** Approved scope, design pending implementation plan
**Builds on:** v1 (port + visual) and v2 (routine pickups)

---

## Goal

Replace the "type the full address and pray" lookup with a **live Google Places typeahead** scoped to Chicago, paired with **localStorage-backed saved addresses** so the daily-use case ("Is sweep tomorrow?") collapses to one tap.

These two features ship together because they reinforce each other: autocomplete is the entry point for new addresses; saved-address chips are the entry point for return visits.

## Why now

- Google Maps autocomplete is the single biggest UX upgrade available — it eliminates address-spelling friction, scopes results to Chicago, and matches the "I check this in the morning" use case the app was designed for.
- Saved addresses is #3–4 on the CLAUDE.md roadmap and pairs naturally: a returning user shouldn't retype anything.
- Most users have 1–3 addresses they care about (home, partner's place, work parking). The save flow has to be effortless or they won't bother.

## Scope

**In v3:**
- Google Places Autocomplete (REST, custom UI matched to the editorial aesthetic).
- Google Geocoding fallback when a place is selected (for lat/lon).
- Local fallback to current Census/Nominatim chain when the API key is missing or the request fails — the app still works without Google.
- Saved addresses: explicit save, list of chips above the input, optional rename label, delete button per chip.
- Recently-looked-up suggestions in the dropdown (last 3, not necessarily saved).
- Privacy: addresses never leave the browser.

**Out of v3:**
- Push notifications (#2 on roadmap).
- Snow route status (#2 on the v3 features-list — separate spec).
- Live sweeper tracker.
- Multi-address comparison views.
- Map preview of the address.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Provider | **Google Places API + Geocoding** | Best autocomplete in the city; $200/mo free credit covers expected volume |
| Integration | **REST endpoints, custom UI** | Matches the broadsheet aesthetic; smaller bundle than Google's drop-in widget |
| API-key delivery | `VITE_GOOGLE_MAPS_API_KEY` env var, built into the bundle, **HTTP-referrer restricted** | Standard for client-side Maps; referrer restriction prevents key abuse from other origins |
| Fallback | If key missing or request fails → existing Census/Nominatim chain | App works in local dev without a key; degrades gracefully |
| Save trigger | **Explicit "Save this address" button** after a successful lookup | Implicit ("save everything you searched") leaks privacy and clutters; explicit puts the user in control |
| Save storage | **localStorage**, JSON-serialized | Per CLAUDE.md privacy rule (no server). Tiny payload (<1KB for ~10 saves) |
| Save labeling | Optional, defaults to the cleaned address; rename inline | Forcing "Home" / "Work" labels adds friction |
| Save limit | 10 (cap to prevent localStorage bloat) | More than 10 means the user has unusual needs and should reconsider |
| Suggestion ordering | Saved first (chips), then "Recently looked up" (dropdown), then Google suggestions | Matches likely user intent; saved is highest-signal |
| Recents storage | Last 3 lookups in localStorage, separate from saves | Recents are ephemeral, saves are explicit; mixing them confuses the UI |
| Layout | Chips above the input; dropdown below the input on focus | Chips visible without focus = one-tap recall; dropdown reveals only when needed |

## Data sources

### Google Places API (New) — Autocomplete

- **Endpoint:** `POST https://places.googleapis.com/v1/places:autocomplete`
- **Headers:** `X-Goog-Api-Key: <key>`, `Content-Type: application/json`
- **Body:** `{ input: <user query>, locationBias: { circle: { center: { latitude: 41.8781, longitude: -87.6298 }, radius: 30000 } }, includedPrimaryTypes: ['street_address'], languageCode: 'en' }` — Loop, 30km radius covers all of Chicago.
- **Returns:** `{ suggestions: [{ placePrediction: { placeId, text: { text }, structuredFormat: { mainText, secondaryText } } }] }`
- **Session tokens:** for billing efficiency, generate one session token per typing session and reuse until a place is selected. Google bills per session, not per keystroke.

### Google Places API (New) — Place Details

- After a place is selected from autocomplete, fetch coordinates:
- **Endpoint:** `GET https://places.googleapis.com/v1/places/{placeId}?fields=location&key=<key>`
- **Returns:** `{ location: { latitude, longitude } }`
- This becomes the input to the existing `lookupZone` / `lookupRecycling` / `lookupGarbage` chain.

### LocalStorage shapes

```ts
// localStorage key: 'sweep.savedAddresses'
interface SavedAddress {
  id: string;          // crypto.randomUUID()
  label: string;       // user-editable; defaults to the address
  query: string;       // the cleaned input string
  lat: number;
  lon: number;
  savedAt: number;     // Date.now() — used for sort tiebreak only
}

// localStorage key: 'sweep.recentLookups'
interface RecentLookup {
  query: string;       // cleaned input
  lat: number;
  lon: number;
  lookedUpAt: number;
}
// Capped at 3 entries, FIFO eviction.
```

## Architecture

```
chi-street-sweep/
└── src/
    ├── types.ts                    (extended: SavedAddress, RecentLookup, GooglePlace)
    ├── lib/
    │   ├── geocode.ts              (extended: try Google first if key present, fall through)
    │   ├── googlePlaces.ts         NEW — autocomplete + place details REST helpers
    │   ├── savedAddresses.ts       NEW — localStorage CRUD for saves
    │   ├── recentLookups.ts        NEW — localStorage CRUD for recents
    │   └── ...                     (unchanged)
    ├── hooks/
    │   ├── useLookup.ts            (extended: writes recent on success; consumes saved/recent on dispatch)
    │   ├── useAddressSearch.ts     NEW — autocomplete state machine (input → debounced query → suggestions)
    │   └── useSavedAddresses.ts    NEW — reactive wrapper over savedAddresses storage
    └── components/
        ├── AddressInput.tsx        (rebuilt: live dropdown, debounced query, keyboard nav)
        ├── SavedAddressChips.tsx   NEW — chip row above the input
        ├── SaveAddressPrompt.tsx   NEW — small "Save this address" button shown after a successful lookup
        └── ...                     (unchanged)
```

### Data flow

```
User types in AddressInput
    │
    ▼
useAddressSearch (debounced 250ms)
    │
    ├─→ googlePlaces.autocomplete(query, sessionToken)
    │       (only if VITE_GOOGLE_MAPS_API_KEY is set)
    │
    └─→ recentLookups.search(query) (always; instant local filter)

Suggestions render in dropdown:
   1. Saved addresses (chip row, always visible above input)
   2. Recent lookups matching query (dropdown top)
   3. Google suggestions (dropdown bottom)

User selects a suggestion (chip, recent, or Google)
    │
    ▼
useLookup.lookupByPlaceId(placeId) | lookupByAddress(query)
    │
    ├─→ if placeId: googlePlaces.getDetails(placeId) → { lat, lon }
    └─→ else fall back to existing geocode() chain
    │
    ▼
existing chain: lookupZone + lookupRecycling + lookupGarbage in parallel
    │
    ▼
LookupResult (unchanged shape)
    │
    ▼
useLookup writes to recentLookups.add(query, lat, lon)
    │
    ▼
SaveAddressPrompt renders a small "Save this address" button below the result hero
```

### Boundaries

- **`lib/googlePlaces.ts`** is the only place Google APIs are touched. Pure async functions; no React, no localStorage.
- **`lib/savedAddresses.ts`** and **`lib/recentLookups.ts`** are localStorage façades — pure read/write/list/clear, no React.
- **`useAddressSearch`** owns autocomplete state (debounce, current suggestions, session token). Doesn't touch the lookup chain — that stays in `useLookup`.
- **`useSavedAddresses`** is a reactive wrapper that subscribes to a `storage` event so multiple tabs stay in sync.

### API key strategy

- **Env var:** `VITE_GOOGLE_MAPS_API_KEY` (Vite-prefixed → bundled into client at build time).
- **Restrictions on the GCP key:**
  - **HTTP referrers:** `https://sweep.amirabdurrahim.com/*`, `https://*.netlify.app/*` (preview deploys), `http://localhost:5173/*` (local dev).
  - **API restrictions:** Places API (New) + Geocoding API only. Disable everything else on the key.
  - **Quotas:** set a daily cap (e.g. 1000 requests/day) below the free-tier ceiling, so a runaway loop or a leaked key can't generate a real bill.
- **Missing-key behavior:** `lib/googlePlaces.ts` exposes an `isConfigured()` helper. Components fall back gracefully — no autocomplete dropdown, the input becomes plain text, search uses Census/Nominatim. Local dev works without setup.

## UI: AddressInput rebuild

**Layout (mobile-first, max-width ~600px stays):**

```
✦ Section I — Lookup                                Form CDS-01

[ Home ★ ]  [ Work ★ ]  [ Mom's place ★ ]   ← Saved chips
                                                ← (only if any are saved)

┌───────────────────────────────────────────┐
│ Re:  1819 S Cal█                          │
└───────────────────────────────────────────┘
   ↳ Recent: 2245 W Belmont Ave              ← Recent matches first
   ↳ 1819 S California Ave   · Pilsen        ← Google suggestions
   ↳ 1819 S Calumet Ave      · Bronzeville
   ↳ 1819 S Calhoun St       · …

         [   Find my schedule  →   ]
              [  Or use current position  ]
```

- **Chips:** sharp rectangles, `border-2 border-ink`, mono uppercase label, ChicagoStar marker. Tap = instant lookup. Long-press / right-click = rename or delete (mobile via small "edit" icon on hover/focus).
- **Dropdown:** appears on input focus, hides on blur. Each suggestion = single-line serif main text + italic mono secondary text (neighborhood). Keyboard nav (↑/↓/Enter) supported.
- **No autocomplete = no dropdown.** Input degrades to current behavior; submit still works.

**SaveAddressPrompt:** a small mono button right under `NextSweepHero`, "★ Save this address". On click: opens a tiny inline form with a label input and "Save" / "Cancel". After saving, the button is replaced with "★ Saved as 'Home'" and a small "edit" link.

**No popups, no modals.** Everything is inline so the broadsheet flow stays uninterrupted.

## Risks and gotchas

- **API key abuse.** Even with referrer restrictions, leaked keys can be tested from automated tools. The quota cap is the real safety net.
- **Session token misuse.** Forgetting to bind a session token across all autocomplete calls in one session inflates billing. The `useAddressSearch` hook owns the token and resets it on selection.
- **Places API (New) vs legacy.** Google has two Places APIs; we use the **new** one (`places.googleapis.com/v1`). The legacy `maps.googleapis.com/maps/api/place/*` is being phased out.
- **Quota misconfigured at deploy.** If the GCP project doesn't have billing enabled, the API silently returns errors. The fallback behavior (Census/Nominatim) covers this, but the autocomplete UX is missing without warning. Add a one-time console warning when `isConfigured()` is true but the first call fails — this surfaces the misconfiguration to the developer (not the end user).
- **localStorage in private browsing.** iOS Safari's private mode silently fails localStorage writes. Saves won't persist; the app still works. Acceptable.
- **Concurrent edits across tabs.** Two tabs of the app could both modify saves. Mitigated by the `storage` event listener in `useSavedAddresses` — last write wins, both tabs re-render.
- **Address normalization.** A saved "1819 S California Ave" and a Google suggestion of "1819 S California Avenue, Chicago, IL 60608, USA" could be the same place but stored differently. Mitigation: the saved record stores the **cleaned input string** plus the resolved **lat/lon**; matching on lat/lon (not string) prevents duplicate saves.

## Open items deferred to the implementation plan

- Whether to use Google's Places JavaScript SDK (drop-in but bigger) vs raw REST (custom but lean) — currently planned: REST. Implementation can revisit if REST UX is too clunky.
- Exact debounce timing (250ms is a reasonable default; tune in implementation).
- Keyboard accessibility (↑/↓ navigation, Enter, Esc) — implementation detail, follow ARIA combobox pattern.
- Whether to surface Google's `placeId` in saved records (lets us re-fetch if coordinates ever go stale; vs. simpler payload). Default: no, store lat/lon only — the city's polygon datasets are stable enough.
- Visual treatment of the saved-address chips when there are zero saves (empty state hint? hide entirely?). Default: hide entirely until first save.

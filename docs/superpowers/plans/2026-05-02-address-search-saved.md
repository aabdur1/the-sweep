# Address Search & Saved Addresses — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "type and pray" lookup with Google Places autocomplete (typeahead, Chicago-scoped), plus localStorage-backed saved addresses and recent-lookup history. Falls back to the existing Census/Nominatim chain when the API key is missing or fails.

**Architecture:** A new `googlePlaces` lib hits Places API (New) REST endpoints. Two localStorage façades (`savedAddresses`, `recentLookups`) own persistence. A new `useAddressSearch` hook drives the dropdown with a debounced query + session token. `useLookup` gains `lookupByPlaceId` and writes a recent on every successful resolve. The `AddressInput` component is rebuilt around an ARIA combobox pattern with a chip row for saves above it.

**Tech Stack:** Same as v1+v2 (Vite + React 18 + TS + Tailwind). New external dependency: Google Places API (New). No new npm packages.

**Spec:** `docs/superpowers/specs/2026-05-02-address-search-saved-design.md`

**Note on testing:** No automated tests (consistent with v1/v2). Verification is manual: type "1819 S Cal" → live dropdown shows Chicago suggestions → select → ward 25 §03 + Mondays/Yellow + Fridays as before. Saved chips persist across reload.

**Working directory:** All paths relative to `/Users/amirabdurrahim/repos/chi-street-sweep/`.

**Prereq (user-side, already done as of 2026-05-02):** GCP project created, Places API (New) + Geocoding API enabled, API key issued and HTTP-referrer-restricted, `VITE_GOOGLE_MAPS_API_KEY` set in Netlify env.

---

## Task 1: Type extensions

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Append new types to `src/types.ts`**

Find the existing exports and add at the end of the file (before the constants):

```ts
// ─── v3: address search + saved ───────────────────────────────────────────

export interface SavedAddress {
  id: string;
  label: string;
  query: string;
  lat: number;
  lon: number;
  savedAt: number;
}

export interface RecentLookup {
  query: string;
  lat: number;
  lon: number;
  lookedUpAt: number;
}

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceLocation {
  lat: number;
  lon: number;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): SavedAddress, RecentLookup, PlaceSuggestion, PlaceLocation"
```

---

## Task 2: localStorage façades

**Files:**
- Create: `src/lib/savedAddresses.ts`
- Create: `src/lib/recentLookups.ts`

Two thin wrappers around localStorage. Both swallow errors silently (private browsing on iOS Safari can throw). Both emit a synthetic `storage` event on writes so a same-tab `useSavedAddresses` listener fires immediately.

- [ ] **Step 1: Create `src/lib/savedAddresses.ts`**

```ts
import type { SavedAddress } from '../types';

const KEY = 'sweep.savedAddresses';
const LIMIT = 10;
const COORD_EQ = (a: number, b: number) => Math.abs(a - b) < 1e-5;

const safeRead = (): SavedAddress[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedAddress[];
  } catch {
    return [];
  }
};

const safeWrite = (next: SavedAddress[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  } catch {
    /* private mode */
  }
};

export const list = (): SavedAddress[] => safeRead();

export const exists = (lat: number, lon: number): SavedAddress | undefined =>
  safeRead().find((s) => COORD_EQ(s.lat, lat) && COORD_EQ(s.lon, lon));

export const add = (
  entry: Omit<SavedAddress, 'id' | 'savedAt'>
): SavedAddress => {
  const all = safeRead();
  // De-dupe by coordinates (rounded to ~1m precision).
  const dup = all.find((s) => COORD_EQ(s.lat, entry.lat) && COORD_EQ(s.lon, entry.lon));
  if (dup) return dup;
  const created: SavedAddress = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  const next = [created, ...all].slice(0, LIMIT);
  safeWrite(next);
  return created;
};

export const rename = (id: string, label: string): void => {
  safeWrite(safeRead().map((s) => (s.id === id ? { ...s, label } : s)));
};

export const remove = (id: string): void => {
  safeWrite(safeRead().filter((s) => s.id !== id));
};

export const STORAGE_KEY = KEY;
```

- [ ] **Step 2: Create `src/lib/recentLookups.ts`**

```ts
import type { RecentLookup } from '../types';

const KEY = 'sweep.recentLookups';
const LIMIT = 3;

const safeRead = (): RecentLookup[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentLookup[];
  } catch {
    return [];
  }
};

const safeWrite = (next: RecentLookup[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  } catch {
    /* ignore */
  }
};

export const list = (): RecentLookup[] => safeRead();

export const record = (entry: Omit<RecentLookup, 'lookedUpAt'>): void => {
  const all = safeRead();
  // De-dupe by query (case-insensitive) — recent search re-pushes to front.
  const filtered = all.filter(
    (r) => r.query.toLowerCase() !== entry.query.toLowerCase()
  );
  const next: RecentLookup[] = [
    { ...entry, lookedUpAt: Date.now() },
    ...filtered,
  ].slice(0, LIMIT);
  safeWrite(next);
};

export const STORAGE_KEY = KEY;
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/savedAddresses.ts src/lib/recentLookups.ts
git commit -m "feat(storage): savedAddresses + recentLookups localStorage façades"
```

---

## Task 3: Google Places lib

**Files:**
- Create: `src/lib/googlePlaces.ts`

Uses Places API (New) REST endpoints. Field masks (`X-Goog-FieldMask`) are required and control which billing SKU we hit. We request only what we need to keep cost in the cheapest tier.

- [ ] **Step 1: Create `src/lib/googlePlaces.ts`**

```ts
import type { PlaceSuggestion, PlaceLocation } from '../types';

const KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '') as string;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = (id: string) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

// Loop, Chicago — center for the 30km bias circle.
const CHICAGO_CENTER = { latitude: 41.8781, longitude: -87.6298 };
const BIAS_RADIUS_M = 30000;

export const isConfigured = (): boolean => KEY.length > 0;

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
      text?: { text: string };
    };
  }>;
}

export const autocomplete = async (
  input: string,
  sessionToken: string
): Promise<PlaceSuggestion[]> => {
  if (!isConfigured()) return [];
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const body = {
    input: trimmed,
    sessionToken,
    locationBias: {
      circle: { center: CHICAGO_CENTER, radius: BIAS_RADIUS_M },
    },
    includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
    languageCode: 'en',
    regionCode: 'us',
  };

  const resp = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return [];

  const data = (await resp.json()) as AutocompleteResponse;
  const suggestions: PlaceSuggestion[] = [];
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p) continue;
    const main =
      p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
    const secondary = p.structuredFormat?.secondaryText?.text ?? '';
    if (!main) continue;
    suggestions.push({ placeId: p.placeId, mainText: main, secondaryText: secondary });
  }
  return suggestions;
};

interface PlaceDetailsResponse {
  location?: { latitude: number; longitude: number };
}

export const getPlaceLocation = async (
  placeId: string,
  sessionToken: string
): Promise<PlaceLocation | null> => {
  if (!isConfigured()) return null;
  const url = PLACE_DETAILS_URL(placeId);
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'location',
      // Reuse the autocomplete session token here — Google bills the
      // autocomplete + details pair as one session in the cheapest tier.
      'X-Goog-Spark-Session-Token': sessionToken,
    },
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as PlaceDetailsResponse;
  if (!data.location) return null;
  return { lat: data.location.latitude, lon: data.location.longitude };
};

/**
 * Generate a session token. Google docs recommend UUIDs; reuse the same token
 * across all autocomplete calls AND the corresponding details call within one
 * "session" (one user looking for one address).
 */
export const newSessionToken = (): string => crypto.randomUUID();
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/googlePlaces.ts
git commit -m "feat(googlePlaces): autocomplete + place details (REST, session-token billed)"
```

---

## Task 4: Extend geocode with Google as primary

**Files:**
- Modify: `src/lib/geocode.ts`

The existing chain is Census → Nominatim. Insert Google Places as the new primary when a place ID is available, but keep the address-string path (Census/Nominatim) for direct submits and as a fallback when Google fails.

- [ ] **Step 1: Replace `src/lib/geocode.ts`**

```ts
import type { GeocodeResult } from '../types';
import { cleanAddress } from './address';
import { isConfigured as googleIsConfigured, getPlaceLocation } from './googlePlaces';

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
    display: `${cleaned}, Chicago`,
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
      display: `${cleaned}, Chicago`,
    };
  }
  return null;
};

/**
 * Resolve coordinates by Google place ID — the path used after autocomplete
 * selection. Returns null on any failure so the caller falls back.
 */
export const geocodeByPlaceId = async (
  placeId: string,
  display: string,
  sessionToken: string
): Promise<GeocodeResult | null> => {
  if (!googleIsConfigured()) return null;
  const loc = await getPlaceLocation(placeId, sessionToken);
  if (!loc) return null;
  return { lat: loc.lat, lon: loc.lon, display };
};

/** String-based geocode chain — used when no Google place ID is available. */
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
git commit -m "feat(geocode): add geocodeByPlaceId for Google Places integration"
```

---

## Task 5: `useAddressSearch` hook

**Files:**
- Create: `src/hooks/useAddressSearch.ts`

Owns the typeahead state machine: input → debounced query (250ms) → suggestions. Holds one session token for the lifetime of a search session and resets it after a place is selected.

- [ ] **Step 1: Create `src/hooks/useAddressSearch.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaceSuggestion } from '../types';
import { autocomplete, isConfigured, newSessionToken } from '../lib/googlePlaces';

const DEBOUNCE_MS = 250;

export interface UseAddressSearchApi {
  query: string;
  setQuery: (v: string) => void;
  suggestions: PlaceSuggestion[];
  isSearching: boolean;
  hasGoogle: boolean;
  /** Returns the current session token so the consumer can pair it with the
   *  follow-up Place Details call before resetting. */
  getSessionToken: () => string;
  /** Call after the user selects a suggestion (or cancels). Resets the token
   *  so the next session starts fresh. */
  resetSession: () => void;
}

export const useAddressSearch = (): UseAddressSearchApi => {
  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');

  const setQuery = useCallback((v: string) => {
    setQueryState(v);
    lastQueryRef.current = v;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isConfigured() || v.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const captured = lastQueryRef.current;
      const results = await autocomplete(captured, sessionTokenRef.current);
      // Drop stale results if the user has typed more since.
      if (captured === lastQueryRef.current) {
        setSuggestions(results);
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  const getSessionToken = useCallback(() => sessionTokenRef.current, []);

  // Cleanup pending debounce on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isSearching,
    hasGoogle: isConfigured(),
    getSessionToken,
    resetSession,
  };
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/hooks/useAddressSearch.ts
git commit -m "feat(useAddressSearch): debounced typeahead with session-token reuse"
```

---

## Task 6: `useSavedAddresses` hook

**Files:**
- Create: `src/hooks/useSavedAddresses.ts`

Reactive wrapper over `lib/savedAddresses`. Subscribes to the `storage` event so changes from another tab (or the synthetic same-tab event we dispatch) re-render.

- [ ] **Step 1: Create `src/hooks/useSavedAddresses.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import type { SavedAddress } from '../types';
import * as saved from '../lib/savedAddresses';

export interface UseSavedAddressesApi {
  saved: SavedAddress[];
  isSaved: (lat: number, lon: number) => SavedAddress | undefined;
  save: (entry: Omit<SavedAddress, 'id' | 'savedAt'>) => SavedAddress;
  rename: (id: string, label: string) => void;
  remove: (id: string) => void;
}

export const useSavedAddresses = (): UseSavedAddressesApi => {
  const [list, setList] = useState<SavedAddress[]>(() => saved.list());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === saved.STORAGE_KEY) setList(saved.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    saved: list,
    isSaved: useCallback(saved.exists, []),
    save: useCallback((entry) => {
      const created = saved.add(entry);
      setList(saved.list());
      return created;
    }, []),
    rename: useCallback((id, label) => {
      saved.rename(id, label);
      setList(saved.list());
    }, []),
    remove: useCallback((id) => {
      saved.remove(id);
      setList(saved.list());
    }, []),
  };
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/hooks/useSavedAddresses.ts
git commit -m "feat(useSavedAddresses): reactive wrapper over saved-address localStorage"
```

---

## Task 7: Extend `useLookup` with placeId path + recents

**Files:**
- Modify: `src/hooks/useLookup.ts`

Add a `lookupByPlaceId` method (used after autocomplete selection) and write a recent on every successful resolve.

- [ ] **Step 1: Replace `src/hooks/useLookup.ts`**

```ts
import { useCallback, useState } from 'react';
import type { LookupStatus, LookupResult } from '../types';
import { geocode, geocodeByPlaceId } from '../lib/geocode';
import { lookupZone } from '../lib/zones';
import { fetchSchedule } from '../lib/schedule';
import { lookupRecycling } from '../lib/recycling';
import { lookupGarbage } from '../lib/garbage';
import * as recents from '../lib/recentLookups';

export interface UseLookupApi {
  status: LookupStatus;
  result: LookupResult | null;
  error: string | null;
  isLoading: boolean;
  isLocating: boolean;
  lookup: (address: string) => Promise<void>;
  lookupByCoords: (lat: number, lon: number, displayOverride?: string) => Promise<void>;
  lookupByPlaceId: (placeId: string, displayLabel: string, sessionToken: string) => Promise<void>;
  startLocating: () => void;
  reset: () => void;
}

export const useLookup = (): UseLookupApi => {
  const [status, setStatus] = useState<LookupStatus>({ kind: 'idle' });

  const finalize = useCallback(
    async (lat: number, lon: number, display: string) => {
      const zone = await lookupZone(lat, lon);
      const [dates, recycling, garbage] = await Promise.all([
        fetchSchedule(zone.ward, zone.section),
        lookupRecycling(lat, lon).catch(() => null),
        lookupGarbage(lat, lon).catch(() => null),
      ]);
      const result: LookupResult = {
        ward: zone.ward,
        section: zone.section,
        dates,
        display,
        coords: { lat, lon },
        recycling,
        garbage,
      };
      recents.record({ query: display, lat, lon });
      setStatus({ kind: 'done', result });
    },
    []
  );

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
        await finalize(coords.lat, coords.lon, display || displayOverride || address);
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message || 'Something went wrong.' });
      }
    },
    [finalize]
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

  const lookupByPlaceId = useCallback(
    async (placeId: string, displayLabel: string, sessionToken: string) => {
      setStatus({ kind: 'loading' });
      try {
        const g = await geocodeByPlaceId(placeId, displayLabel, sessionToken);
        if (!g) {
          // Fall back to string geocode using the displayed label.
          await runLookup(null, null, displayLabel);
          return;
        }
        await finalize(g.lat, g.lon, g.display);
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message || 'Something went wrong.' });
      }
    },
    [finalize, runLookup]
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
    lookupByPlaceId,
    startLocating,
    reset,
  };
};
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/hooks/useLookup.ts
git commit -m "feat(useLookup): lookupByPlaceId + recent-lookup recording"
```

---

## Task 8: Saved-address chips + save prompt components

**Files:**
- Create: `src/components/SavedAddressChips.tsx`
- Create: `src/components/SaveAddressPrompt.tsx`

- [ ] **Step 1: Create `src/components/SavedAddressChips.tsx`**

```tsx
import { X } from 'lucide-react';
import type { SavedAddress } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  saved: SavedAddress[];
  onPick: (s: SavedAddress) => void;
  onRemove: (id: string) => void;
}

export const SavedAddressChips = ({ saved, onPick, onRemove }: Props) => {
  if (saved.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {saved.map((s) => (
        <div
          key={s.id}
          className="inline-flex items-center border-2 border-ink bg-cream-dark"
        >
          <button
            onClick={() => onPick(s)}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-ink hover:text-cream transition-colors"
          >
            <ChicagoStar size={9} />
            <span className="truncate max-w-[12ch]">{s.label}</span>
          </button>
          <button
            onClick={() => onRemove(s.id)}
            aria-label={`Remove ${s.label}`}
            className="border-l-2 border-ink px-1.5 py-1.5 text-ink-soft hover:bg-chicago-red hover:text-cream transition-colors"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Create `src/components/SaveAddressPrompt.tsx`**

```tsx
import { useState } from 'react';
import type { SavedAddress, LookupResult } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  result: LookupResult;
  existingSave: SavedAddress | undefined;
  onSave: (label: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export const SaveAddressPrompt = ({ result, existingSave, onSave, onRename, onRemove }: Props) => {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(existingSave?.label ?? result.display);

  if (existingSave && !editing) {
    return (
      <div className="mx-5 mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
        <ChicagoStar size={9} className="text-chicago-blue" />
        <span>Saved as <em className="font-serif not-italic text-ink">{existingSave.label}</em></span>
        <button onClick={() => setEditing(true)} className="underline hover:text-ink">edit</button>
        <button onClick={() => onRemove(existingSave.id)} className="underline hover:text-chicago-red">remove</button>
      </div>
    );
  }

  if (editing && existingSave) {
    return (
      <form
        className="mx-5 mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRename(existingSave.id, label.trim() || existingSave.label);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          className="flex-1 border-2 border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] bg-cream"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="bg-ink text-cream px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="border border-ink px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Cancel</button>
      </form>
    );
  }

  if (editing) {
    return (
      <form
        className="mx-5 mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label.trim() || result.display);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          className="flex-1 border-2 border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] bg-cream"
          placeholder="Label, e.g. Home / Work"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="bg-ink text-cream px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="border border-ink px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Cancel</button>
      </form>
    );
  }

  return (
    <div className="mx-5 mt-3">
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase text-ink hover:bg-ink hover:text-cream transition-colors"
      >
        <ChicagoStar size={9} /> Save this address
      </button>
    </div>
  );
};
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/components/SavedAddressChips.tsx src/components/SaveAddressPrompt.tsx
git commit -m "feat(components): SavedAddressChips + SaveAddressPrompt"
```

---

## Task 9: Rebuild `AddressInput` with autocomplete dropdown

**Files:**
- Modify: `src/components/AddressInput.tsx`

The new layout: a chip row above (rendered by parent in App), the existing form panel, and inside the panel a dropdown that appears on input focus. Keyboard navigation (↑/↓/Enter/Esc) supported.

- [ ] **Step 1: Replace `src/components/AddressInput.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Loader2, Navigation, ArrowRight } from 'lucide-react';
import type { PlaceSuggestion, RecentLookup } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  query: string;
  setQuery: (v: string) => void;
  onSubmitText: () => void;
  onSelectPlace: (s: PlaceSuggestion) => void;
  onSelectRecent: (r: RecentLookup) => void;
  onUseLocation: () => void;
  loading: boolean;
  locating: boolean;
  isSearching: boolean;
  suggestions: PlaceSuggestion[];
  recents: RecentLookup[];
  hasGoogle: boolean;
}

type ComboItem =
  | { kind: 'recent'; r: RecentLookup }
  | { kind: 'place'; s: PlaceSuggestion };

export const AddressInput = ({
  query,
  setQuery,
  onSubmitText,
  onSelectPlace,
  onSelectRecent,
  onUseLocation,
  loading,
  locating,
  isSearching,
  suggestions,
  recents,
  hasGoogle,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const recentMatches = recents.filter((r) =>
    query.length < 2 ? true : r.query.toLowerCase().includes(query.toLowerCase())
  );
  const items: ComboItem[] = [
    ...recentMatches.map((r) => ({ kind: 'recent' as const, r })),
    ...suggestions.map((s) => ({ kind: 'place' as const, s })),
  ];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setHighlight(-1); }, [items.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter') onSubmitText();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < items.length) {
        const it = items[highlight];
        if (it.kind === 'place') onSelectPlace(it.s);
        else onSelectRecent(it.r);
        setOpen(false);
      } else {
        onSubmitText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <section className="px-5 pt-7" ref={containerRef}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
          <ChicagoStar size={9} /> Section I
        </span>
        <span className="flex-1 border-b border-ink/30" />
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
          Lookup · 01
        </span>
      </div>

      <div className="border-2 border-ink relative" style={{ background: '#FAF4E0' }}>
        <div className="absolute -top-px right-4 bg-cream border-x border-b border-ink px-2 py-0.5 font-mono text-[8.5px] tracking-[0.25em] uppercase text-ink-soft">
          Form CDS-01
        </div>

        <div className="p-5 pt-6">
          <label className="block">
            <span className="block font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft mb-2">
              Street Address — Chicago, IL
            </span>
            <span className="flex items-baseline border-b-2 border-ink pb-1 relative">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-chicago-red mr-3 select-none">Re:</span>
              <input
                type="text"
                role="combobox"
                aria-expanded={open && items.length > 0}
                aria-controls="address-suggestions"
                aria-autocomplete="list"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="1819 S California Ave"
                className="flex-1 bg-transparent outline-none font-serif text-[22px] text-ink placeholder:text-ink/30 leading-tight"
                autoComplete="off"
              />
              {isSearching && <Loader2 size={14} className="animate-spin text-ink-soft ml-2" />}
            </span>
          </label>

          {open && items.length > 0 && (
            <ul
              id="address-suggestions"
              role="listbox"
              className="mt-2 border border-ink/40 bg-cream divide-y divide-ink/20"
            >
              {items.map((it, i) => {
                const isHl = i === highlight;
                if (it.kind === 'recent') {
                  return (
                    <li
                      key={`r-${it.r.query}`}
                      role="option"
                      aria-selected={isHl}
                      onMouseDown={(e) => { e.preventDefault(); onSelectRecent(it.r); setOpen(false); }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${isHl ? 'bg-ink text-cream' : ''}`}
                    >
                      <span className={`font-mono text-[8px] tracking-[0.25em] uppercase ${isHl ? 'text-cream/70' : 'text-chicago-red'}`}>Recent</span>
                      <span className="font-serif text-[15px]">{it.r.query}</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={`p-${it.s.placeId}`}
                    role="option"
                    aria-selected={isHl}
                    onMouseDown={(e) => { e.preventDefault(); onSelectPlace(it.s); setOpen(false); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`px-3 py-2 cursor-pointer flex flex-col ${isHl ? 'bg-ink text-cream' : ''}`}
                  >
                    <span className="font-serif text-[15px] leading-tight">{it.s.mainText}</span>
                    {it.s.secondaryText && (
                      <span className={`font-mono text-[10px] tracking-[0.15em] mt-0.5 ${isHl ? 'text-cream/60' : 'text-ink-soft'}`}>
                        {it.s.secondaryText}
                      </span>
                    )}
                  </li>
                );
              })}
              {hasGoogle && (
                <li className="px-3 py-1.5 font-mono text-[8px] tracking-[0.25em] uppercase text-ink-soft text-right">
                  Powered by Google
                </li>
              )}
            </ul>
          )}

          <button
            onClick={onSubmitText}
            disabled={loading || !query.trim()}
            className="mt-5 w-full py-3.5 font-mono text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-40 bg-ink text-cream hover:bg-chicago-red"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Searching the registry…</>
            ) : (
              <><ChicagoStar size={11} /> Find my schedule <ArrowRight size={14} strokeWidth={2.5} /></>
            )}
          </button>

          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1 border-t border-ink/40" />
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">Or</span>
            <span className="flex-1 border-t border-ink/40" />
          </div>

          <button
            onClick={onUseLocation}
            disabled={locating || loading}
            className="mt-3 w-full py-2.5 border-2 border-ink font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 text-ink hover:bg-ink hover:text-cream transition-colors"
          >
            {locating ? (
              <><Loader2 size={12} className="animate-spin" /> Locating…</>
            ) : (
              <><Navigation size={12} strokeWidth={2.5} /> Use current position</>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean — but App.tsx will be broken because the props shape changed completely. That's fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddressInput.tsx
git commit -m "feat(AddressInput): autocomplete dropdown, recents, ARIA combobox"
```

---

## Task 10: Wire everything in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useLookup } from './hooks/useLookup';
import { useAddressSearch } from './hooks/useAddressSearch';
import { useSavedAddresses } from './hooks/useSavedAddresses';
import { startOfDay } from './lib/dates';
import { generateICS, generateRoutineICS } from './lib/ics';
import { list as listRecents } from './lib/recentLookups';
import { SCHEDULE_YEAR } from './types';
import type { PlaceSuggestion, RecentLookup, SavedAddress } from './types';
import { Masthead } from './components/Masthead';
import { AddressInput } from './components/AddressInput';
import { SavedAddressChips } from './components/SavedAddressChips';
import { SaveAddressPrompt } from './components/SaveAddressPrompt';
import { ErrorPanel } from './components/ErrorPanel';
import { NextSweepHero } from './components/NextSweepHero';
import { RoutinePickups } from './components/RoutinePickups';
import { ScheduleAlmanac } from './components/ScheduleAlmanac';
import { Footnotes } from './components/Footnotes';
import { HowItWorks } from './components/HowItWorks';
import { ChicagoStar } from './components/ChicagoStar';
import './index.css';

export default function App() {
  const search = useAddressSearch();
  const savedHook = useSavedAddresses();
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, lookupByPlaceId, startLocating, reset } = useLookup();
  const [recents, setRecents] = useState<RecentLookup[]>(() => listRecents());

  const refreshRecents = () => setRecents(listRecents());

  const handleSubmitText = () => {
    if (!search.query.trim()) return;
    void lookup(search.query).then(refreshRecents);
  };

  const handleSelectPlace = (s: PlaceSuggestion) => {
    const label = `${s.mainText}${s.secondaryText ? ', ' + s.secondaryText : ''}`;
    search.setQuery(s.mainText);
    void lookupByPlaceId(s.placeId, label, search.getSessionToken()).then(() => {
      search.resetSession();
      refreshRecents();
    });
  };

  const handleSelectRecent = (r: RecentLookup) => {
    search.setQuery(r.query);
    void lookupByCoords(r.lat, r.lon, r.query).then(refreshRecents);
  };

  const handlePickSaved = (s: SavedAddress) => {
    search.setQuery(s.label);
    void lookupByCoords(s.lat, s.lon, s.label).then(refreshRecents);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude).then(refreshRecents),
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

  const existingSave = result ? savedHook.isSaved(result.coords.lat, result.coords.lon) : undefined;

  return (
    <div className="min-h-screen grain bg-cream text-ink">
      <div className="max-w-xl mx-auto bg-cream">
        <Masthead />

        <div className="px-5 pt-6">
          <SavedAddressChips
            saved={savedHook.saved}
            onPick={handlePickSaved}
            onRemove={savedHook.remove}
          />
        </div>

        <AddressInput
          query={search.query}
          setQuery={search.setQuery}
          onSubmitText={handleSubmitText}
          onSelectPlace={handleSelectPlace}
          onSelectRecent={handleSelectRecent}
          onUseLocation={handleUseLocation}
          loading={isLoading}
          locating={isLocating}
          isSearching={search.isSearching}
          suggestions={search.suggestions}
          recents={recents}
          hasGoogle={search.hasGoogle}
        />

        {error && <ErrorPanel message={error} onDismiss={reset} />}
        {result && (
          <>
            <NextSweepHero next={next} ward={result.ward} section={result.section} />
            <SaveAddressPrompt
              result={result}
              existingSave={existingSave}
              onSave={(label) => savedHook.save({ label, query: result.display, lat: result.coords.lat, lon: result.coords.lon })}
              onRename={savedHook.rename}
              onRemove={savedHook.remove}
            />
            <RoutinePickups
              recycling={result.recycling}
              garbage={result.garbage}
              onDownload={handleRoutineDownload}
            />
            <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
            <Footnotes address={result.display} />
          </>
        )}
        {!result && !error && <HowItWorks />}
        <footer className="border-t-2 border-ink mt-2">
          <div className="border-t border-ink mt-[2px]" />
          <div className="px-5 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
            </div>
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
              Built in Chicago · End of edition
            </div>
            <div className="font-serif italic text-[11px] text-ink-soft mt-1">— ⬩ —</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and build**

```bash
npm run typecheck
npm run build
```

Both must pass.

- [ ] **Step 3: Smoke test in dev**

Start dev server. Three things to check:

1. **Typeahead works:** type "1819 S Cal" — within ~250ms a dropdown appears with Chicago suggestions (assuming the API key is set in your local `.env.local` for dev — if not, no dropdown shows but the form still works).
2. **Selection completes:** click a suggestion → schedule renders as before.
3. **Saved chips:** after a successful lookup, click "Save this address", give it a label, hit Save. Reload the page. The chip appears above the input. Click it → instant lookup.

For local dev, the Google API key needs to be in `.env.local`:

```bash
echo "VITE_GOOGLE_MAPS_API_KEY=<your-key>" > .env.local
```

`.env.local` is gitignored by default in Vite scaffolds. **Do not commit it.**

If the key isn't in `.env.local`, the autocomplete dropdown gracefully hides itself; everything else still works.

- [ ] **Step 4: Commit (visual milestone)**

```bash
git add src/App.tsx
git commit -m "feat(app): wire autocomplete + saved addresses + recents into composition"
```

---

## Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the geocoder section**

Find the "### 3. Geocoders (multi-provider chain)" subsection and replace its content with:

```markdown
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
```

- [ ] **Step 2: Add a new section under Data sources**

After "### 5. ArcGIS layers (recycling + garbage)", append:

```markdown
### 6. localStorage façades (saved addresses + recents)

- `lib/savedAddresses.ts` — `sweep.savedAddresses` key, capped at 10, de-duped by lat/lon (~1m precision).
- `lib/recentLookups.ts` — `sweep.recentLookups` key, capped at 3, FIFO with re-push on repeat search.
- Writes dispatch a synthetic `storage` event so same-tab subscribers (`useSavedAddresses`) re-render.
- Failures are silent (iOS Safari private mode throws on `setItem`; the app degrades gracefully).
- **Privacy:** addresses never leave the browser. CLAUDE.md "never store on a server" rule still holds — localStorage is local.
```

- [ ] **Step 3: Update the file structure tree**

Find the `lib/` and `hooks/` and `components/` subtrees, add the new files in alphabetical order:

```
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

- [ ] **Step 4: Update the roadmap**

Find "### Specced, awaiting implementation" and move v3 to "### Shipped":

```diff
  ### Shipped
  - **v1 — Vite + TS + Tailwind port** with the bold civic broadsheet visual direction.
  - **PWA** — installable on iOS/Android via vite-plugin-pwa.
  - **v2 — Routine pickups** (recycling + garbage). Holiday-shift detection. Two-`.ics` export.
+ - **v3 — Google Places autocomplete + saved addresses + recents** with localStorage persistence and graceful Census/Nominatim fallback.

- ### Specced, awaiting implementation
- - **v3 — Google Places autocomplete + saved addresses** (`docs/superpowers/specs/2026-05-02-address-search-saved-design.md`). Live typeahead scoped to Chicago, localStorage saves, recents. Falls back to Census/Nominatim if no API key.
-
  ### Backlog (in rough priority order)
```

- [ ] **Step 5: Verify**

```bash
grep -n "googlePlaces\|VITE_GOOGLE_MAPS_API_KEY\|SavedAddressChips\|useAddressSearch" CLAUDE.md
```

Expected: ≥4 matches.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document v3 Google Places + saved addresses architecture"
```

---

## Task 12: Live verification & deploy

**Files:** none modified — runtime check only.

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```

Netlify auto-deploys. Wait ~90 seconds for the build to land.

- [ ] **Step 2: Verify on the live site**

Open https://sweep.amirabdurrahim.com on a real browser (not curl — the autocomplete needs a JS runtime).

Checks:
1. **Type "1819 S Cal"** in the address field. A dropdown should appear within ~300ms with Chicago suggestions including "1819 S California Ave".
2. **Click the suggestion.** The full schedule renders: ward 25 §03, Mondays Yellow week, Fridays.
3. **Click "Save this address"**, label it "Home", hit Save. The button changes to "Saved as Home".
4. **Reload the page** (`Cmd+R`). The chip "★ HOME" appears above the input. Click it. Instant lookup.
5. **Type a new address**, lookup, then look at the dropdown after clearing — your previous lookups should appear under "Recent".
6. **Open DevTools → Network**. Verify `places.googleapis.com/v1/places:autocomplete` calls return 200. If they 403, the key restrictions are wrong — go fix them in GCP Console.

If anything fails, debug. Common issues:
- `403 REQUEST_DENIED`: HTTP referrer restriction on the key doesn't include `https://sweep.amirabdurrahim.com/*`. Fix in GCP.
- `400 INVALID_ARGUMENT` with "API key not valid": environment variable not set in Netlify, or the build was triggered before the env var was added. Trigger a new deploy.
- Dropdown never appears: check that `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` is non-empty in the production bundle (`grep -c VITE_GOOGLE_MAPS dist/assets/*.js`).

- [ ] **Step 3: Optional — add to home screen on phone**

If you have your phone handy: open `sweep.amirabdurrahim.com` in Safari, share → Add to Home Screen. The icon should be the Chicago star on cream. Open the installed app, type your address, verify everything works. The PWA was set up in v1; this is just a sanity check that nothing in v3 broke offline / standalone mode.

- [ ] **Step 4: Final commit (only if any fixes were applied during verification)**

If verification surfaced issues that needed code fixes, commit them. Otherwise this task is just a smoke check — no commit needed.

---

## Self-review (author)

**Spec coverage:**
- Google Places autocomplete (REST, Chicago-biased, session-token billed) → Tasks 3 + 5.
- Place details for selected suggestions → Task 3 (`getPlaceLocation`) + Task 7 (`lookupByPlaceId`).
- Fallback chain (Google → Census → Nominatim) → Tasks 4 + 7.
- Saved addresses (localStorage, ≤10, de-dup by lat/lon) → Tasks 2 + 6.
- Recent lookups (localStorage, ≤3, FIFO with re-push) → Task 2 (façade) + Task 7 (record on success).
- Saved-chips UI above input → Task 8 + Task 10.
- "Save this address" inline form below hero → Task 8 + Task 10.
- ARIA combobox dropdown with ↑/↓/Enter/Esc → Task 9.
- "Powered by Google" attribution → Task 9 (last list item).
- API-key restrictions documented in CLAUDE.md → Task 11.
- Live verification + auto-deploy → Task 12.
- Privacy preserved (addresses never leave browser) → enforced by localStorage-only persistence; no network call carries saves.

**Placeholder scan:** None. Each step has either complete code, a precise edit instruction, or a verifiable bash command.

**Type consistency:**
- `SavedAddress` / `RecentLookup` / `PlaceSuggestion` / `PlaceLocation` defined in Task 1, consumed identically in Tasks 2, 3, 5, 6, 8, 9, 10.
- `useLookup` API extended in Task 7 (`lookupByPlaceId`); consumed in Task 10 with matching signature `(placeId, displayLabel, sessionToken) => Promise<void>`.
- `useAddressSearch` API in Task 5 (`getSessionToken()`, `resetSession()`) — consumed in Task 10's `handleSelectPlace` to grab and reset the session.
- `STORAGE_KEY` re-exported from `savedAddresses.ts` (Task 2) and consumed in `useSavedAddresses.ts` (Task 6) for the storage event filter.

**Build sequence sanity:** Task 9 (`AddressInput` rebuild) breaks `App.tsx` because props changed entirely. Task 10 fixes it. Both ship in two commits — typecheck might fail between commits 9 and 10 but the working tree always has a path forward. (If preferred, an executor could squash 9+10; the plan keeps them separate so the diffs stay reviewable.)

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

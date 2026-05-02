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

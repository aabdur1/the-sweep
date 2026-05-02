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

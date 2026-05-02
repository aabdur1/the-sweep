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

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

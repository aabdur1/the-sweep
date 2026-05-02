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
  // Reuse the autocomplete session token via query param — Places API (New)
  // bills autocomplete + details as one session in the cheapest tier when
  // the same sessionToken appears on both calls.
  const url = `${PLACE_DETAILS_URL(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'location',
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

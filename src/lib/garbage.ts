import type { GarbageInfo, DayOfWeek } from '../types';
import { ARCGIS_GARBAGE_LAYER } from '../types';
import { nextDayOfWeek } from './dates';

interface GarbageFeature {
  attributes: {
    DAY?: string;
    DIVISION?: string;
    SAN_DAY?: string;
  };
}

interface ArcGISResponse {
  features?: GarbageFeature[];
}

const DAY_FROM_FULL: Record<string, DayOfWeek> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
};

const buildQueryUrl = (lat: number, lon: number): string => {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ARCGIS_GARBAGE_LAYER}/query?${params.toString()}`;
};

export const lookupGarbage = async (
  lat: number,
  lon: number
): Promise<GarbageInfo | null> => {
  const resp = await fetch(buildQueryUrl(lat, lon));
  if (!resp.ok) return null;
  const data = (await resp.json()) as ArcGISResponse;
  const feature = data.features?.[0];
  if (!feature) return null;
  const attrs = feature.attributes;
  const dayFull = attrs.DAY ?? '';
  const day = DAY_FROM_FULL[dayFull];
  if (!day) return null;
  return {
    day,
    division: attrs.DIVISION ?? '',
    nextPickup: nextDayOfWeek(day),
  };
};

import type { RecyclingInfo } from '../types';
import { ARCGIS_RECYCLING_LAYER } from '../types';
import { decodeAreaDetail, isPickupWeek } from './recyclingDecode';
import { nextDayOfWeek, weekIndexFrom2026, startOfDay } from './dates';

interface RecyclingFeature {
  attributes: {
    SERVICE_AREA?: number;
    AREA_DETAIL?: string;
    VENDOR?: string;
    URL_PDF?: string;
  };
}

interface ArcGISResponse {
  features?: RecyclingFeature[];
}

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
  return `${ARCGIS_RECYCLING_LAYER}/query?${params.toString()}`;
};

export const lookupRecycling = async (
  lat: number,
  lon: number
): Promise<RecyclingInfo | null> => {
  const resp = await fetch(buildQueryUrl(lat, lon));
  if (!resp.ok) return null;
  const data = (await resp.json()) as ArcGISResponse;
  const feature = data.features?.[0];
  if (!feature) return null;
  const attrs = feature.attributes;
  const detail = attrs.AREA_DETAIL ?? '';
  const decoded = decodeAreaDetail(detail);
  if (!decoded.day || !decoded.weekColor) return null;

  // Compute next pickup: next occurrence of `day` that falls in a pickup week.
  const today = startOfDay(new Date());
  const candidate = nextDayOfWeek(decoded.day, today);
  for (let i = 0; i < 4; i++) {
    if (isPickupWeek(weekIndexFrom2026(candidate), decoded.weekColor)) break;
    candidate.setDate(candidate.getDate() + 7);
  }

  return {
    day: decoded.day,
    weekColor: decoded.weekColor,
    serviceArea: decoded.serviceArea ?? attrs.SERVICE_AREA ?? -1,
    vendor: decoded.vendor ?? attrs.VENDOR ?? '',
    rawAreaDetail: detail,
    pdfUrl: attrs.URL_PDF ?? null,
    nextPickup: candidate,
  };
};

import type { ZoneInfo } from '../types';
import { ZONES_DATASET_ID_CURRENT, ZONES_DATASET_ID_FALLBACK } from '../types';

const BASE = 'https://data.cityofchicago.org/resource';

interface ZoneRow {
  ward: string;
  section: string;
}

const fetchZone = async (datasetId: string, lon: number, lat: number): Promise<ZoneRow | null> => {
  const point = `POINT(${lon} ${lat})`;
  const url = `${BASE}/${datasetId}.json?$where=intersects(the_geom,'${point}')&$limit=1`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = (await resp.json()) as ZoneRow[];
  return data.length ? data[0] : null;
};

export const lookupZone = async (lat: number, lon: number): Promise<ZoneInfo> => {
  let row = await fetchZone(ZONES_DATASET_ID_CURRENT, lon, lat);
  if (!row) row = await fetchZone(ZONES_DATASET_ID_FALLBACK, lon, lat);
  if (!row) throw new Error("That address isn't inside a Chicago street sweeping zone.");
  return {
    ward: String(row.ward).padStart(2, '0'),
    section: String(row.section).padStart(2, '0'),
  };
};

import type { DayOfWeek, WeekColor } from '../types';

/**
 * 2026 anchor: the city's Blue Cart calendar PDF for 2026 shows that the week
 * starting Mon Jan 5, 2026 was a YELLOW pickup week (verify against the schedule
 * PDF linked from the ArcGIS layer's URL_PDF field). Anchor at week index 0.
 *
 * If the user reports the week color is wrong on launch day, flip this constant.
 */
const ANCHOR_WEEK_INDEX_IS_YELLOW = true;

const DAY_CODE: Record<string, DayOfWeek> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri',
};

const COLOR_CODE: Record<string, WeekColor> = {
  YLW: 'Yellow', ORG: 'Orange',
};

export interface DecodedAreaDetail {
  day: DayOfWeek | null;
  weekColor: WeekColor | null;
  weekLetter: 'A' | 'B' | null;
  serviceArea: number | null;
  vendor: string | null;
}

/** Robust dash-segment parser: order varies; identify each segment by shape. */
export const decodeAreaDetail = (raw: string): DecodedAreaDetail => {
  const segments = raw.split('-').map((s) => s.trim());
  const out: DecodedAreaDetail = {
    day: null, weekColor: null, weekLetter: null, serviceArea: null, vendor: null,
  };
  for (const seg of segments) {
    // "4IN" / "12OUT" — service area number
    const areaMatch = /^(\d+)(IN|OUT)?$/.exec(seg);
    if (areaMatch) {
      out.serviceArea = parseInt(areaMatch[1], 10);
      continue;
    }
    // "WK A" / "WK B"
    const weekMatch = /^WK\s*(A|B)$/.exec(seg);
    if (weekMatch) {
      out.weekLetter = weekMatch[1] as 'A' | 'B';
      continue;
    }
    if (seg in COLOR_CODE) {
      out.weekColor = COLOR_CODE[seg];
      continue;
    }
    if (seg in DAY_CODE) {
      out.day = DAY_CODE[seg];
      continue;
    }
    // Anything else is the vendor (e.g. CTY, WMI, RES).
    if (!out.vendor) out.vendor = seg;
  }
  return out;
};

/**
 * Determine whether `weekIdx` is a pickup week for an address with `weekColor`.
 * Even week indices are Yellow when ANCHOR_WEEK_INDEX_IS_YELLOW = true.
 */
export const isPickupWeek = (
  weekIdx: number,
  weekColor: WeekColor
): boolean => {
  const evenIsYellow = ANCHOR_WEEK_INDEX_IS_YELLOW;
  const weekIsYellow = (weekIdx % 2 === 0) === evenIsYellow;
  return weekIsYellow === (weekColor === 'Yellow');
};

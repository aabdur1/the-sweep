import type {
  LookupResult,
  ScheduleEntry,
  DayOfWeek,
} from '../types';
import { startOfDay, weekIndexFrom2026 } from './dates';
import { isPickupWeek } from './recyclingDecode';
import { findUpcomingShift } from './holidays';

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

/**
 * Generate every garbage pickup date for `year`, applying any holiday shifts
 * that fall in the same calendar week as a candidate pickup day.
 */
const buildGarbageEntries = (
  day: DayOfWeek,
  year: number
): ScheduleEntry[] => {
  const out: ScheduleEntry[] = [];
  const targetIdx = DAY_INDEX[day];
  const cursor = startOfDay(new Date(year, 0, 1));
  const end = new Date(year, 11, 31);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getDay() === targetIdx) {
      const original = new Date(cursor);
      const shift = findUpcomingShift(day, original);
      if (shift) {
        const sundayOfOriginal = new Date(original);
        sundayOfOriginal.setDate(original.getDate() - original.getDay());
        const shiftSunday = new Date(shift.shift.date);
        shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
        if (sundayOfOriginal.getTime() === shiftSunday.getTime()) {
          out.push({
            type: 'garbage',
            date: shift.shiftedDate,
            shiftedFrom: { date: original, holidayName: shift.shift.name },
          });
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
      }
      out.push({ type: 'garbage', date: original });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/**
 * Generate every recycling pickup date for `year`, applying holiday shifts
 * the same way garbage does (a yellow-week Monday shifts forward when the
 * holiday lands earlier in the week).
 */
const buildRecyclingEntries = (
  day: DayOfWeek,
  weekColor: 'Yellow' | 'Orange',
  year: number
): ScheduleEntry[] => {
  const out: ScheduleEntry[] = [];
  const targetIdx = DAY_INDEX[day];
  const cursor = startOfDay(new Date(year, 0, 1));
  const end = new Date(year, 11, 31);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getDay() === targetIdx) {
      const original = new Date(cursor);
      if (isPickupWeek(weekIndexFrom2026(original), weekColor)) {
        const shift = findUpcomingShift(day, original);
        let actual = original;
        if (shift) {
          const sundayOfOriginal = new Date(original);
          sundayOfOriginal.setDate(original.getDate() - original.getDay());
          const shiftSunday = new Date(shift.shift.date);
          shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
          if (sundayOfOriginal.getTime() === shiftSunday.getTime()) {
            actual = shift.shiftedDate;
          }
        }
        out.push({ type: 'recycling', date: actual, weekColor });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/**
 * Build the unified almanac for the address — every sweep / recycling / garbage
 * date for the full calendar year, sorted ascending by date.
 *
 * Recycling and garbage are skipped when their lookup didn't return data
 * (rare; ArcGIS misses or unconfigured). Sweep is always included from
 * `result.dates` whether or not the season is in progress.
 */
export const buildAlmanac = (
  result: LookupResult,
  year: number
): ScheduleEntry[] => {
  const sweep: ScheduleEntry[] = result.dates.map((d) => ({
    type: 'sweep',
    date: d.date,
    sideLabel: d.sideLabel,
    pairIdx: d.pairIdx,
  }));

  const recycling = result.recycling
    ? buildRecyclingEntries(result.recycling.day, result.recycling.weekColor, year)
    : [];

  const garbage = result.garbage ? buildGarbageEntries(result.garbage.day, year) : [];

  const all = [...sweep, ...recycling, ...garbage];
  all.sort((a, b) => a.date.getTime() - b.date.getTime());
  return all;
};

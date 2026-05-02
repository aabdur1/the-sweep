import type { DayOfWeek, HolidayShift } from '../types';
import { startOfDay } from './dates';

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

interface HolidayEntry {
  date: [number, number, number]; // [year, monthIdx, day]
  name: string;
}

const HOLIDAYS_2026: HolidayEntry[] = [
  { date: [2026, 0, 1],   name: "New Year's Day" },
  { date: [2026, 0, 19],  name: 'Martin Luther King Jr. Day' },
  { date: [2026, 1, 16],  name: "Presidents' Day" },
  { date: [2026, 4, 25],  name: 'Memorial Day' },
  { date: [2026, 5, 19],  name: 'Juneteenth' },
  { date: [2026, 6, 3],   name: 'Independence Day (observed)' },
  { date: [2026, 8, 7],   name: 'Labor Day' },
  { date: [2026, 9, 12],  name: 'Columbus Day' },
  { date: [2026, 10, 11], name: 'Veterans Day' },
  { date: [2026, 10, 26], name: 'Thanksgiving' },
  { date: [2026, 11, 25], name: 'Christmas' },
];

const dayName = (idx: number): string =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx];

const buildShift = (entry: HolidayEntry): HolidayShift => {
  const [y, m, d] = entry.date;
  const holidayDate = startOfDay(new Date(y, m, d));
  const holidayDow = holidayDate.getDay();

  return {
    date: holidayDate,
    name: entry.name,
    affectedDescription: dayName(holidayDow) + ' onward shifts forward one day',
    resolveShift: (originalDay: DayOfWeek): Date | null => {
      const targetIdx = DAY_INDEX[originalDay];
      // Affected only if targetIdx is in the holiday's week and >= holidayDow.
      if (targetIdx < holidayDow || targetIdx > 5) return null;

      // Find that pickup's original date in the holiday's calendar week.
      const sundayOfWeek = new Date(holidayDate);
      sundayOfWeek.setDate(holidayDate.getDate() - holidayDow);
      const original = new Date(sundayOfWeek);
      original.setDate(sundayOfWeek.getDate() + targetIdx);
      const shifted = new Date(original);
      shifted.setDate(original.getDate() + 1);
      return shifted;
    },
  };
};

const SHIFTS_2026: HolidayShift[] = HOLIDAYS_2026
  .filter((h) => {
    const dow = new Date(h.date[0], h.date[1], h.date[2]).getDay();
    return dow >= 1 && dow <= 5; // Mon–Fri only
  })
  .map(buildShift);

/**
 * Find the next holiday shift affecting `serviceDay`, on or after `from`.
 * Returns null if none in scope (~next 8 weeks).
 *
 * TODO: refresh HOLIDAYS_2026 each year from chicago.gov's "Holiday Garbage
 * Schedule" page; rename and bump the year.
 */
export const findUpcomingShift = (
  serviceDay: DayOfWeek,
  from: Date = new Date()
): { shift: HolidayShift; shiftedDate: Date } | null => {
  const fromTime = startOfDay(from).getTime();
  const horizonMs = 8 * 7 * 24 * 60 * 60 * 1000; // 8 weeks
  for (const shift of SHIFTS_2026) {
    if (shift.date.getTime() < fromTime) continue;
    if (shift.date.getTime() > fromTime + horizonMs) break;
    const shifted = shift.resolveShift(serviceDay);
    if (shifted) return { shift, shiftedDate: shifted };
  }
  return null;
};

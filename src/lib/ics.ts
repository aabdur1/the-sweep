import type { SweepDate, RecyclingInfo, GarbageInfo, DayOfWeek } from '../types';
import { findUpcomingShift } from './holidays';
import { weekIndexFrom2026, startOfDay } from './dates';
import { isPickupWeek } from './recyclingDecode';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const HORIZON_DAYS = 90;
const DAY_INDEX: Record<DayOfWeek, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };

const beginCalendar = (prodId: string): string[] => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:-//Chicago Sweep//${prodId}//EN`,
  'CALSCALE:GREGORIAN',
];

const emitEvent = (
  lines: string[],
  d: Date,
  uid: string,
  summary: string,
  description: string,
  alarmMessage: string
): void => {
  const next = new Date(d); next.setDate(next.getDate() + 1);
  lines.push(
    'BEGIN:VEVENT',
    `UID:${uid}@chicago-sweep`,
    `DTSTAMP:${fmtICS(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${fmtICS(d)}`,
    `DTEND;VALUE=DATE:${fmtICS(next)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT12H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${alarmMessage}`,
    'END:VALARM',
    'END:VEVENT'
  );
};

const finalize = (lines: string[]): string => {
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

export const generateICS = (dates: SweepDate[], ward: string, section: string): string => {
  const lines = beginCalendar('Sweep');
  dates.forEach((entry, i) => {
    const d = entry.date;
    emitEvent(
      lines,
      d,
      `sweep-${ward}-${section}-${i}-${fmtICS(d)}`,
      `MOVE CAR — Street sweeping (Ward ${ward} §${section})`,
      `Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
      'Move car — street sweeping tomorrow'
    );
  });
  return finalize(lines);
};

const dayMatches = (d: Date, day: DayOfWeek): boolean => d.getDay() === DAY_INDEX[day];

const datesForDay = (day: DayOfWeek, days: number): Date[] => {
  const out: Date[] = [];
  const cursor = startOfDay(new Date());
  for (let i = 0; i < days; i++) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    if (dayMatches(d, day)) out.push(d);
  }
  return out;
};

const applyShiftIfAny = (d: Date, day: DayOfWeek): Date => {
  const shift = findUpcomingShift(day, d);
  if (!shift) return d;
  // Only swap if the shift's holiday is in the same calendar week as `d`.
  const sundayOfD = new Date(d);
  sundayOfD.setDate(d.getDate() - d.getDay());
  const shiftSunday = new Date(shift.shift.date);
  shiftSunday.setDate(shift.shift.date.getDate() - shift.shift.date.getDay());
  return sundayOfD.getTime() === shiftSunday.getTime() ? shift.shiftedDate : d;
};

export const generateRoutineICS = (
  recycling: RecyclingInfo | null,
  garbage: GarbageInfo | null
): string => {
  const lines = beginCalendar('Routine');

  if (recycling) {
    for (const d of datesForDay(recycling.day, HORIZON_DAYS)) {
      if (!isPickupWeek(weekIndexFrom2026(d), recycling.weekColor)) continue;
      const actual = applyShiftIfAny(d, recycling.day);
      emitEvent(
        lines,
        actual,
        `recycling-${recycling.serviceArea}-${fmtICS(actual)}`,
        `Recycling — ${recycling.weekColor} week`,
        `Blue cart recycling (${recycling.weekColor} week\\, biweekly).`,
        'Set out blue cart tomorrow'
      );
    }
  }
  if (garbage) {
    for (const d of datesForDay(garbage.day, HORIZON_DAYS)) {
      const actual = applyShiftIfAny(d, garbage.day);
      emitEvent(
        lines,
        actual,
        `garbage-${garbage.division}-${fmtICS(actual)}`,
        'Garbage pickup',
        `Black cart garbage (weekly\\, division ${garbage.division}).`,
        'Set out black cart tomorrow'
      );
    }
  }
  return finalize(lines);
};

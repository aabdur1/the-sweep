import type { ScheduleEntry, ScheduleType } from '../types';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const beginCalendar = (): string[] => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Chicago Sweep//EN',
  'CALSCALE:GREGORIAN',
];

const finalize = (lines: string[]): string => {
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

const emitEvent = (
  lines: string[],
  d: Date,
  uid: string,
  summary: string,
  description: string,
  alarmMessage: string
): void => {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
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

const sweepEvent = (
  lines: string[],
  d: Date,
  ward: string,
  section: string,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `sweep-${ward}-${section}-${i}-${fmtICS(d)}`,
    `[SWEEP] MOVE CAR — Ward ${ward} §${section}`,
    `Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
    'Move car — street sweeping tomorrow'
  );

const recyclingEvent = (
  lines: string[],
  d: Date,
  weekColor: string,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `recycling-${weekColor}-${i}-${fmtICS(d)}`,
    `[RECYCLE] ${weekColor} week pickup`,
    `Blue cart recycling (${weekColor} week\\, biweekly).`,
    'Set out blue cart tomorrow'
  );

const garbageEvent = (
  lines: string[],
  d: Date,
  shifted: boolean,
  i: number
): void =>
  emitEvent(
    lines,
    d,
    `garbage-${i}-${fmtICS(d)}`,
    `[GARBAGE] Pickup${shifted ? ' (holiday shift)' : ''}`,
    `Black cart garbage (weekly${shifted ? '\\, holiday-shifted' : ''}).`,
    'Set out black cart tomorrow'
  );

/**
 * Build a single VCALENDAR blob URL containing every entry whose type is in `filter`.
 * Returns the blob URL (caller is responsible for `URL.revokeObjectURL`).
 */
export const generateICS = (
  entries: ScheduleEntry[],
  filter: Set<ScheduleType>,
  ward: string,
  section: string
): string => {
  const lines = beginCalendar();
  entries.forEach((entry, i) => {
    if (!filter.has(entry.type)) return;
    if (entry.type === 'sweep') {
      sweepEvent(lines, entry.date, ward, section, i);
    } else if (entry.type === 'recycling') {
      recyclingEvent(lines, entry.date, entry.weekColor, i);
    } else {
      garbageEvent(lines, entry.date, !!entry.shiftedFrom, i);
    }
  });
  return finalize(lines);
};

const TYPE_ORDER: ScheduleType[] = ['sweep', 'recycling', 'garbage'];

/**
 * Build the download filename for a filtered .ics export.
 *   all three: chicago-schedule-W25S03-2026.ics
 *   subset:    chicago-garbage-recycling-W25S03-2026.ics  (alphabetical)
 *   single:    chicago-sweep-W25S03-2026.ics
 */
export const buildICSFilename = (
  filter: Set<ScheduleType>,
  ward: string,
  section: string,
  year: number
): string => {
  const types = TYPE_ORDER.filter((t) => filter.has(t));
  const all = types.length === 3;
  const slug = all
    ? 'schedule'
    : [...types].sort().join('-');
  return `chicago-${slug}-W${ward}S${section}-${year}.ics`;
};

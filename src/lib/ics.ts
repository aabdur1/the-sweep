import type { SweepDate } from '../types';

const pad = (n: number): string => String(n).padStart(2, '0');
const fmtICS = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export const generateICS = (dates: SweepDate[], ward: string, section: string): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chicago Sweep//EN',
    'CALSCALE:GREGORIAN',
  ];
  dates.forEach((entry, i) => {
    const d = entry.date;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:sweep-${ward}-${section}-${i}-${fmtICS(d)}@chicago-sweep`,
      `DTSTAMP:${fmtICS(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${fmtICS(d)}`,
      `DTEND;VALUE=DATE:${fmtICS(next)}`,
      `SUMMARY:MOVE CAR — Street sweeping (Ward ${ward} §${section})`,
      `DESCRIPTION:Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Move car — street sweeping tomorrow',
      'END:VALARM',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

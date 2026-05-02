import type { SweepDate, Side } from '../types';
import { SCHEDULE_YEAR, SCHEDULE_DATASET_ID } from '../types';

interface ScheduleRow {
  ward_section_concatenated: string;
  ward: string;
  section: string;
  month_name: string;
  month_number: string;
  dates: string;
}

export const fetchSchedule = async (ward: string, section: string): Promise<SweepDate[]> => {
  const url = `https://data.cityofchicago.org/resource/${SCHEDULE_DATASET_ID}.json?ward=${ward}&section=${section}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Schedule service is unavailable. Try again in a moment.');
  const rows = (await resp.json()) as ScheduleRow[];

  const dates: SweepDate[] = [];
  rows.forEach((row) => {
    const month = parseInt(row.month_number, 10);
    const days = String(row.dates)
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    days.forEach((day, idx) => {
      const sideLabel: Side = idx === 0 ? 'A' : 'B';
      const pairIdx = (idx === 0 ? 0 : 1) as 0 | 1;
      dates.push({
        date: new Date(SCHEDULE_YEAR, month - 1, day),
        sideLabel,
        pairIdx,
      });
    });
  });
  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return dates;
};

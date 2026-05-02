import type { DayOfWeek } from '../types';

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const daysFromToday = (target: Date): number => {
  const today = startOfDay(new Date());
  const t = startOfDay(target);
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions): string =>
  d.toLocaleDateString('en-US', opts);

export const dayOfWeek = (d: Date): string => fmt(d, { weekday: 'long' });
export const dayShort = (d: Date): string => fmt(d, { weekday: 'short' });
export const monthName = (d: Date): string => fmt(d, { month: 'long' });
export const monthShort = (d: Date): string => fmt(d, { month: 'short' });

const DAY_INDEX: Record<DayOfWeek, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5,
};

/**
 * The next date whose weekday matches `day`, on or after `from`.
 * If `from` already falls on `day`, returns `from` (start-of-day).
 */
export const nextDayOfWeek = (day: DayOfWeek, from: Date = new Date()): Date => {
  const target = DAY_INDEX[day];
  const start = startOfDay(from);
  const todayIdx = start.getDay();
  const delta = (target - todayIdx + 7) % 7;
  const result = new Date(start);
  result.setDate(start.getDate() + delta);
  return result;
};

const EPOCH_MONDAY = (() => {
  // First Monday of 2026.
  const d = new Date(2026, 0, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return startOfDay(d);
})();

/**
 * Monday-anchored ISO week index of `d`, counted from the first Monday of 2026
 * (= week 0). Used to alternate Yellow/Orange weeks for biweekly recycling.
 */
export const weekIndexFrom2026 = (d: Date): number => {
  const ms = startOfDay(d).getTime() - EPOCH_MONDAY.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
};

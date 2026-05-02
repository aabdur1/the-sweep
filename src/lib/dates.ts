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

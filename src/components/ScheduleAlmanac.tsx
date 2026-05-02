import { useMemo } from 'react';
import { Download } from 'lucide-react';
import type { SweepDate } from '../types';
import { startOfDay, daysFromToday, dayShort, monthShort, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  dates: SweepDate[];
  onDownload: () => void;
}

export const ScheduleAlmanac = ({ dates, onDownload }: Props) => {
  const today = startOfDay(new Date());

  const grouped = useMemo(() => {
    const g: Record<string, { label: string; entries: SweepDate[] }> = {};
    dates.forEach((d) => {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!g[key]) g[key] = { label: monthName(d.date), entries: [] };
      g[key].entries.push(d);
    });
    return Object.values(g);
  }, [dates]);

  return (
    <div className="px-5 mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
            <ChicagoStar size={9} /> Section III
          </div>
          <h3 className="font-serif text-3xl mt-1 text-ink">Full Almanac</h3>
        </div>
        <button
          onClick={onDownload}
          className="border border-ink px-3 py-2 font-mono text-[9px] tracking-[0.2em] uppercase flex items-center gap-1.5 text-ink"
        >
          <Download size={11} /> .ics
        </button>
      </div>
      <div className="border-t-2 border-ink pt-4">
        {grouped.map((group, gi) => (
          <div key={gi} className="mb-6">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 text-ink-soft">
              <span>{group.label}</span>
              <span className="flex-1 border-t border-ink-soft opacity-30" />
              <span>{group.entries.length} dates</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.entries.map((entry, ei) => {
                const isPast = startOfDay(entry.date) < today;
                const isToday = daysFromToday(entry.date) === 0;
                const borderClass = isToday ? 'border-2 border-chicago-red' : 'border border-ink';
                const bg = isToday ? '#FAEBEB' : isPast ? 'transparent' : '#FAF4E0';
                return (
                  <div
                    key={ei}
                    className={`p-3 relative ${borderClass}`}
                    style={{ background: bg, opacity: isPast ? 0.4 : 1 }}
                  >
                    <div className="absolute top-1 right-1.5 font-mono text-[8px] tracking-wider opacity-50 text-ink">
                      Side {entry.sideLabel}
                    </div>
                    <div className={`font-mono text-[9px] tracking-[0.2em] uppercase ${isToday ? 'text-chicago-red' : 'text-ink-soft'}`}>
                      {dayShort(entry.date)}
                    </div>
                    <div className="font-serif text-3xl leading-none mt-0.5 text-ink">
                      {entry.date.getDate()}
                    </div>
                    <div className="font-mono text-[9px] uppercase mt-1 opacity-60 text-ink">
                      {monthShort(entry.date)}
                    </div>
                    {isPast && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono text-[8px] tracking-[0.2em] uppercase rotate-[-12deg] border border-ink-soft px-2 py-0.5 text-ink-soft">
                          Done
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

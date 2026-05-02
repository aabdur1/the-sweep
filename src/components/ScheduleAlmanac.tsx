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

  const upcoming = dates.filter((d) => startOfDay(d.date) >= today).length;

  return (
    <section className="px-5 mt-10">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
            <ChicagoStar size={9} /> Section III
          </div>
          <h3 className="font-serif text-4xl mt-1 text-ink leading-none">Full Almanac</h3>
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-ink-soft mt-2">
            {upcoming} upcoming · {dates.length} total
          </div>
        </div>
        <button
          onClick={onDownload}
          className="border-2 border-ink px-3 py-2 font-mono text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5 text-ink hover:bg-ink hover:text-cream transition-colors"
        >
          <Download size={11} strokeWidth={2.5} /> Filed · .ics
        </button>
      </header>

      {/* Top double-rule */}
      <div className="border-t-2 border-ink" />
      <div className="border-t border-ink mt-[2px] mb-5" />

      {grouped.map((group, gi) => (
        <div key={gi} className="mb-7">
          {/* Editorial month divider */}
          <div className="flex items-baseline gap-3 mb-3">
            <h4 className="font-serif text-2xl text-ink leading-none">{group.label}</h4>
            <span className="flex-1 border-b border-ink/40 mb-1" />
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
              {String(group.entries.length).padStart(2, '0')} dates
            </span>
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
                  style={{ background: bg, opacity: isPast ? 0.5 : 1 }}
                >
                  {/* Side label, top right */}
                  <div className="absolute top-1.5 right-2 font-mono text-[8px] tracking-[0.2em] uppercase text-ink-soft">
                    {entry.sideLabel}
                  </div>

                  {/* Day-of-week */}
                  <div className={`font-mono text-[9px] tracking-[0.25em] uppercase ${isToday ? 'text-chicago-red' : 'text-ink-soft'}`}>
                    {dayShort(entry.date)}
                  </div>

                  {/* Big numeral */}
                  <div className="font-serif text-[42px] leading-none mt-1 text-ink tabular-nums">
                    {entry.date.getDate()}
                  </div>

                  {/* Tiny rule */}
                  <div className="border-t border-ink/30 my-1.5 w-8" />

                  {/* Month + side block */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-ink-soft">
                      {monthShort(entry.date)}
                    </span>
                    <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-ink-soft">
                      Side {entry.sideLabel}
                    </span>
                  </div>

                  {/* Today star */}
                  {isToday && (
                    <ChicagoStar size={10} className="absolute top-1.5 left-2 text-chicago-red" />
                  )}

                  {/* Cancellation stamp for past dates */}
                  {isPast && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span
                        className="font-mono text-[9px] tracking-[0.4em] uppercase text-ink-soft border-2 border-ink-soft px-2 py-0.5 bg-cream/40 backdrop-blur-[1px]"
                        style={{ transform: 'rotate(-12deg)' }}
                      >
                        Swept
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};

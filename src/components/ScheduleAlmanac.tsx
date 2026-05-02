import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { LookupResult, ScheduleEntry, ScheduleType } from '../types';
import { SCHEDULE_YEAR } from '../types';
import { buildAlmanac } from '../lib/buildAlmanac';
import { generateICS, buildICSFilename } from '../lib/ics';
import { startOfDay, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  result: LookupResult;
}

const ALL_TYPES: ScheduleType[] = ['sweep', 'recycling', 'garbage'];
const TYPE_LABELS: Record<ScheduleType, string> = {
  sweep: 'Sweep',
  recycling: 'Recycling',
  garbage: 'Garbage',
};

interface MonthGroup {
  monthIdx: number; // 0-11
  label: string;
  entries: ScheduleEntry[];
}

const groupByMonth = (entries: ScheduleEntry[]): MonthGroup[] => {
  const groups: MonthGroup[] = [];
  for (let m = 0; m < 12; m++) {
    const monthEntries = entries.filter((e) => e.date.getMonth() === m);
    groups.push({
      monthIdx: m,
      label: monthName(new Date(SCHEDULE_YEAR, m, 1)),
      entries: monthEntries,
    });
  }
  return groups;
};

export const ScheduleAlmanac = ({ result }: Props) => {
  const [filter, setFilter] = useState<Set<ScheduleType>>(
    () => new Set<ScheduleType>(ALL_TYPES)
  );

  const allEntries = useMemo(() => buildAlmanac(result, SCHEDULE_YEAR), [result]);
  const filteredEntries = useMemo(
    () => allEntries.filter((e) => filter.has(e.type)),
    [allEntries, filter]
  );
  const months = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);
  const totalCount = filteredEntries.length;
  const monthCount = months.filter((m) => m.entries.length > 0).length;

  const toggle = (t: ScheduleType) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const handleDownload = () => {
    const url = generateICS(filteredEntries, filter, result.ward, result.section);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildICSFilename(filter, result.ward, result.section, SCHEDULE_YEAR);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <section className="px-5 mt-10 lg:px-8 lg:mt-12">
      {/* Header */}
      <header className="mb-4 lg:mb-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5 lg:text-[11px] lg:tracking-[0.35em]">
              <ChicagoStar size={9} /> Section III
            </div>
            <h3 className="font-serif text-4xl mt-1 text-ink leading-none lg:text-6xl lg:mt-2">
              Full Almanac
            </h3>
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-ink-soft mt-2 lg:text-[10px] lg:tracking-[0.35em] lg:mt-3">
              {monthCount} months · {totalCount} dates
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="border-2 border-ink px-3 py-2 font-mono text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5 text-ink hover:bg-ink hover:text-cream transition-colors lg:px-5 lg:py-3 lg:text-[10px]"
            >
              <Printer size={11} strokeWidth={2.5} /> Print
            </button>
            <button
              onClick={handleDownload}
              className="border-2 border-ink px-3 py-2 font-mono text-[9px] tracking-[0.25em] uppercase flex items-center gap-1.5 text-ink hover:bg-ink hover:text-cream transition-colors lg:px-5 lg:py-3 lg:text-[10px]"
            >
              <Download size={11} strokeWidth={2.5} /> .ics
            </button>
          </div>
        </div>

        {/* Filter checkboxes */}
        <div className="flex flex-wrap items-center gap-2 mt-4 print:hidden">
          {ALL_TYPES.map((t) => {
            const on = filter.has(t);
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                aria-pressed={on}
                className={`border-2 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase flex items-center gap-1.5 transition-colors ${
                  on
                    ? 'bg-ink text-cream border-ink'
                    : 'border-ink/40 text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                <ChicagoStar
                  size={9}
                  className={on ? 'text-cream' : 'text-ink-soft'}
                />
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Top double-rule */}
      <div className="border-t-2 border-ink" />
      <div className="border-t border-ink mt-[2px] mb-5" />

      {filter.size === 0 && (
        <div className="font-serif italic text-ink-soft text-center py-8">
          <ChicagoStar size={11} className="text-chicago-red inline-block mr-2" />
          Pick at least one type to see your schedule.
        </div>
      )}

      {filter.size > 0 && (
        <div className="lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
          {months.map((month, gi) => (
            <div
              key={month.monthIdx}
              className={`mb-7 lg:mb-0 ${
                gi % 4 !== 0 ? 'lg:pl-5 lg:border-l lg:border-ink/30' : ''
              } print:break-inside-avoid`}
            >
              <div className="flex items-baseline gap-3 mb-3 lg:flex-col lg:items-start lg:gap-1 lg:mb-4">
                <h4 className="font-serif text-2xl text-ink leading-none lg:text-3xl">
                  {month.label}
                </h4>
                <span className="flex-1 border-b border-ink/40 mb-1 lg:hidden" />
                <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
                  {String(month.entries.length).padStart(2, '0')} dates
                </span>
                <span className="hidden lg:block w-full border-t-2 border-ink mt-2" />
              </div>

              {/* Type rows render in Task 5; placeholder list for now */}
              <div className="font-mono text-[10px] text-ink-soft">
                {month.entries.length === 0 ? '— no dates —' : `${month.entries.length} entries`}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

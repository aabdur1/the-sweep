import { AlertTriangle } from 'lucide-react';
import type { RecyclingInfo, GarbageInfo } from '../types';
import { findUpcomingShift } from '../lib/holidays';
import { dayOfWeek, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  recycling: RecyclingInfo | null;
  garbage: GarbageInfo | null;
}

const dayLong: Record<string, string> = {
  Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays',
  Thu: 'Thursdays', Fri: 'Fridays',
};

const fmtDate = (d: Date): string => `${monthName(d).slice(0, 3)} ${d.getDate()}`;

export const RoutinePickups = ({ recycling, garbage }: Props) => {
  if (!recycling && !garbage) {
    return (
      <section className="mx-5 mt-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-ink-soft flex items-center gap-1.5">
          <ChicagoStar size={9} /> Section II.b — Routine pickups
        </div>
        <div className="border border-ink/40 p-3 text-sm font-mono text-ink-soft italic">
          Routine pickup data unavailable for this address.
        </div>
      </section>
    );
  }

  const recyclingShift = recycling ? findUpcomingShift(recycling.day) : null;
  const garbageShift = garbage ? findUpcomingShift(garbage.day) : null;

  return (
    <section className="mx-5 mt-6 slide-up">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-blue flex items-center gap-1.5">
        <ChicagoStar size={9} /> Section II.b — Routine pickups
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recycling && (
          <article className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
            <ChicagoStar size={10} className="text-chicago-blue mb-2" />
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
              Recycling
            </div>
            <div className="font-serif text-3xl text-ink leading-none mt-1">
              {dayLong[recycling.day]}
            </div>
            <div className="font-serif italic text-chicago-blue text-sm mt-1">
              — {recycling.weekColor} week —
            </div>
            <div className="border-t border-ink/30 mt-3 pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              {recycling.nextPickup ? <>Next · {fmtDate(recycling.nextPickup)}</> : 'Biweekly'}
            </div>
          </article>
        )}
        {garbage && (
          <article className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
            <ChicagoStar size={10} className="text-chicago-blue mb-2" />
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
              Garbage
            </div>
            <div className="font-serif text-3xl text-ink leading-none mt-1">
              {dayLong[garbage.day]}
            </div>
            <div className="font-serif italic text-ink-soft text-sm mt-1">
              every week
            </div>
            <div className="border-t border-ink/30 mt-3 pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
              Next · {fmtDate(garbage.nextPickup)}
            </div>
          </article>
        )}
      </div>

      {(recyclingShift || garbageShift) && (
        <div className="mt-3 border-2 border-chicago-red p-3 flex items-start gap-2" style={{ background: '#FAEBEB' }}>
          <AlertTriangle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-chicago-red" />
          <div className="text-sm leading-snug">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red mb-1">
              Holiday shift
            </div>
            {recyclingShift && (
              <div className="font-serif italic text-ink">
                {recyclingShift.shift.name}: recycling shifts to {dayOfWeek(recyclingShift.shiftedDate)}, {fmtDate(recyclingShift.shiftedDate)}.
              </div>
            )}
            {garbageShift && (
              <div className="font-serif italic text-ink">
                {garbageShift.shift.name}: garbage shifts to {dayOfWeek(garbageShift.shiftedDate)}, {fmtDate(garbageShift.shiftedDate)}.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

import type { SweepDate } from '../types';
import { SCHEDULE_YEAR } from '../types';
import { daysFromToday, dayOfWeek, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';
import { Seal } from './Seal';

interface Props {
  next: SweepDate | null;
  ward: string;
  section: string;
}

const issueDated = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export const NextSweepHero = ({ next, ward, section }: Props) => {
  if (!next) {
    return (
      <div className="mx-5 mt-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-blue flex items-center gap-2">
          <ChicagoStar size={9} /> Section II.a — Status
        </div>
        <div className="border-2 border-ink p-8 text-center relative" style={{ background: 'var(--tint-calm)' }}>
          <Seal size={44} className="absolute top-3 right-3 text-chicago-blue/60" />
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-chicago-blue">
            Season Concluded
          </div>
          <p className="font-serif text-3xl mt-3 text-ink">No more sweeps this year.</p>
          <p className="font-sans text-sm mt-2 text-ink-soft italic">
            Schedule resumes April {SCHEDULE_YEAR + 1}.
          </p>
        </div>
      </div>
    );
  }

  const days = daysFromToday(next.date);
  const isUrgent = days <= 2;
  const accentText = isUrgent ? 'text-chicago-red' : 'text-chicago-blue';
  const accentBg = isUrgent ? 'bg-chicago-red' : 'bg-chicago-blue';
  const accentBorder = isUrgent ? 'border-chicago-red' : 'border-chicago-blue';
  const bg = isUrgent ? 'var(--tint-urgency)' : 'var(--tint-calm)';

  const ticker =
    days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : days < 0 ? `${Math.abs(days)} DAYS AGO` : `IN ${days} DAYS`;

  const dayNum = next.date.getDate();
  const wkday = dayOfWeek(next.date);
  const mname = monthName(next.date);
  const yr = next.date.getFullYear();

  return (
    <section className="mx-5 mt-6 slide-up lg:mx-0 lg:px-5 lg:mt-0 lg:pt-6">
      {/* Section header */}
      <div className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 lg:text-[11px] lg:tracking-[0.35em] ${accentText}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full pulse-dot ${accentBg}`} />
        <ChicagoStar size={9} /> Section II.a — Sweep
      </div>

      {/* Hero broadsheet */}
      <article className="border-2 border-ink relative overflow-hidden" style={{ background: bg }}>
        {/* Corner stars (replacing ◢◣◥◤) */}
        <ChicagoStar size={9} className="absolute top-2 left-2 text-ink/70" />
        <ChicagoStar size={9} className="absolute top-2 right-2 text-ink/70" />
        <ChicagoStar size={9} className="absolute bottom-2 left-2 text-ink/70" />
        <ChicagoStar size={9} className="absolute bottom-2 right-2 text-ink/70" />

        {/* Top edition bar */}
        <div className="border-b border-ink/30 px-5 py-1.5 flex items-center justify-between font-mono text-[8.5px] tracking-[0.25em] uppercase text-ink-soft">
          <span>Issue dated · {issueDated}</span>
          <span className={`flex items-center gap-1.5 ${accentText}`}>
            <ChicagoStar size={7} /> Notice <ChicagoStar size={7} />
          </span>
        </div>

        {/* Date display: giant numeral + stacked day/month/year */}
        <div className="px-6 pt-7 pb-4 flex items-center gap-5 justify-center lg:pt-10 lg:pb-6 lg:gap-8">
          <div className="text-right shrink-0">
            <div
              className="font-serif text-ink leading-[0.82] tabular-nums"
              style={{ fontSize: 'clamp(96px, 22vw, 220px)' }}
            >
              {dayNum}
            </div>
          </div>
          <div className="border-l-2 border-ink self-stretch" />
          <div className="text-left">
            <div
              className="font-serif italic text-ink leading-[0.95]"
              style={{ fontSize: 'clamp(22px, 5vw, 44px)' }}
            >
              {wkday}
            </div>
            <div className="mt-2 font-mono text-[10px] tracking-[0.35em] uppercase text-ink-soft lg:text-[12px] lg:mt-3 lg:tracking-[0.45em]">
              {mname}
            </div>
            <div className="font-mono text-[10px] tracking-[0.35em] uppercase text-ink-soft lg:text-[12px] lg:tracking-[0.45em]">
              · {yr} ·
            </div>
          </div>
        </div>

        {/* Ticker — postmark-style stamped block */}
        <div className="px-5 pb-3">
          <div className={`mx-auto inline-block w-full text-center border-y-2 ${accentBorder} py-2 relative`}>
            <span className={`absolute inset-y-0 left-3 flex items-center font-mono text-[9px] tracking-[0.25em] ${accentText}`}>
              ✕
            </span>
            <span className={`absolute inset-y-0 right-3 flex items-center font-mono text-[9px] tracking-[0.25em] ${accentText}`}>
              ✕
            </span>
            <span className={`font-mono text-[12px] tracking-[0.4em] uppercase ${accentText}`}>
              {ticker}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="px-5 pb-4 text-center lg:pb-6">
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft mb-1 lg:text-[11px] lg:tracking-[0.4em] lg:mb-2">
            — Notice to motorists —
          </div>
          <h3
            data-move-car-headline
            className={`font-serif italic leading-[1] ${isUrgent ? 'text-chicago-red' : 'text-ink'}`}
            style={{ fontSize: 'clamp(36px, 7.5vw, 76px)' }}
          >
            Move your car.
          </h3>
        </div>

        {/* Ward + Section bar */}
        <div className="border-t-2 border-ink grid grid-cols-2 divide-x-2 divide-ink">
          <div className="px-5 py-3 text-center lg:py-5">
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft lg:text-[11px] lg:tracking-[0.4em]">Ward</div>
            <div className="font-serif text-4xl text-ink leading-none mt-1 tabular-nums lg:text-5xl lg:mt-2">{ward}</div>
          </div>
          <div className="px-5 py-3 text-center lg:py-5">
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft lg:text-[11px] lg:tracking-[0.4em]">Section</div>
            <div className="font-serif text-4xl text-ink leading-none mt-1 tabular-nums lg:text-5xl lg:mt-2">§ {section}</div>
          </div>
        </div>
      </article>
    </section>
  );
};

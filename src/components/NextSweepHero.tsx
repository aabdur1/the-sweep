import type { SweepDate } from '../types';
import { SCHEDULE_YEAR } from '../types';
import { daysFromToday, dayOfWeek, monthName } from '../lib/dates';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  next: SweepDate | null;
  ward: string;
  section: string;
}

export const NextSweepHero = ({ next, ward, section }: Props) => {
  if (!next) {
    return (
      <div className="mx-5 mt-6 border-2 border-chicago-blue p-6 text-center" style={{ background: '#E5F4FB' }}>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-blue">
          Season Concluded
        </div>
        <p className="font-serif text-2xl mt-2 text-ink">No more sweeps this year.</p>
        <p className="text-sm mt-1 text-ink-soft">Schedule resumes April {SCHEDULE_YEAR + 1}.</p>
      </div>
    );
  }
  const days = daysFromToday(next.date);
  const isUrgent = days <= 2;
  const accentClass = isUrgent ? 'text-chicago-red' : 'text-chicago-blue';
  const accentBorderClass = isUrgent ? 'border-chicago-red' : 'border-chicago-blue';
  const bg = isUrgent ? '#FAEBEB' : '#E5F4FB';
  const headline =
    days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : days < 0 ? `${Math.abs(days)} days ago` : `In ${days} days`;

  return (
    <div className="mx-5 mt-6 slide-up">
      <div className={`font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2 ${accentClass}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full pulse-dot ${isUrgent ? 'bg-chicago-red' : 'bg-chicago-blue'}`} />
        <ChicagoStar size={9} /> Section II — Your Next Sweep
      </div>
      <div className={`border-2 border-ink relative overflow-hidden ${accentBorderClass.replace('border-', 'shadow-')}`} style={{ background: bg }}>
        <div className="absolute top-2 left-2 font-mono text-[9px] text-ink">◢</div>
        <div className="absolute top-2 right-2 font-mono text-[9px] text-ink">◣</div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px] text-ink">◥</div>
        <div className="absolute bottom-2 right-2 font-mono text-[9px] text-ink">◤</div>

        <div className="px-5 py-7 text-center">
          <div className={`font-mono text-[10px] tracking-[0.3em] uppercase ${accentClass}`}>
            {isUrgent && '⚠ '}Move your car{isUrgent && ' ⚠'}
          </div>
          <div className="font-serif mt-3 leading-[0.95] text-ink" style={{ fontSize: 'clamp(48px, 14vw, 76px)' }}>
            {headline}
          </div>
          <div className="font-serif italic mt-1 text-ink-soft" style={{ fontSize: 'clamp(18px, 5vw, 22px)' }}>
            {dayOfWeek(next.date)}, {monthName(next.date)} {next.date.getDate()}
          </div>

          <div className="my-5 mx-auto w-12 border-t border-ink" />

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 text-ink">Ward</div>
              <div className="font-serif text-3xl text-ink">{ward}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 text-ink">Section</div>
              <div className="font-serif text-3xl text-ink">{section}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { SCHEDULE_YEAR } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  address: string | null;
}

const NOTES: Array<{ lead: string; rest: string }> = [
  {
    lead: 'Two consecutive dates equal one for each side.',
    rest: ' The orange temporary signs posted curbside the day before will tell you which side is yours.',
  },
  {
    lead: 'The fine for parking on a swept street runs up to $60.',
    rest: ' That is the entire reason this app exists.',
  },
  {
    lead: 'Some streets carry permanent signs with their own schedule.',
    rest: ' Always check the post itself; it overrides the almanac.',
  },
  {
    lead: 'Sweeping runs roughly 9 a.m. to 2 p.m., weekdays, weather permitting.',
    rest: ' Rain or snow can cancel a date with no notice.',
  },
  {
    lead: 'Yellow vs Orange weeks.',
    rest: ' Recycling pickup alternates each week: half the city goes out on Yellow weeks, the other half on Orange. Your address is on a fixed color, so only weeks marked your color get a pickup. Garbage is weekly and ignores this entirely.',
  },
];

export const Footnotes = ({ address }: Props) => (
  <section className="px-5 mt-10 mb-6">
    {/* Heading */}
    <div className="flex items-baseline gap-2 mb-3">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
        <ChicagoStar size={9} /> Section IV
      </span>
      <span className="flex-1 border-b border-ink/30" />
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
        Fine print
      </span>
    </div>

    <div className="border-t-2 border-ink" />
    <div className="border-t border-ink mt-[2px] mb-4" />

    <ol className="space-y-3">
      {NOTES.map((n, i) => (
        <li key={i} className="flex gap-3 text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-chicago-red shrink-0 pt-1">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>
            <em className="not-italic font-sans font-semibold text-ink">{n.lead}</em>
            <span className="font-serif italic">{n.rest}</span>
          </span>
        </li>
      ))}
    </ol>

    {/* Colophon */}
    <div className="mt-7 border-t-2 border-ink pt-3">
      <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft flex items-center justify-between">
        <span>City of Chicago Open Data · {SCHEDULE_YEAR}</span>
        <span className="hidden sm:inline">u5ai-3efk · 2r7q-emq3</span>
      </div>
      {address && (
        <div className="mt-2 font-mono text-[10px] leading-relaxed text-ink-soft">
          <span className="text-chicago-red">↳</span> Looked up: <em className="font-serif not-italic">{address}</em>
        </div>
      )}
    </div>
  </section>
);

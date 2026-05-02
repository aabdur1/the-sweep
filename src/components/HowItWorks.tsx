import { ChicagoStar } from './ChicagoStar';

const STEPS: Array<{ n: string; t: string; d: string }> = [
  { n: 'I', t: 'Type your address', d: 'Or tap "use current position"' },
  { n: 'II', t: 'We find your zone', d: 'Ward + section, automatic' },
  { n: 'III', t: 'See every date', d: 'For the whole season' },
];

export const HowItWorks = () => (
  <section className="px-5 mt-10 mb-10 lg:px-8 lg:mt-14 lg:mb-14">
    {/* Section header */}
    <div className="flex items-baseline gap-2 mb-3 lg:mb-5">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red lg:text-[11px] lg:tracking-[0.35em]">
        How it works
      </span>
      <span className="flex-1 border-b border-ink/30" />
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft lg:text-[11px]">
        Three steps
      </span>
    </div>

    {/* Top double rule */}
    <div className="border-t-2 border-ink" />
    <div className="border-t border-ink mt-[2px]" />

    {/* Desktop: theatrical full-bleed step row with massive Roman numerals */}
    <div className="grid grid-cols-3 mt-4 lg:mt-10">
      {STEPS.map((s, i) => (
        <div
          key={s.n}
          className={`px-3 py-4 text-center lg:px-6 lg:py-10 ${
            i < STEPS.length - 1 ? 'border-r border-ink/40 lg:border-r-2 lg:border-ink' : ''
          }`}
        >
          <div className="flex justify-center mb-2 lg:mb-5">
            <ChicagoStar size={11} className="text-chicago-red lg:hidden" />
            <ChicagoStar size={20} className="text-chicago-red hidden lg:inline-block" />
          </div>

          {/* Mobile numeral */}
          <div className="font-serif italic text-2xl text-ink leading-none mb-1.5 lg:hidden">{s.n}.</div>
          {/* Desktop massive numeral */}
          <div className="hidden lg:block font-serif italic text-[120px] leading-[0.85] text-ink mb-3">
            {s.n}.
          </div>

          <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink leading-snug lg:text-[12px] lg:tracking-[0.3em] lg:mt-1">
            {s.t}
          </div>
          <div className="font-sans text-[10.5px] mt-1.5 text-ink-soft italic leading-snug lg:font-serif lg:text-[15px] lg:mt-3">
            {s.d}
          </div>
        </div>
      ))}
    </div>

    <div className="border-t border-ink mt-1 lg:mt-10" />
    <div className="hidden lg:block border-t-2 border-ink mt-[3px]" />

    {/* Desktop tagline footer for the empty state */}
    <div className="hidden lg:flex items-center justify-center gap-4 mt-8">
      <span className="border-t border-ink/40 w-16" />
      <p className="font-serif italic text-[15px] text-ink-soft text-center max-w-[40ch]">
        Type your address above. Get your sweep dates, recycling cycle, and garbage day in one place.
      </p>
      <span className="border-t border-ink/40 w-16" />
    </div>
  </section>
);

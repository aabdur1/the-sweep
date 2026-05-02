import { ChicagoStar } from './ChicagoStar';

const STEPS: Array<{ n: string; t: string; d: string }> = [
  { n: 'I', t: 'Type your address', d: 'Or tap "use current position"' },
  { n: 'II', t: 'We find your zone', d: 'Ward + section, automatic' },
  { n: 'III', t: 'See every date', d: 'For the whole season' },
];

export const HowItWorks = () => (
  <section className="px-5 mt-10 mb-10">
    {/* Section header */}
    <div className="flex items-baseline gap-2 mb-3">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red">
        How it works
      </span>
      <span className="flex-1 border-b border-ink/30" />
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
        Three steps
      </span>
    </div>

    {/* Top double rule */}
    <div className="border-t-2 border-ink" />
    <div className="border-t border-ink mt-[2px]" />

    <div className="grid grid-cols-3 mt-4">
      {STEPS.map((s, i) => (
        <div
          key={s.n}
          className={`px-3 py-4 text-center ${i < STEPS.length - 1 ? 'border-r border-ink/40' : ''}`}
        >
          <div className="flex justify-center mb-2">
            <ChicagoStar size={11} className="text-chicago-red" />
          </div>
          <div className="font-serif italic text-2xl text-ink leading-none mb-1.5">{s.n}.</div>
          <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink leading-snug">
            {s.t}
          </div>
          <div className="font-sans text-[10.5px] mt-1.5 text-ink-soft italic leading-snug">
            {s.d}
          </div>
        </div>
      ))}
    </div>

    <div className="border-t border-ink mt-1" />
  </section>
);

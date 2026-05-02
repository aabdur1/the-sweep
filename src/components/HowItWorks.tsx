const STEPS: Array<{ n: string; t: string; d: string }> = [
  { n: 'i.', t: 'Type your address', d: 'Or tap "current location"' },
  { n: 'ii.', t: 'We find your zone', d: 'Ward + section, automatic' },
  { n: 'iii.', t: 'See every date', d: 'For the whole season' },
];

export const HowItWorks = () => (
  <div className="px-5 mt-8 mb-10">
    <div className="border-t-2 border-ink pt-4">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3 text-chicago-red">
        How it works
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {STEPS.map((s, i) => (
          <div key={i} className="border border-ink p-3">
            <div className="font-serif italic text-2xl text-chicago-red">{s.n}</div>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase mt-1 text-ink">{s.t}</div>
            <div className="text-[10px] mt-1 text-ink-soft opacity-70">{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

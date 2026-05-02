import { SCHEDULE_YEAR } from '../types';
import { ChicagoStar } from './ChicagoStar';
import { Seal } from './Seal';

const todayLong = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const Masthead = () => (
  <header className="border-b-2 border-ink relative">
    {/* Chicago flag stripe — two thin blue bars on cream. */}
    <div className="flex flex-col">
      <div className="h-[3px] bg-chicago-blue" />
      <div className="h-[2px] bg-cream" />
      <div className="h-[3px] bg-chicago-blue" />
    </div>

    {/* Top edition bar — issue metadata in mono caps */}
    <div className="px-5 py-2 flex items-center justify-between border-b border-ink/40 text-[9px] font-mono tracking-[0.2em] uppercase">
      <span className="text-ink">Vol. {SCHEDULE_YEAR} · No. 1</span>
      <span className="text-ink-soft hidden sm:inline">{todayLong}</span>
      <span className="text-ink">Apr — Nov</span>
    </div>

    {/* Department kicker — small, authoritative, separated by stars */}
    <div className="px-5 pt-7 pb-1">
      <div className="font-mono text-[9px] tracking-[0.35em] uppercase text-chicago-red flex items-center justify-center gap-3">
        <span className="flex-1 border-t border-chicago-red/40" />
        <ChicagoStar size={8} />
        <span>Department of Streets</span>
        <ChicagoStar size={8} />
        <span className="flex-1 border-t border-chicago-red/40" />
      </div>
    </div>

    {/* Wordmark with seal */}
    <div className="px-5 pt-2 pb-3 text-center relative">
      <Seal
        size={48}
        className="absolute left-5 top-3 text-chicago-blue hidden sm:block"
      />
      <Seal
        size={48}
        className="absolute right-5 top-3 text-chicago-blue hidden sm:block"
      />
      <h1
        className="font-serif leading-[0.85] tracking-[-0.02em] text-ink"
        style={{ fontSize: 'clamp(56px, 16vw, 96px)' }}
      >
        The Sweep
      </h1>
      <h2
        className="font-serif italic mt-1 text-chicago-blue tracking-tight"
        style={{ fontSize: 'clamp(15px, 4vw, 20px)' }}
      >
        Registry & Almanac
      </h2>
    </div>

    {/* Four stars row — the unmistakable flag reference */}
    <div className="px-5 pb-2 flex items-center justify-center gap-3">
      <span className="flex-1 border-t-2 border-ink" />
      <ChicagoStar size={14} className="text-chicago-red" />
      <ChicagoStar size={14} className="text-chicago-red" />
      <ChicagoStar size={14} className="text-chicago-red" />
      <ChicagoStar size={14} className="text-chicago-red" />
      <span className="flex-1 border-t-2 border-ink" />
    </div>

    {/* Tagline — italic, like a magazine deck */}
    <div className="px-5 pb-6 pt-2 text-center">
      <p
        className="font-serif italic text-ink-soft mx-auto leading-snug"
        style={{ fontSize: 'clamp(14px, 3.6vw, 17px)', maxWidth: '32ch' }}
      >
        Find your sweeping schedule by address.
        <br className="hidden sm:inline" />
        <span className="text-chicago-red"> Never miss a $60 ticket again.</span>
      </p>
    </div>

    {/* Closing rule pair */}
    <div className="border-t border-ink" />
    <div className="border-t-[3px] border-ink mt-[3px]" />
  </header>
);

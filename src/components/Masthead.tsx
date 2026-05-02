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
    {/* Chicago flag stripe — two thin blue bars on cream. Taller on desktop. */}
    <div className="flex flex-col">
      <div className="h-[3px] bg-chicago-blue lg:h-[5px]" />
      <div className="h-[2px] bg-cream lg:h-[3px]" />
      <div className="h-[3px] bg-chicago-blue lg:h-[5px]" />
    </div>

    {/* Top edition bar — issue metadata in mono caps */}
    <div className="px-5 py-2 flex items-center justify-between border-b border-ink/40 text-[9px] font-mono tracking-[0.2em] uppercase lg:px-10 lg:py-3 lg:text-[11px] lg:tracking-[0.3em]">
      <span className="text-ink">Vol. {SCHEDULE_YEAR} · No. 1</span>
      <span className="text-ink-soft hidden sm:inline">{todayLong}</span>
      <span className="text-ink">Apr — Nov</span>
    </div>

    {/* Department kicker — small, authoritative, separated by stars */}
    <div className="px-5 pt-7 pb-1 lg:pt-10 lg:pb-2">
      <div className="font-mono text-[9px] tracking-[0.35em] uppercase text-chicago-red flex items-center justify-center gap-3 lg:text-[11px] lg:tracking-[0.45em] lg:gap-5">
        <span className="flex-1 border-t border-chicago-red/40" />
        <ChicagoStar size={8} className="lg:hidden" />
        <ChicagoStar size={11} className="hidden lg:inline-block" />
        <span>Department of Streets</span>
        <ChicagoStar size={8} className="lg:hidden" />
        <ChicagoStar size={11} className="hidden lg:inline-block" />
        <span className="flex-1 border-t border-chicago-red/40" />
      </div>
    </div>

    {/* Wordmark with seal */}
    <div className="px-5 pt-2 pb-3 text-center relative lg:px-10 lg:pt-4 lg:pb-5">
      {/* Mobile seals */}
      <Seal
        size={48}
        className="absolute left-5 top-3 text-chicago-blue hidden sm:block lg:hidden"
      />
      <Seal
        size={48}
        className="absolute right-5 top-3 text-chicago-blue hidden sm:block lg:hidden"
      />
      {/* Desktop seals — sized to match the more restrained wordmark */}
      <Seal
        size={80}
        className="absolute left-16 top-1/2 -translate-y-1/2 text-chicago-blue hidden lg:block"
      />
      <Seal
        size={80}
        className="absolute right-16 top-1/2 -translate-y-1/2 text-chicago-blue hidden lg:block"
      />
      <h1
        className="font-serif leading-[0.85] tracking-[-0.02em] text-ink"
        style={{ fontSize: 'clamp(54px, 11vw, 124px)' }}
      >
        The Sweep
      </h1>
      <h2
        className="font-serif italic mt-1 text-chicago-blue tracking-tight lg:mt-3"
        style={{ fontSize: 'clamp(15px, 3vw, 24px)' }}
      >
        Registry &amp; Almanac
      </h2>
    </div>

    {/* Four stars row — the unmistakable flag reference */}
    <div className="px-5 pb-2 flex items-center justify-center gap-3 lg:px-10 lg:pb-3 lg:gap-6">
      <span className="flex-1 border-t-2 border-ink" />
      <ChicagoStar size={14} className="text-chicago-red lg:hidden" />
      <ChicagoStar size={14} className="text-chicago-red lg:hidden" />
      <ChicagoStar size={14} className="text-chicago-red lg:hidden" />
      <ChicagoStar size={14} className="text-chicago-red lg:hidden" />
      <ChicagoStar size={22} className="text-chicago-red hidden lg:inline-block" />
      <ChicagoStar size={22} className="text-chicago-red hidden lg:inline-block" />
      <ChicagoStar size={22} className="text-chicago-red hidden lg:inline-block" />
      <ChicagoStar size={22} className="text-chicago-red hidden lg:inline-block" />
      <span className="flex-1 border-t-2 border-ink" />
    </div>

    {/* Tagline — italic, like a magazine deck */}
    <div className="px-5 pb-6 pt-2 text-center lg:pb-8 lg:pt-4">
      <p
        className="font-serif italic text-ink-soft mx-auto leading-snug"
        style={{ fontSize: 'clamp(14px, 2.4vw, 19px)', maxWidth: '70ch' }}
      >
        Find your sweeping schedule by address.
        <span className="text-chicago-red"> Never miss a $60 ticket again.</span>
      </p>
    </div>

    {/* Closing rule pair */}
    <div className="border-t border-ink" />
    <div className="border-t-[3px] border-ink mt-[3px]" />
  </header>
);

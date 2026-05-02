import { SCHEDULE_YEAR } from '../types';
import { ChicagoStar } from './ChicagoStar';

export const Masthead = () => (
  <header className="border-b border-rule">
    {/* Authentic flag stripe: cream–blue–cream–blue–cream */}
    <div className="flex h-1.5">
      <div className="flex-1 bg-cream" />
      <div className="flex-1 bg-chicago-blue" />
      <div className="flex-1 bg-cream" />
      <div className="flex-1 bg-chicago-blue" />
      <div className="flex-1 bg-cream" />
    </div>
    <div className="px-5 py-3 flex items-center justify-between border-t border-b border-rule">
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink">
        Vol. {SCHEDULE_YEAR} · No. 1
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink">
        Apr — Nov
      </div>
    </div>
    <div className="px-5 pt-6 pb-5 text-center">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2 text-chicago-red flex items-center justify-center gap-2">
        <ChicagoStar size={10} /> Chicago Department of Streets <ChicagoStar size={10} />
      </div>
      <h1 className="font-serif leading-[0.92] tracking-tight text-ink" style={{ fontSize: 'clamp(38px, 11vw, 56px)' }}>
        The Sweep
      </h1>
      <h2 className="font-serif italic mt-1 text-chicago-blue" style={{ fontSize: 'clamp(15px, 4vw, 19px)' }}>
        Registry & Almanac
      </h2>
      <div className="mt-4 mx-auto w-16 border-t-2 border-ink" />
      <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto text-ink-soft">
        Find your sweeping schedule by address. Never miss a $60 ticket again.
      </p>
    </div>
  </header>
);

import { Loader2, Navigation, ArrowRight } from 'lucide-react';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  address: string;
  setAddress: (v: string) => void;
  onLookup: () => void;
  onUseLocation: () => void;
  loading: boolean;
  locating: boolean;
}

export const AddressInput = ({
  address,
  setAddress,
  onLookup,
  onUseLocation,
  loading,
  locating,
}: Props) => (
  <section className="px-5 pt-7">
    {/* Section header */}
    <div className="flex items-baseline gap-2 mb-2">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
        <ChicagoStar size={9} /> Section I
      </span>
      <span className="flex-1 border-b border-ink/30" />
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
        Lookup · 01
      </span>
    </div>

    {/* Form panel — like a fillable civic form */}
    <div className="border-2 border-ink relative" style={{ background: '#FAF4E0' }}>
      {/* Form-number tab top-right (like an official form #) */}
      <div className="absolute -top-px right-4 bg-cream border-x border-b border-ink px-2 py-0.5 font-mono text-[8.5px] tracking-[0.25em] uppercase text-ink-soft">
        Form CDS-01
      </div>

      <div className="p-5 pt-6">
        {/* Field block */}
        <label className="block">
          <span className="block font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft mb-2">
            Street Address — Chicago, IL
          </span>
          <span className="flex items-baseline border-b-2 border-ink pb-1">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-chicago-red mr-3 select-none">
              Re:
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLookup()}
              placeholder="1819 S California Ave"
              className="flex-1 bg-transparent outline-none font-serif text-[22px] text-ink placeholder:text-ink/30 leading-tight"
              autoComplete="street-address"
            />
          </span>
        </label>

        {/* Submit */}
        <button
          onClick={onLookup}
          disabled={loading || !address.trim()}
          className="mt-5 w-full py-3.5 font-mono text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-40 bg-ink text-cream hover:bg-chicago-red"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Searching the registry…
            </>
          ) : (
            <>
              <ChicagoStar size={11} /> Find my schedule <ArrowRight size={14} strokeWidth={2.5} />
            </>
          )}
        </button>

        {/* Or — divider */}
        <div className="mt-3 flex items-center gap-3">
          <span className="flex-1 border-t border-ink/40" />
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">Or</span>
          <span className="flex-1 border-t border-ink/40" />
        </div>

        {/* Geolocation */}
        <button
          onClick={onUseLocation}
          disabled={locating || loading}
          className="mt-3 w-full py-2.5 border-2 border-ink font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 text-ink hover:bg-ink hover:text-cream transition-colors"
        >
          {locating ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Locating…
            </>
          ) : (
            <>
              <Navigation size={12} strokeWidth={2.5} /> Use current position
            </>
          )}
        </button>
      </div>
    </div>
  </section>
);

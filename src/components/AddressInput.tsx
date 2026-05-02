import { Loader2, Search, Navigation, ArrowRight } from 'lucide-react';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  address: string;
  setAddress: (v: string) => void;
  onLookup: () => void;
  onUseLocation: () => void;
  loading: boolean;
  locating: boolean;
}

export const AddressInput = ({ address, setAddress, onLookup, onUseLocation, loading, locating }: Props) => (
  <div className="px-5 pt-6">
    <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-red flex items-center gap-1.5">
      <ChicagoStar size={9} /> Section I — Lookup
    </div>
    <div className="border-2 border-ink p-4" style={{ background: '#FAF4E0' }}>
      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase mb-2 text-ink-soft">
        Your address
      </label>
      <div className="flex items-center border-b-2 border-ink pb-2">
        <Search size={16} className="mr-2 shrink-0 text-ink-soft" />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLookup()}
          placeholder="1819 S California Ave"
          className="flex-1 bg-transparent outline-none font-serif text-xl text-ink placeholder:opacity-40"
          autoComplete="street-address"
        />
      </div>
      <button
        onClick={onLookup}
        disabled={loading || !address.trim()}
        className="mt-4 w-full py-3.5 font-mono text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 transition disabled:opacity-40 bg-ink text-cream"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> Searching</>
        ) : (
          <>Find my schedule <ArrowRight size={14} /></>
        )}
      </button>
      <button
        onClick={onUseLocation}
        disabled={locating || loading}
        className="mt-2 w-full py-2.5 border border-ink font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 text-ink"
      >
        {locating ? (
          <><Loader2 size={12} className="animate-spin" /> Locating</>
        ) : (
          <><Navigation size={12} /> Use current location</>
        )}
      </button>
    </div>
  </div>
);

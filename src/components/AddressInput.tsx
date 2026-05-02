import { useEffect, useRef, useState } from 'react';
import { Loader2, Navigation, ArrowRight } from 'lucide-react';
import type { PlaceSuggestion, RecentLookup } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  query: string;
  setQuery: (v: string) => void;
  onSubmitText: () => void;
  onSelectPlace: (s: PlaceSuggestion) => void;
  onSelectRecent: (r: RecentLookup) => void;
  onUseLocation: () => void;
  loading: boolean;
  locating: boolean;
  isSearching: boolean;
  suggestions: PlaceSuggestion[];
  recents: RecentLookup[];
  hasGoogle: boolean;
}

type ComboItem =
  | { kind: 'recent'; r: RecentLookup }
  | { kind: 'place'; s: PlaceSuggestion };

export const AddressInput = ({
  query,
  setQuery,
  onSubmitText,
  onSelectPlace,
  onSelectRecent,
  onUseLocation,
  loading,
  locating,
  isSearching,
  suggestions,
  recents,
  hasGoogle,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const recentMatches = recents.filter((r) =>
    query.length < 2 ? true : r.query.toLowerCase().includes(query.toLowerCase())
  );
  const items: ComboItem[] = [
    ...recentMatches.map((r) => ({ kind: 'recent' as const, r })),
    ...suggestions.map((s) => ({ kind: 'place' as const, s })),
  ];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setHighlight(-1); }, [items.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter') onSubmitText();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < items.length) {
        const it = items[highlight];
        if (it.kind === 'place') onSelectPlace(it.s);
        else onSelectRecent(it.r);
        setOpen(false);
      } else {
        onSubmitText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <section className="px-5 pt-7" ref={containerRef}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red flex items-center gap-1.5">
          <ChicagoStar size={9} /> Section I
        </span>
        <span className="flex-1 border-b border-ink/30" />
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-ink-soft">
          Lookup · 01
        </span>
      </div>

      <div className="border-2 border-ink relative" style={{ background: '#FAF4E0' }}>
        <div className="absolute -top-px right-4 bg-cream border-x border-b border-ink px-2 py-0.5 font-mono text-[8.5px] tracking-[0.25em] uppercase text-ink-soft">
          Form CDS-01
        </div>

        <div className="p-5 pt-6">
          <label className="block">
            <span className="block font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft mb-2">
              Street Address — Chicago, IL
            </span>
            <span className="flex items-baseline border-b-2 border-ink pb-1 relative">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-chicago-red mr-3 select-none">Re:</span>
              <input
                type="text"
                role="combobox"
                aria-expanded={open && items.length > 0}
                aria-controls="address-suggestions"
                aria-autocomplete="list"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="1819 S California Ave"
                className="flex-1 bg-transparent outline-none font-serif text-[22px] text-ink placeholder:text-ink/30 leading-tight"
                autoComplete="off"
              />
              {isSearching && <Loader2 size={14} className="animate-spin text-ink-soft ml-2" />}
            </span>
          </label>

          {open && items.length > 0 && (
            <ul
              id="address-suggestions"
              role="listbox"
              className="mt-2 border border-ink/40 bg-cream divide-y divide-ink/20"
            >
              {items.map((it, i) => {
                const isHl = i === highlight;
                if (it.kind === 'recent') {
                  return (
                    <li
                      key={`r-${it.r.query}`}
                      role="option"
                      aria-selected={isHl}
                      onMouseDown={(e) => { e.preventDefault(); onSelectRecent(it.r); setOpen(false); }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${isHl ? 'bg-ink text-cream' : ''}`}
                    >
                      <span className={`font-mono text-[8px] tracking-[0.25em] uppercase ${isHl ? 'text-cream/70' : 'text-chicago-red'}`}>Recent</span>
                      <span className="font-serif text-[15px]">{it.r.query}</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={`p-${it.s.placeId}`}
                    role="option"
                    aria-selected={isHl}
                    onMouseDown={(e) => { e.preventDefault(); onSelectPlace(it.s); setOpen(false); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`px-3 py-2 cursor-pointer flex flex-col ${isHl ? 'bg-ink text-cream' : ''}`}
                  >
                    <span className="font-serif text-[15px] leading-tight">{it.s.mainText}</span>
                    {it.s.secondaryText && (
                      <span className={`font-mono text-[10px] tracking-[0.15em] mt-0.5 ${isHl ? 'text-cream/60' : 'text-ink-soft'}`}>
                        {it.s.secondaryText}
                      </span>
                    )}
                  </li>
                );
              })}
              {hasGoogle && (
                <li className="px-3 py-1.5 font-mono text-[8px] tracking-[0.25em] uppercase text-ink-soft text-right">
                  Powered by Google
                </li>
              )}
            </ul>
          )}

          <button
            onClick={onSubmitText}
            disabled={loading || !query.trim()}
            className="mt-5 w-full py-3.5 font-mono text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-40 bg-ink text-cream hover:bg-chicago-red"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Searching the registry…</>
            ) : (
              <><ChicagoStar size={11} /> Find my schedule <ArrowRight size={14} strokeWidth={2.5} /></>
            )}
          </button>

          <div className="mt-3 flex items-center gap-3">
            <span className="flex-1 border-t border-ink/40" />
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">Or</span>
            <span className="flex-1 border-t border-ink/40" />
          </div>

          <button
            onClick={onUseLocation}
            disabled={locating || loading}
            className="mt-3 w-full py-2.5 border-2 border-ink font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40 text-ink hover:bg-ink hover:text-cream transition-colors"
          >
            {locating ? (
              <><Loader2 size={12} className="animate-spin" /> Locating…</>
            ) : (
              <><Navigation size={12} strokeWidth={2.5} /> Use current position</>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

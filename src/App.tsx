import { useMemo, useState } from 'react';
import { useLookup } from './hooks/useLookup';
import { useAddressSearch } from './hooks/useAddressSearch';
import { useSavedAddresses } from './hooks/useSavedAddresses';
import { startOfDay } from './lib/dates';
import { generateICS, generateRoutineICS } from './lib/ics';
import { list as listRecents } from './lib/recentLookups';
import { SCHEDULE_YEAR } from './types';
import type { PlaceSuggestion, RecentLookup, SavedAddress } from './types';
import { Masthead } from './components/Masthead';
import { AddressInput } from './components/AddressInput';
import { SavedAddressChips } from './components/SavedAddressChips';
import { SaveAddressPrompt } from './components/SaveAddressPrompt';
import { ErrorPanel } from './components/ErrorPanel';
import { NextSweepHero } from './components/NextSweepHero';
import { RoutinePickups } from './components/RoutinePickups';
import { ScheduleAlmanac } from './components/ScheduleAlmanac';
import { Footnotes } from './components/Footnotes';
import { HowItWorks } from './components/HowItWorks';
import { ChicagoStar } from './components/ChicagoStar';
import { Marginalia } from './components/Marginalia';
import './index.css';

export default function App() {
  const search = useAddressSearch();
  const savedHook = useSavedAddresses();
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, lookupByPlaceId, startLocating, reset } = useLookup();
  const [recents, setRecents] = useState<RecentLookup[]>(() => listRecents());

  const refreshRecents = () => setRecents(listRecents());

  const handleSubmitText = () => {
    if (!search.query.trim()) return;
    void lookup(search.query).then(refreshRecents);
  };

  const handleSelectPlace = (s: PlaceSuggestion) => {
    const label = `${s.mainText}${s.secondaryText ? ', ' + s.secondaryText : ''}`;
    search.setQuery(s.mainText);
    void lookupByPlaceId(s.placeId, label, search.getSessionToken()).then(() => {
      search.resetSession();
      refreshRecents();
    });
  };

  const handleSelectRecent = (r: RecentLookup) => {
    search.setQuery(r.query);
    void lookupByCoords(r.lat, r.lon, r.query).then(refreshRecents);
  };

  const handlePickSaved = (s: SavedAddress) => {
    search.setQuery(s.label);
    void lookupByCoords(s.lat, s.lon, s.label).then(refreshRecents);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude).then(refreshRecents),
      () => void 0,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const next = useMemo(() => {
    if (!result) return null;
    const today = startOfDay(new Date());
    return result.dates.find((d) => startOfDay(d.date) >= today) ?? null;
  }, [result]);

  const handleDownload = () => {
    if (!result) return;
    const url = generateICS(result.dates, result.ward, result.section);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chicago-sweeps-W${result.ward}S${result.section}-${SCHEDULE_YEAR}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRoutineDownload = () => {
    if (!result) return;
    const url = generateRoutineICS(result.recycling, result.garbage);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chicago-routine-pickups-${SCHEDULE_YEAR}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const existingSave = result ? savedHook.isSaved(result.coords.lat, result.coords.lon) : undefined;

  return (
    <div className="min-h-screen grain bg-cream text-ink lg:py-8 lg:bg-cream-dark">
      {/* Broadsheet "page" — narrow on mobile, framed on desktop */}
      <div className="max-w-xl mx-auto bg-cream lg:max-w-[1280px] lg:border-2 lg:border-ink lg:shadow-[0_2px_0_0_rgba(15,26,46,0.15)]">
        <Masthead />

        {/* Body grid: single column on mobile, three-column with marginalia on desktop */}
        <div className="lg:grid lg:grid-cols-[140px_minmax(0,1fr)_140px]">
          <Marginalia side="left" />

          <main className="lg:border-x lg:border-ink/30">
            {/* Lookup block — narrow on desktop so the form doesn't sprawl */}
            <div className="lg:max-w-2xl lg:mx-auto">
              <div className="px-5 pt-6 lg:pt-8">
                <SavedAddressChips
                  saved={savedHook.saved}
                  onPick={handlePickSaved}
                  onRemove={savedHook.remove}
                />
              </div>

              <AddressInput
                query={search.query}
                setQuery={search.setQuery}
                onSubmitText={handleSubmitText}
                onSelectPlace={handleSelectPlace}
                onSelectRecent={handleSelectRecent}
                onUseLocation={handleUseLocation}
                loading={isLoading}
                locating={isLocating}
                isSearching={search.isSearching}
                suggestions={search.suggestions}
                recents={recents}
                hasGoogle={search.hasGoogle}
              />
            </div>

            {error && <ErrorPanel message={error} onDismiss={reset} />}

            {result && (
              <>
                {/* Above-the-fold spread: hero (lead) + routines (sidebar) on lg+ */}
                <div className="lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-0">
                  <div className="lg:border-r lg:border-ink/30">
                    <NextSweepHero next={next} ward={result.ward} section={result.section} />
                    <SaveAddressPrompt
                      result={result}
                      existingSave={existingSave}
                      onSave={(label) =>
                        savedHook.save({
                          label,
                          query: result.display,
                          lat: result.coords.lat,
                          lon: result.coords.lon,
                        })
                      }
                      onRename={savedHook.rename}
                      onRemove={savedHook.remove}
                    />
                  </div>
                  <div>
                    <RoutinePickups
                      recycling={result.recycling}
                      garbage={result.garbage}
                      onDownload={handleRoutineDownload}
                    />
                  </div>
                </div>

                <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
                <Footnotes address={result.display} />
              </>
            )}

            {!result && !error && <HowItWorks />}
          </main>

          <Marginalia side="right" />
        </div>

        <footer className="border-t-2 border-ink mt-2">
          <div className="border-t border-ink mt-[2px]" />
          <div className="px-5 py-5 text-center lg:py-7">
            <div className="flex items-center justify-center gap-2 mb-2 lg:gap-3 lg:mb-3">
              <ChicagoStar size={9} className="text-chicago-red lg:hidden" />
              <ChicagoStar size={9} className="text-chicago-red lg:hidden" />
              <ChicagoStar size={9} className="text-chicago-red lg:hidden" />
              <ChicagoStar size={9} className="text-chicago-red lg:hidden" />
              <span className="hidden lg:inline-flex items-center gap-3">
                <span className="border-t-2 border-ink w-12" />
                <ChicagoStar size={14} className="text-chicago-red" />
                <ChicagoStar size={14} className="text-chicago-red" />
                <ChicagoStar size={14} className="text-chicago-red" />
                <ChicagoStar size={14} className="text-chicago-red" />
                <span className="border-t-2 border-ink w-12" />
              </span>
            </div>
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft lg:text-[10px] lg:tracking-[0.4em]">
              Built in Chicago · End of edition
            </div>
            <div className="font-serif italic text-[11px] text-ink-soft mt-1 lg:text-[13px] lg:mt-2">— ⬩ —</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen grain bg-cream text-ink">
      <div className="max-w-xl mx-auto bg-cream">
        <Masthead />

        <div className="px-5 pt-6">
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

        {error && <ErrorPanel message={error} onDismiss={reset} />}
        {result && (
          <>
            <NextSweepHero next={next} ward={result.ward} section={result.section} />
            <SaveAddressPrompt
              result={result}
              existingSave={existingSave}
              onSave={(label) => savedHook.save({ label, query: result.display, lat: result.coords.lat, lon: result.coords.lon })}
              onRename={savedHook.rename}
              onRemove={savedHook.remove}
            />
            <RoutinePickups
              recycling={result.recycling}
              garbage={result.garbage}
              onDownload={handleRoutineDownload}
            />
            <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
            <Footnotes address={result.display} />
          </>
        )}
        {!result && !error && <HowItWorks />}
        <footer className="border-t-2 border-ink mt-2">
          <div className="border-t border-ink mt-[2px]" />
          <div className="px-5 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
              <ChicagoStar size={9} className="text-chicago-red" />
            </div>
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
              Built in Chicago · End of edition
            </div>
            <div className="font-serif italic text-[11px] text-ink-soft mt-1">— ⬩ —</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

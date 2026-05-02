import { useMemo, useState } from 'react';
import { useLookup } from './hooks/useLookup';
import { startOfDay } from './lib/dates';
import { generateICS } from './lib/ics';
import { SCHEDULE_YEAR } from './types';
import { Masthead } from './components/Masthead';
import { AddressInput } from './components/AddressInput';
import { ErrorPanel } from './components/ErrorPanel';
import { NextSweepHero } from './components/NextSweepHero';
import { ScheduleAlmanac } from './components/ScheduleAlmanac';
import { Footnotes } from './components/Footnotes';
import { HowItWorks } from './components/HowItWorks';
import './index.css';

export default function App() {
  const [address, setAddress] = useState('');
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, startLocating, reset } = useLookup();

  const handleLookup = () => {
    if (!address.trim()) return;
    void lookup(address);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude),
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

  return (
    <div className="min-h-screen grain bg-cream text-ink">
      <div className="max-w-xl mx-auto bg-cream">
        <Masthead />
        <AddressInput
          address={address}
          setAddress={setAddress}
          onLookup={handleLookup}
          onUseLocation={handleUseLocation}
          loading={isLoading}
          locating={isLocating}
        />
        {error && <ErrorPanel message={error} onDismiss={reset} />}
        {result && (
          <>
            <NextSweepHero next={next} ward={result.ward} section={result.section} />
            <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
            <Footnotes address={result.display} />
          </>
        )}
        {!result && !error && <HowItWorks />}
        <div className="px-5 py-4 border-t-2 border-ink text-center">
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft flex items-center justify-center gap-2">
            ⬩ Built in Chicago ⬩ Data via City Open Data Portal ⬩
          </div>
        </div>
      </div>
    </div>
  );
}

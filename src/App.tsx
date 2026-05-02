import { useState } from 'react';
import { useLookup } from './hooks/useLookup';
import './index.css';

export default function App() {
  const [address, setAddress] = useState('');
  const { result, error, isLoading, isLocating, lookup, lookupByCoords, startLocating } = useLookup();

  const handleLocation = () => {
    if (!navigator.geolocation) return;
    startLocating();
    navigator.geolocation.getCurrentPosition(
      (pos) => void lookupByCoords(pos.coords.latitude, pos.coords.longitude),
      () => void 0,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-cream text-ink p-6 font-mono text-sm max-w-xl mx-auto">
      <h1 className="font-serif text-4xl mb-4">The Sweep (dev)</h1>
      <input
        className="border border-ink p-2 w-full mb-2 bg-transparent"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="1819 S California Ave"
      />
      <div className="flex gap-2 mb-4">
        <button className="bg-ink text-cream px-3 py-1" onClick={() => void lookup(address)} disabled={isLoading}>
          {isLoading ? 'Searching…' : 'Find schedule'}
        </button>
        <button className="border border-ink px-3 py-1" onClick={handleLocation} disabled={isLocating}>
          {isLocating ? 'Locating…' : 'Use location'}
        </button>
      </div>
      {error && <pre className="text-chicago-red whitespace-pre-wrap">{error}</pre>}
      {result && (
        <pre className="whitespace-pre-wrap">
          {`Ward ${result.ward} § ${result.section} — ${result.display}\n` +
            result.dates
              .map((d) => `${d.date.toDateString()} (Side ${d.sideLabel})`)
              .join('\n')}
        </pre>
      )}
    </div>
  );
}

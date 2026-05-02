import { useState } from 'react';
import { geocode } from './lib/geocode';
import { lookupZone } from './lib/zones';
import { fetchSchedule } from './lib/schedule';
import './index.css';

export default function App() {
  const [out, setOut] = useState<string>('');

  const run = async () => {
    setOut('Running…');
    try {
      const g = await geocode('1819 S California Ave');
      const z = await lookupZone(g.lat, g.lon);
      const s = await fetchSchedule(z.ward, z.section);
      setOut(
        JSON.stringify(
          { geocode: g, zone: z, scheduleCount: s.length, first: s[0], last: s[s.length - 1] },
          null,
          2
        )
      );
    } catch (e) {
      setOut(`ERROR: ${(e as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink p-8 font-mono text-sm">
      <button
        className="bg-ink text-cream px-4 py-2 mb-4"
        onClick={() => void run()}
      >
        Run smoke test
      </button>
      <pre className="whitespace-pre-wrap">{out}</pre>
    </div>
  );
}

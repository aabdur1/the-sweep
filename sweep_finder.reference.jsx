import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Loader2, AlertTriangle, Calendar, Download, Navigation, ArrowRight, Search } from 'lucide-react';

// ─── Style injection ─────────────────────────────────────────────────────
const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
    body { font-family: 'IBM Plex Sans', sans-serif; -webkit-font-smoothing: antialiased; }
    .font-serif { font-family: 'DM Serif Display', serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; }
    .grain {
      background-image:
        radial-gradient(rgba(26,37,64,0.04) 1px, transparent 1px),
        radial-gradient(rgba(178,56,56,0.03) 1px, transparent 1px);
      background-size: 3px 3px, 7px 7px;
      background-position: 0 0, 1px 2px;
    }
    @keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
    .pulse-dot { animation: pulseDot 1.6s ease-in-out infinite; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
    .slide-up { animation: slideUp 0.5s ease-out forwards; }
  `}</style>
);

// ─── Color tokens ────────────────────────────────────────────────────────
const C = {
  cream: '#F1E9D2',
  creamDark: '#E8DFC4',
  ink: '#0F1A2E',
  inkSoft: '#1A2540',
  red: '#B23838',
  redDeep: '#8A2828',
  green: '#2A4F3A',
  rule: '#1A2540',
};

// ─── Data layer ──────────────────────────────────────────────────────────
const SCHEDULE_YEAR = 2026;

const cleanAddress = (raw) => {
  let s = raw.trim();
  // Drop apartment/unit/suite/floor info — these confuse geocoders
  s = s.replace(/,?\s*(apt|apartment|unit|suite|ste|#|floor|fl|rm|room|bldg)\.?\s*[\w\-]+/gi, '');
  // Drop ZIP code (we'll add Chicago context ourselves)
  s = s.replace(/\b\d{5}(-\d{4})?\b/g, '');
  // Drop trailing ", Chicago, IL" / ", Chicago" / ", IL" so we don't double up
  s = s.replace(/,?\s*chicago\s*,?\s*(il|illinois)?/gi, '');
  s = s.replace(/,?\s*(il|illinois)\b/gi, '');
  // Collapse whitespace and trailing commas
  s = s.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,|,\s*$/g, '').trim();
  return s;
};

// Primary: U.S. Census Geocoder — free, government-run, designed for U.S. addresses
const geocodeCensus = async (cleaned) => {
  const full = `${cleaned}, Chicago, IL`;
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(full)}&benchmark=Public_AR_Current&format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Census geocoder unreachable');
  const data = await resp.json();
  const matches = data?.result?.addressMatches || [];
  if (!matches.length) return null;
  const m = matches[0];
  return {
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    display: m.matchedAddress,
  };
};

// Fallback: Nominatim (OpenStreetMap)
const geocodeNominatim = async (cleaned) => {
  const queries = [`${cleaned}, Chicago, IL`, `${cleaned}, Chicago, Illinois`, cleaned];
  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=us&addressdetails=1`;
    let resp;
    try {
      resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    } catch (e) { continue; }
    if (!resp.ok) continue;
    const results = await resp.json();
    if (!results || results.length === 0) continue;
    const match = results.find((r) => {
      const city = (r.address?.city || r.address?.town || r.address?.village || '').toLowerCase();
      const county = (r.address?.county || '').toLowerCase();
      return city.includes('chicago') || county.includes('cook');
    }) || results[0];
    return { lat: parseFloat(match.lat), lon: parseFloat(match.lon), display: match.display_name };
  }
  return null;
};

const geocode = async (rawAddress) => {
  const cleaned = cleanAddress(rawAddress);
  if (!cleaned) throw new Error('Please enter a street address.');

  // Try Census first, fall back to Nominatim
  const providers = [geocodeCensus, geocodeNominatim];
  let networkFailures = 0;
  for (const fn of providers) {
    try {
      const result = await fn(cleaned);
      if (result) return result;
    } catch (e) {
      networkFailures++;
    }
  }
  if (networkFailures === providers.length) {
    throw new Error('Address lookup services aren\'t responding. Check your connection and try again, or tap "Use current location" instead.');
  }
  throw new Error(`Couldn't find "${cleaned}". Try just the street number and street name (e.g. "1819 S California Ave"). Skip apartment numbers and ZIP.`);
};

const lookupZone = async (lat, lon) => {
  // Try 2026 zones first, fall back to 2025 if 2026 doesn't return
  const point = `POINT(${lon} ${lat})`;
  const url2026 = `https://data.cityofchicago.org/resource/2r7q-emq3.json?$where=intersects(the_geom,'${point}')&$limit=1`;
  let resp = await fetch(url2026);
  let data = resp.ok ? await resp.json() : [];
  if (!data.length) {
    const url2025 = `https://data.cityofchicago.org/resource/utb4-q645.json?$where=intersects(the_geom,'${point}')&$limit=1`;
    resp = await fetch(url2025);
    data = resp.ok ? await resp.json() : [];
  }
  if (!data.length) throw new Error("That address isn't inside a Chicago street sweeping zone.");
  return { ward: String(data[0].ward).padStart(2, '0'), section: String(data[0].section).padStart(2, '0') };
};

const fetchSchedule = async (ward, section) => {
  const url = `https://data.cityofchicago.org/resource/u5ai-3efk.json?ward=${ward}&section=${section}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Schedule service is unavailable. Try again in a moment.');
  const rows = await resp.json();
  const dates = [];
  rows.forEach((row) => {
    const month = parseInt(row.month_number, 10);
    const days = String(row.dates).split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n));
    days.forEach((day, idx) => {
      dates.push({
        date: new Date(SCHEDULE_YEAR, month - 1, day),
        sideLabel: idx === 0 ? 'A' : 'B',
        pairIdx: idx,
      });
    });
  });
  dates.sort((a, b) => a.date - b.date);
  return dates;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmt = (d, opts) => d.toLocaleDateString('en-US', opts);
const dayOfWeek = (d) => fmt(d, { weekday: 'long' });
const dayShort = (d) => fmt(d, { weekday: 'short' });
const monthName = (d) => fmt(d, { month: 'long' });
const monthShort = (d) => fmt(d, { month: 'short' });

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

const daysFromToday = (target) => {
  const today = startOfDay(new Date());
  const t = startOfDay(target);
  return Math.round((t - today) / (1000 * 60 * 60 * 24));
};

const generateICS = (dates, ward, section) => {
  const pad = (n) => String(n).padStart(2, '0');
  const fmtICS = (d) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chicago Sweep//EN',
    'CALSCALE:GREGORIAN',
  ];
  dates.forEach((entry, i) => {
    const d = entry.date;
    const next = new Date(d); next.setDate(next.getDate()+1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:sweep-${ward}-${section}-${i}-${fmtICS(d)}@chicago-sweep`,
      `DTSTAMP:${fmtICS(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${fmtICS(d)}`,
      `DTEND;VALUE=DATE:${fmtICS(next)}`,
      `SUMMARY:🚗 MOVE CAR — Street sweeping (Ward ${ward} §${section})`,
      `DESCRIPTION:Street sweeping in Ward ${ward}\\, Section ${section}. One side of the street is swept on this date — check the orange posted signs to know which. Fine up to $60.`,
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Move car — street sweeping tomorrow',
      'END:VALARM',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  return URL.createObjectURL(blob);
};

// ─── UI Components ───────────────────────────────────────────────────────
const Masthead = () => (
  <header className="border-b" style={{ borderColor: C.rule }}>
    {/* Chicago flag stripe */}
    <div className="flex h-1.5">
      <div className="flex-1" style={{ background: C.red }} />
      <div className="flex-1" style={{ background: C.cream }} />
      <div className="flex-1" style={{ background: C.red }} />
      <div className="flex-1" style={{ background: C.cream }} />
      <div className="flex-1" style={{ background: C.red }} />
    </div>
    <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }}>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: C.ink }}>
        Vol. {SCHEDULE_YEAR} · No. 1
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: C.ink }}>
        Apr — Nov
      </div>
    </div>
    <div className="px-5 pt-6 pb-5 text-center">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: C.red }}>
        ⬩ Chicago Department of Streets ⬩
      </div>
      <h1 className="font-serif leading-[0.92] tracking-tight" style={{ color: C.ink, fontSize: 'clamp(38px, 11vw, 56px)' }}>
        The Sweep
      </h1>
      <h2 className="font-serif italic mt-1" style={{ color: C.green, fontSize: 'clamp(15px, 4vw, 19px)' }}>
        Registry & Almanac
      </h2>
      <div className="mt-4 mx-auto w-16 border-t-2" style={{ borderColor: C.ink }} />
      <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto" style={{ color: C.inkSoft }}>
        Find your sweeping schedule by address. Never miss a $60 ticket again.
      </p>
    </div>
  </header>
);

const InputCard = ({ address, setAddress, onLookup, onUseLocation, loading, locating }) => (
  <div className="px-5 pt-6">
    <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: C.red }}>
      ✦ Section I — Lookup
    </div>
    <div className="border-2 p-4" style={{ borderColor: C.ink, background: '#FAF4E0' }}>
      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: C.inkSoft }}>
        Your address
      </label>
      <div className="flex items-center border-b-2 pb-2" style={{ borderColor: C.ink }}>
        <Search size={16} style={{ color: C.inkSoft }} className="mr-2 shrink-0" />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLookup()}
          placeholder="1819 S California Ave"
          className="flex-1 bg-transparent outline-none font-serif text-xl placeholder:opacity-40"
          style={{ color: C.ink }}
          autoComplete="street-address"
        />
      </div>
      <button
        onClick={onLookup}
        disabled={loading || !address.trim()}
        className="mt-4 w-full py-3.5 font-mono text-[11px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 transition disabled:opacity-40"
        style={{ background: C.ink, color: C.cream }}
      >
        {loading ? (<><Loader2 size={14} className="animate-spin" /> Searching</>) : (<>Find my schedule <ArrowRight size={14} /></>)}
      </button>
      <button
        onClick={onUseLocation}
        disabled={locating || loading}
        className="mt-2 w-full py-2.5 border font-mono text-[10px] tracking-[0.25em] uppercase flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ borderColor: C.ink, color: C.ink }}
      >
        {locating ? (<><Loader2 size={12} className="animate-spin" /> Locating</>) : (<><Navigation size={12} /> Use current location</>)}
      </button>
    </div>
  </div>
);

const ErrorPanel = ({ message, onDismiss }) => (
  <div className="mx-5 mt-4 border-2 p-4 slide-up" style={{ borderColor: C.red, background: '#FAEBEB' }}>
    <div className="flex items-start gap-3">
      <AlertTriangle size={18} style={{ color: C.red }} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: C.red }}>Couldn't find it</div>
        <div className="text-sm leading-relaxed" style={{ color: C.ink }}>{message}</div>
      </div>
      <button onClick={onDismiss} className="font-mono text-xs px-2" style={{ color: C.red }}>✕</button>
    </div>
  </div>
);

const NextSweepHero = ({ next, ward, section }) => {
  if (!next) {
    return (
      <div className="mx-5 mt-6 border-2 p-6 text-center" style={{ borderColor: C.green, background: '#E8E4D0' }}>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: C.green }}>Season Concluded</div>
        <p className="font-serif text-2xl mt-2" style={{ color: C.ink }}>No more sweeps this year.</p>
        <p className="text-sm mt-1" style={{ color: C.inkSoft }}>Schedule resumes April {SCHEDULE_YEAR + 1}.</p>
      </div>
    );
  }
  const days = daysFromToday(next.date);
  const isUrgent = days <= 2;
  const accent = isUrgent ? C.red : C.green;
  const bg = isUrgent ? '#FAEBEB' : '#E8E4D0';
  const headline = days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : days < 0 ? `${Math.abs(days)} days ago` : `In ${days} days`;

  return (
    <div className="mx-5 mt-6 slide-up">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2" style={{ color: accent }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: accent }} />
        ✦ Section II — Your Next Sweep
      </div>
      <div className="border-2 relative overflow-hidden" style={{ borderColor: C.ink, background: bg }}>
        {/* corner ornament */}
        <div className="absolute top-2 left-2 font-mono text-[9px]" style={{ color: C.ink }}>◢</div>
        <div className="absolute top-2 right-2 font-mono text-[9px]" style={{ color: C.ink }}>◣</div>
        <div className="absolute bottom-2 left-2 font-mono text-[9px]" style={{ color: C.ink }}>◥</div>
        <div className="absolute bottom-2 right-2 font-mono text-[9px]" style={{ color: C.ink }}>◤</div>

        <div className="px-5 py-7 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: accent }}>
            {isUrgent && '⚠ '}Move your car{isUrgent && ' ⚠'}
          </div>
          <div className="font-serif mt-3 leading-[0.95]" style={{ color: C.ink, fontSize: 'clamp(48px, 14vw, 76px)' }}>
            {headline}
          </div>
          <div className="font-serif italic mt-1" style={{ color: C.inkSoft, fontSize: 'clamp(18px, 5vw, 22px)' }}>
            {dayOfWeek(next.date)}, {monthName(next.date)} {next.date.getDate()}
          </div>

          <div className="my-5 mx-auto w-12 border-t" style={{ borderColor: C.ink }} />

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60" style={{ color: C.ink }}>Ward</div>
              <div className="font-serif text-3xl" style={{ color: C.ink }}>{ward}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60" style={{ color: C.ink }}>Section</div>
              <div className="font-serif text-3xl" style={{ color: C.ink }}>{section}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScheduleAlmanac = ({ dates, onDownload }) => {
  const today = startOfDay(new Date());
  const upcoming = dates.filter((d) => startOfDay(d.date) >= today);
  const past = dates.filter((d) => startOfDay(d.date) < today);

  // group by month
  const grouped = useMemo(() => {
    const g = {};
    dates.forEach((d) => {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!g[key]) g[key] = { label: monthName(d.date), entries: [] };
      g[key].entries.push(d);
    });
    return Object.values(g);
  }, [dates]);

  return (
    <div className="px-5 mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: C.red }}>✦ Section III</div>
          <h3 className="font-serif text-3xl mt-1" style={{ color: C.ink }}>Full Almanac</h3>
        </div>
        <button
          onClick={onDownload}
          className="border px-3 py-2 font-mono text-[9px] tracking-[0.2em] uppercase flex items-center gap-1.5"
          style={{ borderColor: C.ink, color: C.ink }}
        >
          <Download size={11} /> .ics
        </button>
      </div>
      <div className="border-t-2 pt-4" style={{ borderColor: C.ink }}>
        {grouped.map((group, gi) => (
          <div key={gi} className="mb-6">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 flex items-center gap-2" style={{ color: C.inkSoft }}>
              <span>{group.label}</span>
              <span className="flex-1 border-t" style={{ borderColor: C.inkSoft, opacity: 0.3 }} />
              <span>{group.entries.length} dates</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.entries.map((entry, ei) => {
                const isPast = startOfDay(entry.date) < today;
                const isToday = daysFromToday(entry.date) === 0;
                return (
                  <div
                    key={ei}
                    className="border p-3 relative"
                    style={{
                      borderColor: isToday ? C.red : C.ink,
                      borderWidth: isToday ? '2px' : '1px',
                      background: isToday ? '#FAEBEB' : isPast ? 'transparent' : '#FAF4E0',
                      opacity: isPast ? 0.4 : 1,
                    }}
                  >
                    <div className="absolute top-1 right-1.5 font-mono text-[8px] tracking-wider opacity-50" style={{ color: C.ink }}>
                      Side {entry.sideLabel}
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: isToday ? C.red : C.inkSoft }}>
                      {dayShort(entry.date)}
                    </div>
                    <div className="font-serif text-3xl leading-none mt-0.5" style={{ color: C.ink }}>
                      {entry.date.getDate()}
                    </div>
                    <div className="font-mono text-[9px] uppercase mt-1 opacity-60" style={{ color: C.ink }}>
                      {monthShort(entry.date)}
                    </div>
                    {isPast && <div className="absolute inset-0 flex items-center justify-center"><span className="font-mono text-[8px] tracking-[0.2em] uppercase rotate-[-12deg] border px-2 py-0.5" style={{ color: C.inkSoft, borderColor: C.inkSoft }}>Done</span></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Footnotes = ({ address }) => (
  <div className="px-5 mt-8 mb-6">
    <div className="border-t-2 pt-4" style={{ borderColor: C.ink }}>
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: C.red }}>
        Fine print
      </div>
      <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: C.inkSoft }}>
        <li>· <strong>Two consecutive dates = one for each side.</strong> Watch the orange temporary signs to know which side is yours on which day.</li>
        <li>· The fine for parking on a swept street is up to <strong>$60</strong>.</li>
        <li>· Some streets have permanent signs with their own schedule. Always check the post.</li>
        <li>· Sweeping runs roughly 9am–2pm, weekdays, weather permitting.</li>
        <li>· Schedule data: City of Chicago Open Data Portal · {SCHEDULE_YEAR} season.</li>
      </ul>
      {address && (
        <div className="mt-4 pt-3 border-t font-mono text-[10px] leading-relaxed" style={{ borderColor: C.inkSoft, color: C.inkSoft, opacity: 0.7 }}>
          Looked up: {address}
        </div>
      )}
    </div>
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────
export default function App() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const runLookup = async (lat, lon, displayOverride) => {
    setError(null);
    setLoading(true);
    try {
      let coords = { lat, lon };
      let display = displayOverride;
      if (!coords.lat || !coords.lon) {
        const g = await geocode(address);
        coords = { lat: g.lat, lon: g.lon };
        display = g.display;
      }
      const { ward, section } = await lookupZone(coords.lat, coords.lon);
      const dates = await fetchSchedule(ward, section);
      setResult({ ward, section, dates, display, coords });
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!address.trim()) return;
    runLookup();
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser doesn\'t support location access.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        await runLookup(pos.coords.latitude, pos.coords.longitude, 'Current location');
      },
      (err) => {
        setLocating(false);
        setError('Couldn\'t get your location. ' + (err.message || ''));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const next = useMemo(() => {
    if (!result) return null;
    const today = startOfDay(new Date());
    return result.dates.find((d) => startOfDay(d.date) >= today) || null;
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
    <div className="min-h-screen grain" style={{ background: C.cream, color: C.ink }}>
      <Fonts />
      <div className="max-w-xl mx-auto" style={{ background: C.cream }}>
        <Masthead />
        <InputCard
          address={address}
          setAddress={setAddress}
          onLookup={handleSubmit}
          onUseLocation={handleUseLocation}
          loading={loading}
          locating={locating}
        />
        {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}
        {result && (
          <>
            <NextSweepHero next={next} ward={result.ward} section={result.section} />
            <ScheduleAlmanac dates={result.dates} onDownload={handleDownload} />
            <Footnotes address={result.display} />
          </>
        )}
        {!result && !error && (
          <div className="px-5 mt-8 mb-10">
            <div className="border-t-2 pt-4" style={{ borderColor: C.ink }}>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-3" style={{ color: C.red }}>
                How it works
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { n: 'i.', t: 'Type your address', d: 'Or tap "current location"' },
                  { n: 'ii.', t: 'We find your zone', d: 'Ward + section, automatic' },
                  { n: 'iii.', t: 'See every date', d: 'For the whole season' },
                ].map((s, i) => (
                  <div key={i} className="border p-3" style={{ borderColor: C.ink }}>
                    <div className="font-serif italic text-2xl" style={{ color: C.red }}>{s.n}</div>
                    <div className="font-mono text-[10px] tracking-[0.15em] uppercase mt-1" style={{ color: C.ink }}>{s.t}</div>
                    <div className="text-[10px] mt-1" style={{ color: C.inkSoft, opacity: 0.7 }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="px-5 py-4 border-t-2 text-center" style={{ borderColor: C.ink }}>
          <div className="font-mono text-[9px] tracking-[0.3em] uppercase" style={{ color: C.inkSoft }}>
            ⬩ Built in Chicago ⬩ Data via City Open Data Portal ⬩
          </div>
        </div>
      </div>
    </div>
  );
}

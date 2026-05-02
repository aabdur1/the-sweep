import type { RecentLookup } from '../types';

const KEY = 'sweep.recentLookups';
const LIMIT = 3;

const safeRead = (): RecentLookup[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentLookup[];
  } catch {
    return [];
  }
};

const safeWrite = (next: RecentLookup[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  } catch {
    /* ignore */
  }
};

export const list = (): RecentLookup[] => safeRead();

export const record = (entry: Omit<RecentLookup, 'lookedUpAt'>): void => {
  const all = safeRead();
  // De-dupe by query (case-insensitive) — recent search re-pushes to front.
  const filtered = all.filter(
    (r) => r.query.toLowerCase() !== entry.query.toLowerCase()
  );
  const next: RecentLookup[] = [
    { ...entry, lookedUpAt: Date.now() },
    ...filtered,
  ].slice(0, LIMIT);
  safeWrite(next);
};

export const STORAGE_KEY = KEY;

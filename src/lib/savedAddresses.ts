import type { SavedAddress } from '../types';

const KEY = 'sweep.savedAddresses';
const LIMIT = 10;
const COORD_EQ = (a: number, b: number) => Math.abs(a - b) < 1e-5;

const safeRead = (): SavedAddress[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedAddress[];
  } catch {
    return [];
  }
};

const safeWrite = (next: SavedAddress[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  } catch {
    /* private mode */
  }
};

export const list = (): SavedAddress[] => safeRead();

export const exists = (lat: number, lon: number): SavedAddress | undefined =>
  safeRead().find((s) => COORD_EQ(s.lat, lat) && COORD_EQ(s.lon, lon));

export const add = (
  entry: Omit<SavedAddress, 'id' | 'savedAt'>
): SavedAddress => {
  const all = safeRead();
  // De-dupe by coordinates (rounded to ~1m precision).
  const dup = all.find((s) => COORD_EQ(s.lat, entry.lat) && COORD_EQ(s.lon, entry.lon));
  if (dup) return dup;
  const created: SavedAddress = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  const next = [created, ...all].slice(0, LIMIT);
  safeWrite(next);
  return created;
};

export const rename = (id: string, label: string): void => {
  safeWrite(safeRead().map((s) => (s.id === id ? { ...s, label } : s)));
};

export const remove = (id: string): void => {
  safeWrite(safeRead().filter((s) => s.id !== id));
};

export const STORAGE_KEY = KEY;

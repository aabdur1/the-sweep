/**
 * Theme module — light/dark mode detection, persistence, and application.
 *
 * Architecture:
 * - A `.dark` class on `<html>` is the single source of truth at runtime.
 * - `localStorage['sweep.theme']` is the user's explicit override (or absent
 *   if they've never toggled, in which case OS preference wins).
 * - `applyMode` is called both by the inline pre-mount script in index.html
 *   (synchronously, before React hydrates) and by the `useTheme` hook (after
 *   user interaction). Both paths must use the SAME class name and storage
 *   key, hence this module exports them as constants.
 *
 * No React imports — this module is also referenced by inline JS in index.html.
 */

export type Mode = 'light' | 'dark';

export const STORAGE_KEY = 'sweep.theme';
export const DARK_CLASS = 'dark';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Read the persisted override, if any. Tolerates missing/blocked localStorage. */
export const readPersistedMode = (): Mode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
};

/** Persist the user's explicit choice. Silently no-ops if storage is blocked. */
export const persistMode = (mode: Mode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* iOS Safari private mode etc. — degrade gracefully */
  }
};

/** Forget the user's choice (so we fall back to OS pref). Currently unused by UI; exported for completeness. */
export const clearPersistedMode = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
};

/** Read the OS preference at the moment of call. */
export const readSystemMode = (): Mode => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
};

/** The mode to use on initial paint: persisted choice if present, else OS pref. */
export const getInitialMode = (): Mode => {
  return readPersistedMode() ?? readSystemMode();
};

/** Toggle the `.dark` class on `<html>`. Pure DOM mutation, no state. */
export const applyMode = (mode: Mode): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add(DARK_CLASS);
  else root.classList.remove(DARK_CLASS);
};

/** Read the current applied mode by inspecting the DOM. */
export const readAppliedMode = (): Mode => {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
};

/**
 * Subscribe to OS preference changes. The callback fires only when the user
 * has NOT made an explicit choice (i.e. `readPersistedMode()` is null).
 * Returns an unsubscribe function.
 */
export const subscribeToSystemPref = (cb: (mode: Mode) => void): (() => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(MEDIA_QUERY);
  const handler = (e: MediaQueryListEvent) => {
    if (readPersistedMode() !== null) return; // user has overridden; don't track OS
    cb(e.matches ? 'dark' : 'light');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
};

import { useCallback, useEffect, useState } from 'react';
import {
  applyMode,
  persistMode,
  readAppliedMode,
  subscribeToSystemPref,
  type Mode,
} from '../lib/theme';

/**
 * React hook for the current theme mode.
 *
 * The DOM is the source of truth — the inline pre-mount script in index.html
 * has already set the `.dark` class before React mounts, so we initialize
 * from `readAppliedMode()` rather than re-running the detection logic.
 */
export interface UseThemeApi {
  mode: Mode;
  toggle: () => void;
}

export const useTheme = (): UseThemeApi => {
  const [mode, setMode] = useState<Mode>(() => readAppliedMode());

  useEffect(() => {
    return subscribeToSystemPref((next) => {
      applyMode(next);
      setMode(next);
    });
  }, []);

  const toggle = useCallback(() => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    persistMode(next);
    applyMode(next);
    setMode(next);
  }, [mode]);

  return { mode, toggle };
};

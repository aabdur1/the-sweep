import { useEffect, useState } from 'react';
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
export const useTheme = (): { mode: Mode; toggle: () => void } => {
  const [mode, setMode] = useState<Mode>(() => readAppliedMode());

  useEffect(() => {
    return subscribeToSystemPref((next) => {
      applyMode(next);
      setMode(next);
    });
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    persistMode(next);
    applyMode(next);
    setMode(next);
  };

  return { mode, toggle };
};

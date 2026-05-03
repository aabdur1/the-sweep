import { useTheme } from '../hooks/useTheme';
import type { Mode } from '../lib/theme';

/**
 * Edition-bar text toggle: `Light · Dark`. Active mode in chicago-red, inactive
 * in ink-soft with hover. Inherits parent typography (mono caps, tracking),
 * so it sits inline alongside the other edition-bar metadata cleanly.
 */
export const ThemeToggle = () => {
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';

  const setMode = (target: Mode) => {
    if (mode !== target) toggle();
  };

  const baseBtn =
    'print:hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-chicago-red';
  const active = 'text-chicago-red';
  const inactive = 'text-ink-soft hover:text-ink transition-colors cursor-pointer';

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setMode('light')}
        aria-label="Switch to light mode"
        aria-pressed={!isDark}
        className={`${baseBtn} ${isDark ? inactive : active}`}
      >
        Light
      </button>
      <span className="text-ink-soft" aria-hidden>·</span>
      <button
        type="button"
        onClick={() => setMode('dark')}
        aria-label="Switch to dark mode"
        aria-pressed={isDark}
        className={`${baseBtn} ${isDark ? active : inactive}`}
      >
        Dark
      </button>
    </span>
  );
};

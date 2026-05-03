import { useTheme } from '../hooks/useTheme';
import { ChicagoStar } from './ChicagoStar';

export const ThemeToggle = () => {
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="print:hidden text-chicago-red hover:scale-110 transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chicago-red"
    >
      <ChicagoStar size={14} outlined={isDark} />
    </button>
  );
};

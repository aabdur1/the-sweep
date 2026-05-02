import { SCHEDULE_YEAR } from '../types';

interface Props {
  address: string | null;
}

export const Footnotes = ({ address }: Props) => (
  <div className="px-5 mt-8 mb-6">
    <div className="border-t-2 border-ink pt-4">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-2 text-chicago-red">
        Fine print
      </div>
      <ul className="text-xs leading-relaxed space-y-1.5 text-ink-soft">
        <li>· <strong>Two consecutive dates = one for each side.</strong> Watch the orange temporary signs to know which side is yours on which day.</li>
        <li>· The fine for parking on a swept street is up to <strong>$60</strong>.</li>
        <li>· Some streets have permanent signs with their own schedule. Always check the post.</li>
        <li>· Sweeping runs roughly 9am–2pm, weekdays, weather permitting.</li>
        <li>· Schedule data: City of Chicago Open Data Portal · {SCHEDULE_YEAR} season.</li>
      </ul>
      {address && (
        <div className="mt-4 pt-3 border-t border-ink-soft font-mono text-[10px] leading-relaxed text-ink-soft opacity-70">
          Looked up: {address}
        </div>
      )}
    </div>
  </div>
);

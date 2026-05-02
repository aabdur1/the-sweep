import { ChicagoStar } from './ChicagoStar';

interface Note {
  kicker: string;
  body: string;
  /** Optional small italic gloss shown below the body. */
  hint?: string;
}

const LEFT_NOTES: Note[] = [
  { kicker: 'The fine', body: '$60' },
  { kicker: 'Hours', body: '9–2' },
  { kicker: 'Days', body: 'Mon–Fri' },
];

const RIGHT_NOTES: Note[] = [
  { kicker: 'Recycling', body: 'Biweekly' },
  {
    kicker: 'Cycle',
    body: 'Yellow / Orange',
    hint: 'Half the city goes out each week. Your address sits on one color; pickup only happens on your color’s week.',
  },
  { kicker: 'Garbage', body: 'Weekly' },
];

interface NoteBlockProps {
  note: Note;
  /** Which side the marginalia is on, so the tooltip extends into the page. */
  tooltipSide: 'left' | 'right';
}

const NoteBlock = ({ note, tooltipSide }: NoteBlockProps) => {
  const hasHint = !!note.hint;
  // Tooltip sits on the page-side of the gutter:
  //   right gutter → tooltip extends LEFT (right-full)
  //   left gutter  → tooltip extends RIGHT (left-full)
  const tooltipPos =
    tooltipSide === 'right'
      ? 'right-full mr-3'
      : 'left-full ml-3';

  const body = (
    <span className={`font-serif italic text-2xl leading-tight text-ink ${hasHint ? 'cursor-help' : ''}`}>
      {note.body}
      {hasHint && (
        <sup className="font-sans not-italic text-chicago-red text-[14px] tracking-normal align-super ml-[1px] transition-transform group-hover:scale-110 group-focus-within:scale-110 inline-block">
          *
        </sup>
      )}
    </span>
  );

  return (
    <div className="border-y border-ink/40 py-3 my-3 relative group">
      <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-chicago-red mb-1">
        {note.kicker}
      </div>
      {hasHint ? (
        <span
          tabIndex={0}
          role="button"
          aria-describedby={`hint-${note.kicker}`}
          className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-chicago-red focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          {body}
        </span>
      ) : (
        body
      )}
      {hasHint && (
        <div
          id={`hint-${note.kicker}`}
          role="tooltip"
          className={`absolute top-1/2 -translate-y-1/2 ${tooltipPos} w-60 border-2 border-ink bg-cream-dark p-3 z-20 pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 shadow-[2px_2px_0_0_rgba(15,26,46,0.15)]`}
        >
          <div className="font-mono text-[8.5px] tracking-[0.3em] uppercase text-chicago-red mb-1.5">
            The cycle, explained
          </div>
          <p className="font-serif italic text-[13px] leading-snug text-ink">{note.hint}</p>
        </div>
      )}
    </div>
  );
};

const VerticalLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    className="font-mono text-[9px] tracking-[0.4em] uppercase text-ink-soft whitespace-nowrap"
    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
  >
    {children}
  </div>
);

interface Props {
  side: 'left' | 'right';
}

export const Marginalia = ({ side }: Props) => {
  const notes = side === 'left' ? LEFT_NOTES : RIGHT_NOTES;
  return (
    <aside className="hidden lg:flex flex-col px-3 py-6 relative">
      {/* Vertical rule against the page content */}
      <div
        className={`absolute top-6 bottom-6 ${side === 'left' ? 'right-0' : 'left-0'} w-[1px] bg-ink/30`}
      />

      {/* Top short architectural label, comfortably tall so rotated text never bleeds */}
      <div className="flex items-center justify-center mb-4 h-40 overflow-hidden">
        <VerticalLabel>{side === 'left' ? 'Issue · 01' : 'Almanac'}</VerticalLabel>
      </div>

      {/* Star divider */}
      <div className="flex justify-center mb-1">
        <ChicagoStar size={11} className="text-chicago-red" />
      </div>

      {/* Pulled quotes */}
      <div className="text-center px-1">
        {notes.map((n) => (
          <NoteBlock key={n.kicker} note={n} tooltipSide={side} />
        ))}
      </div>

      {/* Bottom ornament — vertical row of small stars */}
      <div className="flex flex-col items-center gap-1.5 mt-auto pt-6">
        <ChicagoStar size={8} className="text-ink/60" />
        <ChicagoStar size={8} className="text-ink/60" />
        <ChicagoStar size={8} className="text-ink/60" />
      </div>

      {/* Page-number-style mark at the bottom */}
      <div className="text-center mt-3 font-mono text-[9px] tracking-[0.3em] uppercase text-ink-soft">
        {side === 'left' ? '— II —' : '— III —'}
      </div>
    </aside>
  );
};

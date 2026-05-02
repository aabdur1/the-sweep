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

const NoteBlock = ({ note }: { note: Note }) => (
  <div className="border-y border-ink/40 py-3 my-3">
    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-chicago-red mb-1">
      {note.kicker}
    </div>
    <div className="font-serif italic text-2xl leading-tight text-ink">{note.body}</div>
    {note.hint && (
      <p className="font-sans text-[10px] leading-snug text-ink-soft mt-2">
        {note.hint}
      </p>
    )}
  </div>
);

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
          <NoteBlock key={n.kicker} note={n} />
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

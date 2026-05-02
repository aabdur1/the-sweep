import { X } from 'lucide-react';
import type { SavedAddress } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  saved: SavedAddress[];
  onPick: (s: SavedAddress) => void;
  onRemove: (id: string) => void;
}

export const SavedAddressChips = ({ saved, onPick, onRemove }: Props) => {
  if (saved.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {saved.map((s) => (
        <div
          key={s.id}
          className="inline-flex items-center border-2 border-ink bg-cream-dark"
        >
          <button
            onClick={() => onPick(s)}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-ink px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-ink hover:text-cream transition-colors"
          >
            <ChicagoStar size={9} />
            <span className="truncate max-w-[12ch]">{s.label}</span>
          </button>
          <button
            onClick={() => onRemove(s.id)}
            aria-label={`Remove ${s.label}`}
            className="border-l-2 border-ink px-1.5 py-1.5 text-ink-soft hover:bg-chicago-red hover:text-cream transition-colors"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
};

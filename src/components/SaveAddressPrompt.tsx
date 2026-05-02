import { useState } from 'react';
import type { SavedAddress, LookupResult } from '../types';
import { ChicagoStar } from './ChicagoStar';

interface Props {
  result: LookupResult;
  existingSave: SavedAddress | undefined;
  onSave: (label: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export const SaveAddressPrompt = ({ result, existingSave, onSave, onRename, onRemove }: Props) => {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(existingSave?.label ?? result.display);

  if (existingSave && !editing) {
    return (
      <div className="mx-5 mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-ink-soft">
        <ChicagoStar size={9} className="text-chicago-blue" />
        <span>Saved as <em className="font-serif not-italic text-ink">{existingSave.label}</em></span>
        <button onClick={() => setEditing(true)} className="underline hover:text-ink">edit</button>
        <button onClick={() => onRemove(existingSave.id)} className="underline hover:text-chicago-red">remove</button>
      </div>
    );
  }

  if (editing && existingSave) {
    return (
      <form
        className="mx-5 mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRename(existingSave.id, label.trim() || existingSave.label);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          className="flex-1 border-2 border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] bg-cream"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="bg-ink text-cream px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="border border-ink px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Cancel</button>
      </form>
    );
  }

  if (editing) {
    return (
      <form
        className="mx-5 mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label.trim() || result.display);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          className="flex-1 border-2 border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] bg-cream"
          placeholder="Label, e.g. Home / Work"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="bg-ink text-cream px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="border border-ink px-3 py-1 font-mono text-[10px] tracking-[0.25em] uppercase">Cancel</button>
      </form>
    );
  }

  return (
    <div className="mx-5 mt-3">
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase text-ink hover:bg-ink hover:text-cream transition-colors"
      >
        <ChicagoStar size={9} /> Save this address
      </button>
    </div>
  );
};

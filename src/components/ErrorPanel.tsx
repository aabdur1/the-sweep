import { AlertTriangle } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export const ErrorPanel = ({ message, onDismiss }: Props) => (
  <div className="mx-5 mt-4 slide-up">
    {/* Stamped heading */}
    <div className="flex items-center gap-2">
      <AlertTriangle size={14} strokeWidth={2.5} className="text-chicago-red" />
      <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-chicago-red">
        Dispatch failed
      </span>
      <span className="flex-1 border-b border-chicago-red/40" />
      <button
        onClick={onDismiss}
        className="font-mono text-[10px] tracking-[0.25em] uppercase text-chicago-red px-2 hover:bg-chicago-red hover:text-cream transition-colors"
      >
        × Dismiss
      </button>
    </div>
    <div className="border-t-2 border-chicago-red mt-1" />
    <div className="border-t border-chicago-red mt-[2px]" />

    {/* Body */}
    <div className="border-x-2 border-b-2 border-chicago-red px-4 py-3" style={{ background: 'var(--tint-urgency)' }}>
      <p className="font-serif italic text-[15px] leading-snug text-ink">{message}</p>
    </div>
  </div>
);

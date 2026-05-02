import { AlertTriangle } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export const ErrorPanel = ({ message, onDismiss }: Props) => (
  <div className="mx-5 mt-4 border-2 border-chicago-red p-4 slide-up" style={{ background: '#FAEBEB' }}>
    <div className="flex items-start gap-3">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-chicago-red" />
      <div className="flex-1">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1 text-chicago-red">
          Couldn't find it
        </div>
        <div className="text-sm leading-relaxed text-ink">{message}</div>
      </div>
      <button onClick={onDismiss} className="font-mono text-xs px-2 text-chicago-red">✕</button>
    </div>
  </div>
);

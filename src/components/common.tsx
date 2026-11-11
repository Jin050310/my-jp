import { useEffect, useRef, type ReactNode } from 'react';
import { useStore } from '../store';

export function EmptyState({
  title,
  steps,
  actionLabel,
  onAction,
  secondary,
}: {
  title: string;
  steps: string[];
  actionLabel: string;
  onAction: () => void;
  secondary?: ReactNode;
}) {
  return (
    <div className="empty card">
      <h2>{title}</h2>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="row">
        <button className="btn primary" onClick={onAction}>
          {actionLabel}
        </button>
        {secondary}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="btn ghost" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function TagChips({ tags, active, onToggle }: { tags: string[]; active?: string | null; onToggle?: (t: string) => void }) {
  if (!tags.length) return null;
  return (
    <div className="chips">
      {tags.map((t) =>
        onToggle ? (
          <button key={t} className={`chip${active === t ? ' on' : ''}`} onClick={() => onToggle(t)}>
            #{t}
          </button>
        ) : (
          <span key={t} className="chip">
            #{t}
          </span>
        ),
      )}
    </div>
  );
}

export function ToastView() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          className="btn link"
          onClick={() => {
            toast.undo?.();
          }}
        >
          되돌리기
        </button>
      )}
      <button className="btn link" onClick={dismissToast} aria-label="알림 닫기">
        닫기
      </button>
    </div>
  );
}

import { useEffect, useRef } from 'react';

export interface UnsavedChangesModalProps {
  title: string;
  /** Names exactly what is kept: "draft edit · 1:41 of 3:02 kept · saved 12s ago". */
  summary: string;
  onLeave: () => void;
  onStay: () => void;
  onDiscard: () => void;
}

/** V4 — leaving the editor.
 *
 * The consequence is named, not implied. "You have unsaved changes" tells the
 * user nothing they can act on; "1:41 of 3:02 kept, saved 12s ago" tells them
 * whether they care.
 *
 * Presentational on purpose: it reads nothing from context, so the copy and
 * the button ordering are testable without mounting an editor. */
export function UnsavedChangesModal({
  title, summary, onLeave, onStay, onDiscard,
}: UnsavedChangesModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape means stay: it is the reversible choice, and a dialog that
    // discards work on Escape is a trap.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,7,8,.6)', padding: 20,
    }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Leave the editor?"
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--sr-surface-paper)',
          border: '1px solid var(--sr-border-light)',
          padding: 22,
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>
          Leave the editor?
        </h2>

        <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 500 }}>{title}</p>

        <p style={{
          margin: '0 0 18px', fontFamily: 'var(--sr-font-mono)', fontSize: 11,
          color: 'var(--sr-text-faint-on-light)',
        }}>{summary}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onLeave} style={primary}>Leave, keep the draft</button>
          <button type="button" onClick={onStay} style={secondary}>Stay in the editor</button>
        </div>

        {/* Destructive: separated by a band, outlined not filled, and it names
            what is lost before it happens. */}
        <div data-separated style={{
          marginTop: 14, paddingTop: 14,
          borderTop: '1px solid var(--sr-border-light-soft)',
        }}>
          <button
            type="button"
            onClick={onDiscard}
            title="Discard the draft — this cannot be undone"
            style={destructive}
          >Discard the draft</button>
        </div>
      </div>
    </div>
  );
}

const primary = {
  height: 'var(--sr-h-md)',
  border: 'none',
  background: 'var(--sr-text-primary-on-light)',
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const secondary = {
  height: 'var(--sr-h-md)',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 13.5,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const destructive = {
  width: '100%',
  height: 'var(--sr-h-sm)',
  border: '1px solid var(--sr-coral-text)',
  background: 'transparent',
  color: 'var(--sr-coral-hover)',
  fontSize: 12.5,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

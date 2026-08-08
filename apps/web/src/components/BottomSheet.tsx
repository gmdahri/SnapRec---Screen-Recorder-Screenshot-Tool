import { type ReactNode, useEffect, useRef } from 'react';

export interface BottomSheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** A modal sheet anchored to the bottom edge.
 *
 * Below 768 every menu becomes one of these: a popover anchored to a 32px
 * button is unusable with a thumb, and a dropdown that opens upward off-screen
 * is worse. */
export function BottomSheet({ label, onClose, children }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, border: 'none', cursor: 'pointer',
          background: 'rgba(4,7,8,.5)',
        }}
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          position: 'relative', width: '100%', maxHeight: '80vh', overflowY: 'auto',
          background: 'var(--sr-surface-paper)',
          padding: '10px 0 24px',
        }}
      >
        <span aria-hidden="true" style={{
          display: 'block', width: 34, height: 4, margin: '0 auto 12px',
          background: 'var(--sr-border-light)',
        }} />
        {children}
      </div>
    </div>
  );
}

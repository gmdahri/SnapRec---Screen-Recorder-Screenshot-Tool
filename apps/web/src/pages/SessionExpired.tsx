export interface SessionExpiredProps {
  email: string;
  /** Named so the user knows what is waiting, not merely that something is. */
  unsavedWork?: { title: string; kind: string };
  onSignIn: () => void;
}

/** A5 — not an error.
 *
 * A session ending after 30 days is the system working. No coral, no alarm —
 * just what happened, what is waiting, and the one action. */
export function SessionExpired({ email, unsavedWork, onSignIn }: SessionExpiredProps) {
  return (
    <main style={{
      maxWidth: 440, width: '100%',
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: 26,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>
        Your session expired
      </h1>

      <p style={{
        margin: 0, fontSize: 13.5, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        You were signed out after 30 days. Sign back in as <strong style={{ fontWeight: 600 }}>{email}</strong> to
        pick up where you left off.
      </p>

      {unsavedWork && (
        <p style={{
          margin: 0, padding: '10px 12px',
          background: 'var(--sr-surface-panel-light)',
          fontSize: 12.5, lineHeight: 1.55,
          color: 'var(--sr-text-muted-on-light)',
        }}>
          One unsaved {unsavedWork.kind} to <strong style={{ fontWeight: 600 }}>{unsavedWork.title}</strong> is
          still on this device. Signing back in restores it.
        </p>
      )}

      <button type="button" onClick={onSignIn} style={{
        marginTop: 4, height: 'var(--sr-h-md)', border: 'none',
        background: 'var(--sr-text-primary-on-light)', color: '#fff',
        fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        borderRadius: 'var(--sr-radius-control)',
      }}>Sign back in</button>
    </main>
  );
}

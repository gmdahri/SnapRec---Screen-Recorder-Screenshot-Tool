export interface PrivateCaptureProps {
  owner: string;
  onRequestAccess: () => void;
}

/** C5 — quiet intensity.
 *
 * No media, so no frame, no registration marks, no metadata margin. The
 * optical language survives only as alignment and one neutral outlined mark.
 *
 * Not an error: nothing has broken, the viewer simply lacks access — so no
 * coral, and the copy names the owner and offers the one useful action. */
export function PrivateCapture({ owner, onRequestAccess }: PrivateCaptureProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--sr-surface-panel-light)',
    }}>
      <main style={{
        maxWidth: 460, width: '100%',
        background: 'var(--sr-surface-paper)',
        border: '1px solid var(--sr-border-light-soft)',
        padding: 28,
      }}>
        {/* One neutral mark. Not a registration frame — there is nothing to
            register against. */}
        <span aria-hidden="true" style={{
          display: 'block', width: 18, height: 18, marginBottom: 18,
          borderLeft: '2px solid var(--sr-border-light)',
          borderTop: '2px solid var(--sr-border-light)',
        }} />

        <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
          This capture is private
        </h1>

        <p style={{
          margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.6,
          color: 'var(--sr-text-muted-on-light)',
        }}>
          {owner} hasn&apos;t shared this one with you. You can ask for access
          and they&apos;ll get a notification.
        </p>

        <button type="button" onClick={onRequestAccess} style={{
          height: 'var(--sr-h-md)', padding: '0 18px', border: 'none',
          background: 'var(--sr-text-primary-on-light)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          borderRadius: 'var(--sr-radius-control)',
        }}>Request access</button>

        {/* The only promotion on any share surface, and only because there is
            nothing to look at. */}
        <div style={{
          marginTop: 24, paddingTop: 18,
          borderTop: '1px solid var(--sr-border-light-soft)',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>What is SnapRec?</h2>
          <p style={{
            margin: 0, fontSize: 12.5, lineHeight: 1.6,
            color: 'var(--sr-text-muted-on-light)',
          }}>
            A screen recorder and screenshot tool for Chrome. Record a tab,
            trim it, and share a link — no account needed to record.
          </p>
        </div>
      </main>
    </div>
  );
}

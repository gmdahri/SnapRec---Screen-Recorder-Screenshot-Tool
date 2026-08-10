import { CaptureFrame } from '@snaprec/design-system';

/** L5 — an empty library.
 *
 * Deliberately different copy from NoResults: this state offers capture,
 * that one offers changing the query. They must never share a sentence, or
 * the user cannot tell which situation they are in. */
export function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 16, padding: '64px 20px', textAlign: 'center',
    }}>
      {/* The illustration is the system's own frame, not a stock drawing. */}
      <CaptureFrame treatment="focused" style={{
        width: 240, height: 135,
        background: 'var(--sr-surface-panel-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10.5,
          color: 'var(--sr-text-faint-on-light)',
        }}>your first capture goes here</span>
      </CaptureFrame>

      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
        Nothing in your library yet
      </h2>

      <p style={{
        margin: 0, maxWidth: '52ch', fontSize: 13.5, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        Record a tab or take a screenshot from the extension. Anything you
        upload lands here, ready to trim, annotate and share.
      </p>

      <a href="https://chrome.google.com/webstore" style={{
        height: 'var(--sr-h-md)', padding: '0 18px',
        display: 'inline-flex', alignItems: 'center',
        background: 'var(--sr-text-primary-on-light)', color: '#fff',
        fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
        borderRadius: 'var(--sr-radius-control)',
      }}>Add SnapRec to Chrome</a>
    </div>
  );
}

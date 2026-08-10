/** Nothing shared yet means nothing to measure. Showing a grid of zeroes
 * would imply the numbers are real and disappointing. */
export function AnalyticsEmpty({ onGoToLibrary }: { onGoToLibrary: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, padding: '56px 20px', textAlign: 'center',
    }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>
        No analytics yet
      </h2>
      <p style={{
        margin: 0, maxWidth: '48ch', fontSize: 13, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        Share a capture and this page starts answering two questions: is anyone
        watching, and does anything need a reply?
      </p>
      <button type="button" onClick={onGoToLibrary} style={{
        height: 'var(--sr-h-2xs)', padding: '0 14px',
        border: '1px solid var(--sr-border-light)', background: 'transparent',
        fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
      }}>Go to library</button>
    </div>
  );
}

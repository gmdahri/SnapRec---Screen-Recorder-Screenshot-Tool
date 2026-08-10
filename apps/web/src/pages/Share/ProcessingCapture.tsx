import { Sweep } from './Sweep';

export interface ProcessingCaptureProps {
  capture: {
    title: string;
    owner: string;
    duration?: string;
    dimensions?: string;
  };
}

/** C6 — the frame stays passive.
 *
 * A boundary and nothing else: no registration marks, because there is nothing
 * to focus on yet, and certainly no handles.
 *
 * The same indeterminate cyan sweep the extension uses while finishing, so
 * viewers and owners read one signal for "work in progress, duration unknown". */
export function ProcessingCapture({ capture }: ProcessingCaptureProps) {
  const known = [capture.duration, capture.dimensions].filter(Boolean).join(' · ');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sr-surface-panel-light)' }}>
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', padding: '0 22px',
        background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{capture.title}</span>
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{capture.owner}{known ? ` · ${known}` : ''}</span>
        </span>
      </header>

      <div style={{ padding: '22px 22px 40px' }}>
        {/* The box is reserved at the known aspect ratio so the page does not
            reflow when the media arrives. */}
        <div
          data-testid="media-reservation"
          style={{
            position: 'relative', width: '100%', aspectRatio: '16 / 9',
            background: 'var(--sr-surface-carbon)',
            border: '1px solid var(--sr-border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 11,
            color: 'var(--sr-text-faint-on-dark)',
          }}>processing</span>

          {/* Indeterminate: a sweeping segment, never a fake percentage. */}
          <Sweep />
        </div>

        {/* Announced once, then the ready state once. The page does not
            poll-announce. */}
        <span role="status" aria-live="polite" data-announce-once="true" style={{
          display: 'block', marginTop: 12, fontSize: 13,
          color: 'var(--sr-text-muted-on-light)',
        }}>
          Still processing — the link already works, and this page will update
          itself when the video is ready.
        </span>
      </div>
    </div>
  );
}

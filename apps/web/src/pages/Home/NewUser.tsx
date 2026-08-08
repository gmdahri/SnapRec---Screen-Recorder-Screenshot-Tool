import { CaptureFrame } from '@snaprec/design-system';
import type { ExtensionStatus } from '../../hooks/useExtensionStatus';

export interface NewUserProps {
  extensionStatus: ExtensionStatus;
  onGoToLibrary: () => void;
}

/** How a capture moves — four steps, verbatim from H2. */
const STEPS = [
  ['01', 'Capture', 'Record a tab or take a screenshot from the extension.'],
  ['02', 'On your device', "It's on your device straight away, before anything uploads."],
  ['03', 'Refine', 'Trim, speed up, auto-zoom, or annotate a screenshot.'],
  ['04', 'Share', 'Upload to get a link. Comments come back on the timeline.'],
] as const;

/** H2. A brand-new account gets the explainer, not five empty sections —
 * a dashboard of zeroes teaches nothing. */
export function NewUser({ extensionStatus, onGoToLibrary }: NewUserProps) {
  const installed = extensionStatus === 'connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CaptureFrame treatment="focused" style={{
          width: 240, height: 135, background: 'var(--sr-surface-carbon)',
        }} />

        <h1 style={{
          margin: 0, fontSize: 30, fontWeight: 700,
          letterSpacing: '-.035em', lineHeight: 1.1,
        }}>Capture it. Make it clear. Share it.</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {installed ? (
            <button type="button" onClick={onGoToLibrary} style={primary}>
              Already installed — open it
            </button>
          ) : (
            <a href="https://chrome.google.com/webstore" style={{ ...primary, textDecoration: 'none' }}>
              Add SnapRec to Chrome
            </a>
          )}
        </div>

        <p style={{
          margin: 0, fontFamily: 'var(--sr-font-mono)', fontSize: 11,
          color: 'var(--sr-text-faint-on-light)',
        }}>
          Free · no watermark · no account needed to record
        </p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
        }}>How a capture moves</span>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
        }}>
          {STEPS.map(([num, label, body]) => (
            <div key={num} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{
                fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                color: 'var(--sr-cyan-on-light)',
              }}>{num}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
              <span style={{
                fontSize: 12.5, lineHeight: 1.55,
                color: 'var(--sr-text-muted-on-light)',
              }}>{body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The guest-claim entry point. The flow itself lands in P6 Task 6; until
          then this routes to the library rather than to a page that does not
          exist yet. */}
      <section style={{
        borderTop: '1px solid var(--sr-border-light-soft)',
        paddingTop: 16,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          Recorded something before signing in?
        </span>
        <span style={{
          fontSize: 12.5, lineHeight: 1.55, color: 'var(--sr-text-muted-on-light)',
        }}>
          Captures made as a guest can be claimed into this account for 7 days.
        </span>
      </section>
    </div>
  );
}

const primary = {
  height: 'var(--sr-h-md)',
  padding: '0 18px',
  display: 'inline-flex',
  alignItems: 'center',
  border: 'none',
  background: 'var(--sr-text-primary-on-light)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

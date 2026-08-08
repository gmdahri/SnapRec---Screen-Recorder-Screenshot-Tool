export type ExportState =
  | { kind: 'exporting'; pct: number; frame: number; frames: number; etaLabel?: string }
  | { kind: 'failed'; frame: number; frames: number };

export interface ExportModalProps {
  state: ExportState;
  onCancel: () => void;
  onRetry: () => void;
  onRetryLower: () => void;
  onBack: () => void;
}

/** V5 and V6 — one component, two states.
 *
 * The same failure grammar as the extension's B3 and Home's H4: what survived,
 * then what happened, then what to do. The reassurance comes first because
 * "did I lose my edit" is the only question that matters at that moment. */
export function ExportModal({ state, onCancel, onRetry, onRetryLower, onBack }: ExportModalProps) {
  const failed = state.kind === 'failed';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(4,7,8,.6)', padding: 20,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={failed ? 'Export failed' : 'Exporting'}
        style={{
          width: '100%', maxWidth: 440,
          background: 'var(--sr-surface-paper)',
          borderLeft: failed ? '2px solid var(--sr-coral-text)' : undefined,
          border: failed ? undefined : '1px solid var(--sr-border-light)',
          padding: 22,
        }}
      >
        {failed && (
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            letterSpacing: '.1em', color: 'var(--sr-coral-hover)',
          }}>export failed</span>
        )}

        <h2 style={{ margin: '6px 0 10px', fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' }}>
          {failed ? 'Export stopped' : 'Exporting'}
        </h2>

        {state.kind === 'exporting' ? (
          <>
            <div style={{ height: 3, background: 'var(--sr-border-light)', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: `${state.pct}%`,
                background: 'var(--sr-cyan)',
                transition: 'width var(--sr-dur-slow) var(--sr-ease)',
              }} />
            </div>

            <p style={{
              margin: '0 0 4px', fontFamily: 'var(--sr-font-mono)', fontSize: 11.5,
              color: 'var(--sr-text-muted-on-light)',
            }}>
              {state.pct}% · frame {state.frame} of {state.frames}
            </p>

            <p style={{
              margin: '0 0 18px', fontSize: 12.5,
              color: 'var(--sr-text-muted-on-light)',
            }}>
              {state.etaLabel ? `${state.etaLabel} · ` : ''}safe to close — the export keeps running.
            </p>

            <button type="button" onClick={onCancel} style={secondary}>Stop export</button>
          </>
        ) : (
          <>
            <p data-testid="failure-body" style={{
              margin: '0 0 18px', fontSize: 13, lineHeight: 1.6,
              color: 'var(--sr-text-muted-on-light)',
            }}>
              Your edit is <strong style={{ fontWeight: 600 }}>saved to library</strong> and the
              source recording is untouched. Rendering stopped at frame {state.frame} of {state.frames}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={onRetry} style={primary}>Try export again</button>
              {/* A second, cheaper route: a failure at 1080p is often a
                  resource limit, and offering only a retry repeats it. */}
              <button type="button" onClick={onRetryLower} style={secondary}>Export at 720p instead</button>
              <button type="button" onClick={onBack} style={secondary}>Back to the editor</button>
            </div>
          </>
        )}
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
  width: '100%',
  height: 'var(--sr-h-md)',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 13.5,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

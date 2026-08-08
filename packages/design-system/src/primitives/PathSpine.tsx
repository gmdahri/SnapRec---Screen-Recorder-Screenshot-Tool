import { PATH_NODES, type PathState } from '../status';

export interface PathSpineProps {
  /** Index of the node currently being entered, 0–3. Nodes below it are done. */
  current: number;
  state?: PathState;
  /** 0–100 within the current node, for determinate work. */
  progress?: number;
  /** 0–100 position of the failure tick along the current segment. */
  breakAt?: number;
}

/** Four nodes, always in the same order. Reused three ways: as the upload
 * progress bar, as the completion surface's spine, and as the library card's
 * status line.
 *
 * Four treatments, one vocabulary:
 *   solid cyan  — in progress
 *   green       — done (the only place green appears in the product)
 *   dashed grey — pending or queued; offline is not a failure
 *   coral + tick— stopped, with the tick marking where */
export function PathSpine({ current, state = 'normal', progress, breakAt }: PathSpineProps) {
  const failed = state === 'failed';
  const dashed = state === 'offline' || state === 'queued';

  const segmentBackground = (i: number) => {
    if (i < current) return 'var(--sr-green)';
    if (i > current) return 'var(--sr-border-light)';
    if (failed) return 'var(--sr-coral-text)';
    if (dashed) return 'transparent';
    return 'var(--sr-cyan)';
  };

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress ?? Math.round((current / PATH_NODES.length) * 100)}
      aria-valuetext={`${PATH_NODES[Math.min(current, PATH_NODES.length - 1)]}${failed ? ' — stopped' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${PATH_NODES.length}, 1fr)`,
        gap: 2,
      }}
    >
      {PATH_NODES.map((node, i) => {
        const done = i < current;
        const isCurrent = i === current;

        return (
          <div key={node} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ position: 'relative', height: 3, background: 'var(--sr-border-light-soft)' }}>
              <span
                data-testid={`spine-segment-${i}`}
                style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: done ? '100%' : isCurrent ? `${progress ?? 100}%` : '0%',
                  background: segmentBackground(i),
                  backgroundImage: dashed && isCurrent
                    ? 'repeating-linear-gradient(90deg, var(--sr-text-faint-on-light) 0 5px, transparent 5px 10px)'
                    : undefined,
                  transition: 'width var(--sr-dur-slow) var(--sr-ease)',
                }}
              />
              {failed && isCurrent && breakAt != null && (
                <span
                  data-testid="spine-break"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', left: `${breakAt}%`, top: -3,
                    width: 2, height: 9, background: 'var(--sr-coral-text)',
                  }}
                />
              )}
            </div>

            <span
              data-testid="spine-node"
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                background: done ? 'var(--sr-green)' : 'transparent',
                border: `1px solid ${i <= current ? 'var(--sr-cyan)' : 'var(--sr-border-light)'}`,
              }}
            />

            <span style={{
              fontFamily: 'var(--sr-font-mono)',
              fontSize: 9.5,
              color: i <= current ? 'var(--sr-text-muted-on-light)' : 'var(--sr-text-faint-on-light)',
            }}>{node}</span>
          </div>
        );
      })}
    </div>
  );
}

import { PATH_NODES, type PathState } from '../status';

export interface PathSpineProps {
  /** How many nodes are complete, 0–4. */
  reached: 0 | 1 | 2 | 3 | 4;
  state?: PathState;
  /** 0–1, used while uploading to fill between nodes. */
  progress?: number;
}

export function PathSpine({ reached, state = 'normal', progress }: PathSpineProps) {
  const fraction = progress ?? reached / PATH_NODES.length;
  const fill =
    state === 'failed'
      ? 'var(--sr-coral-text)'
      : state === 'offline' || state === 'queued'
        ? 'var(--sr-text-faint-on-light)'
        : 'var(--sr-green)';

  return (
    <div>
      <div style={{ position: 'relative', height: 2, background: 'var(--sr-border-light-soft)' }}>
        <span
          data-testid="spine-fill"
          style={{ position: 'absolute', inset: '0 auto 0 0', width: `${fraction * 100}%`, background: fill }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PATH_NODES.length}, 1fr)`,
          marginTop: 8,
          fontFamily: 'var(--sr-font-mono)',
          fontSize: 10,
        }}
      >
        {PATH_NODES.map((node, i) => {
          const done = i < reached;
          return (
            <span
              key={node}
              style={{ color: done ? 'var(--sr-text-primary-on-light)' : 'var(--sr-text-faint-on-light)' }}
            >
              <span
                data-testid={done ? 'node-complete' : 'node-pending'}
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  marginRight: 6,
                  background: done ? fill : 'transparent',
                  border: done ? 'none' : '1px solid var(--sr-text-faint-on-light)',
                }}
              />
              {node}
              {done ? ' ✓' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

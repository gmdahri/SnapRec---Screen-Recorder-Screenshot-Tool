/** L7 — loading.
 *
 * Skeletons in the plate's geometry rather than a spinner: the page should
 * settle into its real shape, not jump into it. Announced once, politely. */
export function LoadingState({ columns }: { columns: number }) {
  return (
    <div>
      <span role="status" aria-live="polite" style={{
        position: 'absolute', width: 1, height: 1, overflow: 'hidden',
        clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
      }}>Loading your library</span>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))`,
        gap: 14,
      }} aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} data-testid="skeleton-plate" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{
              aspectRatio: '16 / 9',
              background: 'var(--sr-surface-panel-light)',
              border: '1px solid var(--sr-border-light-soft)',
            }} />
            <div style={{ height: 10, width: `${60 + (i % 4) * 10}%`, background: 'var(--sr-surface-panel-light)' }} />
            <div style={{ height: 8, width: '38%', background: 'var(--sr-surface-panel-light)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export type Selection =
  | { kind: 'redaction'; w: number; h: number }
  | { kind: 'step'; index: number }
  | { kind: 'text'; size: number; weight: number }
  | { kind: 'shape'; w: number; h: number };

export interface PropertySidebarProps {
  selection: Selection | null;
  onChange: (patch: Record<string, unknown>) => void;
  onRenumber?: () => void;
}

/** I4 — exists only when something is selected.
 *
 * Dimensions appear only while an object is active, never as persistent
 * chrome: a panel that always shows numbers trains people to stop reading it. */
export function PropertySidebar({ selection, onChange, onRenumber }: PropertySidebarProps) {
  if (!selection) return null;

  return (
    <aside style={{
      width: 240, flex: 'none', padding: 16,
      background: 'var(--sr-surface-panel-dark)',
      color: 'var(--sr-text-primary-on-dark)',
      borderLeft: '1px solid var(--sr-border-dark-soft)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {selection.kind === 'redaction' && (
        <>
          <span style={mono}>redacted · {selection.w} × {selection.h}</span>
          {/* The distinction that matters: one is reversible, the other is not. */}
          <p style={help}>
            Redact removes the pixels. Blur can sometimes be reversed, so use
            redact for anything sensitive.
          </p>
        </>
      )}

      {selection.kind === 'shape' && (
        <span style={mono}>shape · {selection.w} × {selection.h}</span>
      )}

      {selection.kind === 'step' && (
        <>
          <span style={mono}>step {selection.index}</span>
          {/* Steps are content: they get reordered, and a gap in the numbering
              reads as a mistake rather than a deletion. */}
          <p style={help}>
            Steps renumber themselves in reading order, so deleting one never
            leaves a gap.
          </p>
          <button type="button" onClick={onRenumber} style={action}>Renumber in order</button>
        </>
      )}

      {selection.kind === 'text' && (
        <>
          <label style={field}>
            <span style={labelText}>Size</span>
            <input
              type="number"
              min={8}
              max={96}
              aria-label="Text size"
              value={selection.size}
              onChange={e => onChange({ size: Number(e.target.value) })}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={labelText}>Weight</span>
            <select
              aria-label="Text weight"
              value={selection.weight}
              onChange={e => onChange({ weight: Number(e.target.value) })}
              style={input}
            >
              <option value={400}>Regular</option>
              <option value={600}>Semibold</option>
              <option value={700}>Bold</option>
            </select>
          </label>
        </>
      )}
    </aside>
  );
}

const mono = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 10.5,
  color: 'var(--sr-text-faint-on-dark)',
} as const;

const help = {
  margin: 0, fontSize: 11.5, lineHeight: 1.55,
  color: 'var(--sr-text-secondary-on-dark)',
} as const;

const field = { display: 'flex', flexDirection: 'column', gap: 5 } as const;

const labelText = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
  letterSpacing: '.1em', color: 'var(--sr-text-faint-on-dark)',
} as const;

const input = {
  height: 'var(--sr-h-xs)', padding: '0 8px',
  border: '1px solid var(--sr-border-dark)',
  background: 'var(--sr-surface-carbon)',
  color: 'var(--sr-text-primary-on-dark)',
  fontSize: 12, borderRadius: 'var(--sr-radius-control)',
} as const;

const action = {
  height: 'var(--sr-h-xs)', border: '1px solid var(--sr-border-dark)',
  background: 'transparent', color: 'var(--sr-text-primary-on-dark)',
  fontSize: 12, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
} as const;

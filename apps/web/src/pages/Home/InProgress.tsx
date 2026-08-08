import { StateRule, type CaptureStatus } from '@snaprec/design-system';

export interface InProgressItem {
  id: string;
  title: string;
  status: CaptureStatus;
  /** 0–100, determinate work only. */
  progress?: number;
  detail: string;
  action: { label: string; onSelect: () => void };
}

/** Progress rides the media, never a separate widget.
 *
 * The state rule is the single carrier, so the same 62% reads identically here,
 * on the library plate and in the extension popup. */
export function InProgress({ items }: { items: InProgressItem[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
        }}>In progress</span>
        <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
      </div>

      {items.map(item => (
        <div key={item.id} style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--sr-surface-paper)',
          border: '1px solid var(--sr-border-light-soft)',
          padding: '11px 14px',
        }}>
          <span style={{
            position: 'relative', width: 60, height: 34, flex: 'none',
            background: 'var(--sr-surface-carbon)',
          }}>
            <StateRule status={item.status} progress={item.progress} />
          </span>

          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{item.title}</span>
            <span style={{
              display: 'block', marginTop: 3, fontFamily: 'var(--sr-font-mono)',
              fontSize: 10, color: 'var(--sr-text-faint-on-light)',
            }}>{item.detail}</span>

            {/* Processing is the one in-progress state whose link already
                works — saying so stops people waiting to share. */}
            {item.status === 'processing' && (
              <span style={{
                display: 'block', marginTop: 3, fontSize: 11.5,
                color: 'var(--sr-text-muted-on-light)',
              }}>
                The link already works — viewers see a processing notice until it&apos;s ready.
              </span>
            )}
          </span>

          <button type="button" onClick={item.action.onSelect} style={{
            height: 'var(--sr-h-2xs)', padding: '0 13px', flex: 'none',
            border: '1px solid var(--sr-border-light)', background: 'transparent',
            fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
          }}>{item.action.label}</button>
        </div>
      ))}
    </section>
  );
}

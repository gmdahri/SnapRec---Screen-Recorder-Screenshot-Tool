export type AttentionKind = 'uploadFailed' | 'exportFailed' | 'needsReply' | 'micBlocked';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  action: { label: string; onSelect: () => void };
}

/** Prefixes that name what happened before naming the capture. */
const PREFIX: Record<AttentionKind, string> = {
  uploadFailed: 'Upload failed — ',
  exportFailed: 'Export failed — ',
  needsReply: '',
  micBlocked: '',
};

/** The band that leads Home when something is wrong.
 *
 * Every item carries its action inline. Nothing here goes behind a menu:
 * an attention item you have to go looking for is not an attention item. */
export function AttentionBand({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          letterSpacing: '.12em', color: 'var(--sr-coral-hover)',
        }}>Needs your attention</span>
        <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
      </div>

      {items.map(item => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          borderLeft: '2px solid var(--sr-coral-text)',
          background: 'var(--sr-surface-paper)',
          padding: '11px 14px',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>
              {PREFIX[item.kind]}{item.title}
            </span>
            {/* Cause, then reassurance — and the reassurance comes first in the
                sentence, because "is my work gone" is the only question that
                matters at this moment. */}
            <span style={{
              display: 'block', marginTop: 3, fontSize: 12,
              color: 'var(--sr-text-muted-on-light)', lineHeight: 1.5,
            }}>{item.detail}</span>
          </span>

          <button type="button" onClick={item.action.onSelect} style={{
            height: 'var(--sr-h-2xs)', padding: '0 13px', flex: 'none',
            border: '1px solid var(--sr-text-primary-on-light)', background: 'transparent',
            color: 'var(--sr-text-primary-on-light)', fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
          }}>{item.action.label}</button>
        </div>
      ))}
    </section>
  );
}

import { CAPTURE_STATES } from '@snaprec/design-system';
import { BottomSheet } from '../../components/BottomSheet';
import type { MobileItem } from './MobileList';

/** Actions that genuinely need a pointer and a large canvas. They are listed
 * and marked, never hidden — a menu that silently drops entries teaches the
 * user the app is inconsistent. */
const DESKTOP_ONLY = new Set(['edit', 'annotate']);

export interface ActionsSheetProps {
  item: MobileItem;
  onClose: () => void;
  onSelect: (action: string) => void;
}

export function ActionsSheet({ item, onClose, onSelect }: ActionsSheetProps) {
  const def = CAPTURE_STATES[item.status];
  const actions = [def.primary, ...def.secondary];
  const destructive = actions.filter(a => /delete|remove|discard/i.test(a));
  const ordinary = actions.filter(a => !destructive.includes(a));

  const row = (action: string) => {
    const disabled = DESKTOP_ONLY.has(action.toLowerCase());
    return (
      <button
        key={action}
        type="button"
        data-min-target="44"
        aria-disabled={disabled || undefined}
        title={disabled ? 'Available on desktop' : undefined}
        onClick={disabled ? undefined : () => { onSelect(action); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', minHeight: 44, padding: '0 18px',
          border: 'none', background: 'transparent', textAlign: 'left',
          fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled
            ? 'var(--sr-text-faint-on-light)'
            : /delete|remove|discard/i.test(action)
              ? 'var(--sr-coral-hover)'
              : 'var(--sr-text-primary-on-light)',
          textTransform: 'capitalize',
        }}
      >
        {action}
        {disabled && (
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)', textTransform: 'none',
          }}>desktop only</span>
        )}
      </button>
    );
  };

  return (
    <BottomSheet label={`Actions for ${item.title}`} onClose={onClose}>
      {/* Headed by the capture's own thumbnail, so it is unambiguous which
          item is being acted on. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 18px 12px',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span data-testid="sheet-thumbnail" style={{
          width: 64, height: 38, flex: 'none', overflow: 'hidden',
          background: 'var(--sr-surface-carbon)',
        }}>
          {item.thumbnailUrl && (
            <img src={item.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13.5, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.title}</span>
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{item.kind} · {item.created}</span>
        </span>
      </div>

      <div style={{ paddingTop: 6 }}>{ordinary.map(row)}</div>

      {destructive.length > 0 && (
        <div data-separated style={{
          marginTop: 8, paddingTop: 6,
          borderTop: '8px solid var(--sr-surface-panel-light)',
        }}>{destructive.map(row)}</div>
      )}
    </BottomSheet>
  );
}

import { Icon } from '@iconify/react';
import type { CaptureAction } from './CapturePlate';

export interface SelectionBarProps {
  count: number;
  total: number;
  onClear: () => void;
  actions: CaptureAction[];
  /** Rendered in a separated slot at the right. Never coral-filled. */
  destructive?: CaptureAction;
}

const btn = {
  height: 'var(--sr-h-2xs)',
  padding: '0 12px',
  background: 'transparent',
  borderRadius: 'var(--sr-radius-control)',
  fontSize: 12.5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
} as const;

/** Carbon bulk toolbar.
 *
 * Two rules it exists to enforce: every disabled action says why, and the
 * destructive action is separated by a rule rather than merely coloured
 * differently — colour alone is not enough distance from Download. */
export function SelectionBar({ count, total, onClear, actions, destructive }: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} of ${total} selected`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 46, padding: '0 14px',
        background: 'var(--sr-surface-carbon)',
        color: 'var(--sr-text-primary-on-dark)',
      }}
    >
      <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 11.5 }}>{count} selected</span>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        style={{
          ...btn,
          border: '1px solid var(--sr-border-dark)',
          color: 'var(--sr-text-secondary-on-dark)',
          cursor: 'pointer',
        }}
      >
        <Icon icon="ant-design:close-outlined" width={11} aria-hidden="true" />
      </button>

      <span style={{ flex: 1 }} />

      {actions.map(a => (
        <button
          key={a.key}
          type="button"
          onClick={a.disabledReason ? undefined : a.onSelect}
          aria-disabled={a.disabledReason ? 'true' : undefined}
          title={a.disabledReason ?? a.label}
          style={{
            ...btn,
            border: '1px solid var(--sr-border-dark)',
            color: a.disabledReason
              ? 'var(--sr-text-faint-on-dark)'
              : 'var(--sr-text-primary-on-dark)',
            cursor: a.disabledReason ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon icon={a.icon} width={13} aria-hidden="true" />{a.label}
        </button>
      ))}

      {destructive && (
        <span
          data-testid="destructive-slot"
          style={{
            marginLeft: 18, paddingLeft: 18,
            borderLeft: '1px solid var(--sr-border-dark)',
          }}
        >
          <button
            type="button"
            onClick={destructive.onSelect}
            style={{
              ...btn,
              border: '1px solid var(--sr-coral-text)',
              color: 'var(--sr-coral-on-dark)',
              cursor: 'pointer',
            }}
          >
            <Icon icon={destructive.icon} width={13} aria-hidden="true" />{destructive.label}
          </button>
        </span>
      )}
    </div>
  );
}

import type { Surface } from './Button';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  surface?: Surface;
}

export function Switch({ label, checked, onChange, surface = 'light' }: SwitchProps) {
  const off = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 26,
        height: 15,
        flex: 'none',
        position: 'relative',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: checked ? 'var(--sr-cyan)' : off,
        transition: 'background var(--sr-dur-fast) var(--sr-ease)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 13 : 2,
          width: 11,
          height: 11,
          background: checked ? 'var(--sr-cyan-fg)' : 'var(--sr-text-faint-on-dark)',
          transition: 'left var(--sr-dur-fast) var(--sr-ease)',
        }}
      />
    </button>
  );
}

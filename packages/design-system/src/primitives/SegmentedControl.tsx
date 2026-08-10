import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/types';
import type { ControlHeight, Surface } from './Button';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: IconifyIcon;
}

export interface SegmentedControlProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  surface?: Surface;
  size?: ControlHeight;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  surface = 'light',
  size = 34,
}: SegmentedControlProps) {
  const border = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';
  const idle = surface === 'dark' ? 'var(--sr-text-secondary-on-dark)' : 'var(--sr-text-muted-on-light)';

  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', border: `1px solid ${border}` }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              height: size,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${border}`,
              background: on ? 'var(--sr-cyan)' : 'transparent',
              color: on ? 'var(--sr-cyan-fg)' : idle,
              fontFamily: 'var(--sr-font-ui)',
              fontSize: 11.5,
              fontWeight: on ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {o.icon && <Icon icon={o.icon} width={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

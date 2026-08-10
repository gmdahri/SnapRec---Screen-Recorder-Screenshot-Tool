import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/types';
import type { ButtonHTMLAttributes } from 'react';
import type { Surface } from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconifyIcon;
  /** Required. Becomes both the accessible name and the tooltip. */
  label: string;
  size?: number;
  surface?: Surface;
}

export function IconButton({ icon, label, size = 15, surface = 'light', style, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      style={{
        width: 'var(--sr-h-xs)',
        height: 'var(--sr-h-xs)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--sr-radius-control)',
        cursor: 'pointer',
        color: surface === 'dark' ? 'var(--sr-text-secondary-on-dark)' : 'var(--sr-text-muted-on-light)',
        ...style,
      }}
    >
      <Icon icon={icon} width={size} />
    </button>
  );
}

import { useState, type InputHTMLAttributes } from 'react';
import type { Surface } from './Button';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  surface?: Surface;
}

export function Field({ surface = 'light', style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const border = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';

  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={{
        height: 'var(--sr-h-sm)',
        padding: '0 12px',
        fontFamily: 'var(--sr-font-ui)',
        fontSize: 13,
        borderRadius: 'var(--sr-radius-control)',
        background: surface === 'dark' ? 'var(--sr-surface-panel-dark)' : 'var(--sr-surface-paper)',
        color: surface === 'dark' ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-primary-on-light)',
        border: `1px solid ${focused ? 'var(--sr-cyan)' : border}`,
        boxShadow: focused ? 'var(--sr-focus-ring)' : 'none',
        outline: 'none',
        ...style,
      }}
    />
  );
}

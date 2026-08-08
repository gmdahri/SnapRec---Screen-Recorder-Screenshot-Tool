import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'capture' | 'carbon';
export type ControlHeight = 30 | 34 | 40 | 46;
export type Surface = 'light' | 'dark';

const HEIGHT: Record<ControlHeight, string> = {
  30: 'var(--sr-h-xs)',
  34: 'var(--sr-h-sm)',
  40: 'var(--sr-h-md)',
  46: 'var(--sr-h-lg)',
};

function paint(variant: ButtonVariant, surface: Surface): CSSProperties {
  const border = surface === 'dark' ? 'var(--sr-border-dark-strong)' : 'var(--sr-border-light)';
  const ink = surface === 'dark' ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-primary-on-light)';
  const quiet = surface === 'dark' ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-muted-on-light)';

  switch (variant) {
    case 'primary':
      return { background: 'var(--sr-cyan)', color: 'var(--sr-cyan-fg)', border: '1px solid var(--sr-cyan)' };
    case 'capture':
      return { background: 'var(--sr-coral-text)', color: 'var(--sr-coral-text-fg)', border: '1px solid var(--sr-coral-text)' };
    case 'carbon':
      return { background: 'var(--sr-surface-carbon)', color: 'var(--sr-text-primary-on-dark)', border: '1px solid var(--sr-border-dark-strong)' };
    case 'ghost':
      return { background: 'transparent', color: quiet, border: '1px solid transparent' };
    case 'secondary':
    default:
      return { background: 'transparent', color: ink, border: `1px solid ${border}` };
  }
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlHeight;
  surface?: Surface;
}

export function Button({
  variant = 'secondary',
  size = 34,
  surface = 'light',
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        height: HEIGHT[size],
        padding: '0 14px',
        borderRadius: 'var(--sr-radius-control)',
        fontFamily: 'var(--sr-font-ui)',
        fontSize: 13,
        fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'background var(--sr-dur-fast) var(--sr-ease), border-color var(--sr-dur-fast) var(--sr-ease)',
        ...paint(variant, surface),
        ...style,
      }}
    />
  );
}

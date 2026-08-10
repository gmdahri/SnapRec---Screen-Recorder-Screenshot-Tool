import type { CSSProperties, ReactNode } from 'react';

export interface MonoProps {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}

export function Mono({ children, size = 10.5, style }: MonoProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--sr-font-mono)',
        fontSize: size,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

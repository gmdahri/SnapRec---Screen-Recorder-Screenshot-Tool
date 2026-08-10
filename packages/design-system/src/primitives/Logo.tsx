export interface LogoProps {
  /** Height of the mark in px. Default 14, matching the popup header. */
  size?: number;
  withWordmark?: boolean;
  title?: string;
  className?: string;
}

export function Logo({ size = 14, withWordmark = false, title = 'SnapRec', className }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      role="img"
      aria-label={withWordmark ? undefined : title}
      aria-hidden={withWordmark || undefined}
      focusable="false"
    >
      {!withWordmark && <title>{title}</title>}
      {/* top-left bracket */}
      <path d="M0 6V0h6" fill="none" stroke="var(--sr-cyan)" strokeWidth="2" />
      {/* bottom-right bracket */}
      <path d="M14 8v6H8" fill="none" stroke="var(--sr-cyan)" strokeWidth="2" />
      {/* capture dot */}
      <rect data-part="dot" x="5" y="5" width="4" height="4" fill="var(--sr-coral-mark)" />
    </svg>
  );

  if (!withWordmark) return <span className={className}>{mark}</span>;

  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, letterSpacing: '-.01em' }}
    >
      {mark}
      <span data-part="wordmark">{title}</span>
    </span>
  );
}

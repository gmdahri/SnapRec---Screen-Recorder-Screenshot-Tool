import type { CSSProperties } from 'react';
import { Icon } from '@iconify/react';
import { PATREON_URL } from '../lib/patreon';

export interface SupportButtonProps {
  /** Stated rather than inferred: the viewers and editors do not share a theme,
   * and there is no theme context to read. Per CLAUDE.md the editors and the
   * video viewer are dark "Technical" workspaces; the image viewer is light. */
  surface: 'dark' | 'light';
  /** Icon only, for bars that are already full — the mobile viewers. */
  compact?: boolean;
}

/** The support ask, everywhere except the dashboard top bar (which animates its
 * own label).
 *
 * Deliberately quiet: outlined, never filled, never coral. On a share page it
 * sits on someone else's content beside Copy link and Download, and on an editor
 * beside Export and Publish — in both cases it must read as an aside, not as the
 * action the surface is for. */
export function SupportButton({ surface, compact = false }: SupportButtonProps) {
  const dark = surface === 'dark';

  const style: CSSProperties = {
    height: dark ? 30 : 'var(--sr-h-2xs)',
    padding: compact ? 0 : '0 12px',
    width: compact ? 30 : 'auto',
    flex: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    border: `1px solid ${dark ? 'var(--sr-border-dark-strong)' : 'var(--sr-border-light)'}`,
    background: 'transparent',
    color: dark ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-muted-on-light)',
    fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
    borderRadius: dark ? 0 : 'var(--sr-radius-control)',
  };

  return (
    <a
      href={PATREON_URL}
      target="_blank"
      rel="noopener"
      aria-label="Support us on Patreon"
      title="Support us on Patreon"
      style={style}
    >
      <Icon icon="simple-icons:patreon" width={13} aria-hidden="true" />
      {!compact && 'Support us'}
    </a>
  );
}

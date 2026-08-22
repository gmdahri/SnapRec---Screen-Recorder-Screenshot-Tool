import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTypewriterCycle } from '../hooks/useTypewriterCycle';
import { PATREON_URL } from '../lib/patreon';
// Analytics: the app's only Patreon link. `tier` is intentionally not sent —
// there is no tier concept in the product (lib/patreon.ts is one static URL),
// so the property stays optional in lib/analytics.ts until tiers exist.
import { capture } from '../lib/analytics';

export interface TopBarProps {
  title: string;
  meta?: string;
  unreadActivity?: number;
  user: { initials: string; name: string };
  onNewCapture: () => void;
  onActivity?: () => void;
  onUserMenu?: () => void;
  onSearch?: (query: string) => void;
  searchDefault?: string;
  /** Drives `aria-expanded` on the avatar. The menu itself lives in AppShell,
   * which owns the open state. */
  userMenuOpen?: boolean;
}

const control = {
  height: 'var(--sr-h-sm)',
  border: '1px solid var(--sr-border-light)',
  background: 'var(--sr-surface-paper)',
  borderRadius: 'var(--sr-radius-control)',
  cursor: 'pointer',
} as const;

const PATREON_PHRASES = ['Keep SnapRec free', 'Support us'];

/** Sized for "Keep SnapRec free" at 13px/600 plus the cursor, so the label's
 * box never changes as characters come and go. Without this the search box and
 * every control between it and the link twitch on every keystroke of the
 * animation. */
const PATREON_LABEL_WIDTH = 124;

function PatreonLabel() {
  const text = useTypewriterCycle(PATREON_PHRASES);
  return (
    <span
      data-testid="patreon-label"
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center',
        width: PATREON_LABEL_WIDTH, flex: 'none',
      }}
    >
      {text}
      <span className="sr-caret" aria-hidden="true" style={{ marginLeft: 1 }}>|</span>
    </span>
  );
}

export function TopBar({
  title, meta, unreadActivity = 0, user,
  onNewCapture, onActivity, onUserMenu, onSearch, searchDefault = '',
  userMenuOpen = false,
}: TopBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';

  /** `/` focuses search — but never while the user is already typing, or the
   * shortcut eats a character out of whatever field they are in. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{
      height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 22px', background: 'var(--sr-surface-paper)',
      borderBottom: '1px solid var(--sr-border-light-soft)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</span>
        {meta && (
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10.5,
            color: 'var(--sr-text-faint-on-light)',
          }}>{meta}</span>
        )}
      </span>

      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
        width: 300, height: 'var(--sr-h-2xs)', padding: '0 10px',
        border: '1px solid var(--sr-border-light)', background: '#fff',
        borderRadius: 'var(--sr-radius-control)',
      }}>
        <Icon icon="ant-design:search-outlined" width={14}
          style={{ color: 'var(--sr-text-faint-on-light)' }} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          defaultValue={searchDefault}
          placeholder="Search captures"
          aria-label="Search captures"
          onChange={e => onSearch?.(e.target.value)}
          style={{
            flex: 1, minWidth: 0, border: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--sr-text-primary-on-light)', outline: 'none',
          }}
        />
        <span aria-hidden="true" style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
          color: 'var(--sr-text-faint-on-light)',
        }}>/</span>
      </label>

      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onNewCapture} style={{
          height: 'var(--sr-h-sm)', padding: '0 14px', border: 'none', cursor: 'pointer',
          background: 'var(--sr-text-primary-on-light)', color: '#fff',
          fontSize: 13, fontWeight: 600, borderRadius: 'var(--sr-radius-control)',
          display: 'inline-flex', alignItems: 'center', gap: 9,
        }}>
          <span aria-hidden="true" style={{
            width: 9, height: 9, borderRadius: '50%', background: 'var(--sr-coral-mark)',
          }} />
          New capture
        </button>

        <button
          type="button"
          onClick={onActivity}
          aria-label={`Activity, ${unreadActivity} new`}
          title="Activity"
          style={{ ...control, position: 'relative', width: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon icon="ant-design:bell-outlined" width={15}
            style={{ color: 'var(--sr-text-muted-on-light)' }} aria-hidden="true" />
          {unreadActivity > 0 && (
            <span aria-hidden="true" style={{
              position: 'absolute', top: -1, right: -1, width: 7, height: 7,
              background: 'var(--sr-coral-mark)',
            }} />
          )}
        </button>

        <button
          type="button"
          onClick={onUserMenu}
          aria-label={user.name}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          style={{ ...control, padding: '0 8px 0 6px', display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <span style={{
            width: 22, height: 22, background: 'var(--sr-text-primary-on-light)',
            color: '#fff', fontSize: 9.5, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{user.initials}</span>
          <Icon icon="ant-design:down-outlined" width={9}
            style={{ color: 'var(--sr-text-faint-on-light)' }} aria-hidden="true" />
        </button>

        <a
          href={PATREON_URL}
          target="_blank"
          rel="noopener"
          onClick={() => capture('patreon_link_clicked', { location: 'top_bar' })}
          aria-label="Support us on Patreon"
          title="Support us on Patreon"
          style={{
            ...control,
            padding: mobile ? '0 8px' : '0 12px',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            color: 'var(--sr-text-muted-on-light)', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          <Icon icon="simple-icons:patreon" width={14} aria-hidden="true" />
          {!mobile && <PatreonLabel />}
        </a>
      </span>
    </div>
  );
}

import { type ReactNode, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { BottomSheet } from './BottomSheet';

export interface AccountMenuProps {
  user: { initials: string; name: string };
  onClose: () => void;
  onNavigate: (to: string) => void;
}

interface Item {
  key: string;
  label: string;
  icon: string;
  to: string;
}

/** Projects and Settings appear here on mobile because `MOBILE_NAV` drops both
 * from the bottom bar and nothing else offers them — the sheet is the only route
 * to either. On desktop the rail already carries both, so the menu keeps only
 * Settings, as the conventional place to look for it. */
const DESKTOP_ITEMS: Item[] = [
  { key: 'settings', label: 'Settings', icon: 'ant-design:setting-outlined', to: '/settings' },
];

const MOBILE_ITEMS: Item[] = [
  { key: 'projects', label: 'Projects', icon: 'ant-design:folder-outlined', to: '/projects' },
  ...DESKTOP_ITEMS,
];

export function AccountMenu({ user, onClose, onNavigate }: AccountMenuProps) {
  const { user: account, signOut } = useAuth();
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';

  const items = mobile ? MOBILE_ITEMS : DESKTOP_ITEMS;

  const go = (to: string) => { onNavigate(to); onClose(); };

  const leave = async () => {
    // No navigation here: onAuthStateChange clears the session and
    // ProtectedRoute bounces. Pushing a route would race that.
    await signOut();
    onClose();
  };

  const body = (
    <div role="menu" aria-label="Account" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: mobile ? '4px 18px 12px' : '11px 13px',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
        {account?.email && (
          <span style={{ fontSize: 11.5, color: 'var(--sr-text-muted-on-light)' }}>
            {account.email}
          </span>
        )}
      </span>

      {items.map(item => (
        <MenuRow
          key={item.key}
          mobile={mobile}
          icon={item.icon}
          label={item.label}
          onSelect={() => go(item.to)}
        />
      ))}

      <span aria-hidden="true" style={{
        height: 1, background: 'var(--sr-border-light-soft)', margin: '4px 0',
      }} />

      <MenuRow
        mobile={mobile}
        icon="ant-design:logout-outlined"
        label="Sign out"
        onSelect={leave}
      />
    </div>
  );

  if (mobile) return <BottomSheet label="Account" onClose={onClose}>{body}</BottomSheet>;
  return <Anchored onClose={onClose}>{body}</Anchored>;
}

/** The dismiss contract shared by every popover in the app: Escape, plus a
 * mousedown outside the container. Taken from FilterPopover rather than from
 * UserMenu, whose listener has no containment check and so closes on clicks
 * inside its own body. */
function Anchored({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    ref.current?.querySelector<HTMLElement>('button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 22, top: 8, width: 232, zIndex: 40,
        background: 'var(--sr-surface-paper)',
        border: '1px solid var(--sr-border-light)',
        borderRadius: 'var(--sr-radius-control)',
        boxShadow: '0 8px 24px rgba(4,7,8,.13)',
        padding: '4px 0',
      }}
    >
      {children}
    </div>
  );
}

function MenuRow({ mobile, icon, label, onSelect }: {
  mobile: boolean;
  icon: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      data-min-target={mobile ? '44' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: mobile ? 44 : 32,
        padding: mobile ? '0 18px' : '0 13px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        font: 'inherit', fontSize: 13, textAlign: 'left',
        color: 'var(--sr-text-primary-on-light)',
      }}
    >
      <Icon icon={icon} width={14} style={{ color: 'var(--sr-text-muted-on-light)' }} aria-hidden="true" />
      {label}
    </button>
  );
}

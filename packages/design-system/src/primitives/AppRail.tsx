import { Icon } from '@iconify/react';
import { Logo } from './Logo';

export interface RailItem {
  key: string;
  label: string;
  icon: string;
  onSelect: () => void;
}

export interface AppRailProps {
  items: RailItem[];
  current: string;
  extension: 'on' | 'off' | 'unknown';
  onExtensionClick?: () => void;
  user: { initials: string; name: string };
  onUserClick?: () => void;
  /** 56px with labels dropped to tooltips — 1024–1279 only. */
  collapsed?: boolean;
}

const EXT_TONE = {
  on: 'var(--sr-cyan)',
  off: 'var(--sr-coral-on-dark)',
  unknown: 'var(--sr-text-faint-on-dark)',
} as const;

/** 68px carbon navigation — the only carbon element on a management page.
 *
 * The cyan mark sits on the leading edge of the active item; the mobile bottom
 * bar puts the same mark on top, so the two read as one system. */
export function AppRail({
  items, current, extension, onExtensionClick, user, onUserClick, collapsed = false,
}: AppRailProps) {
  return (
    <nav
      aria-label="Main"
      style={{
        width: collapsed ? 56 : 68,
        flex: 'none',
        background: 'var(--sr-surface-carbon)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0 14px',
      }}
    >
      <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
        <Logo size={18} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {items.map(item => {
          const active = item.key === current;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              style={{
                position: 'relative',
                border: 'none',
                background: active ? 'var(--sr-surface-panel-dark)' : 'transparent',
                color: active ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
                height: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                transition: 'color var(--sr-dur-fast) var(--sr-ease)',
              }}
            >
              <span aria-hidden="true" style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                background: active ? 'var(--sr-cyan)' : 'transparent',
              }} />
              <Icon icon={item.icon} width={18} aria-hidden="true" />
              {!collapsed && <span style={{ fontSize: 9.5, letterSpacing: '.01em' }}>{item.label}</span>}
            </button>
          );
        })}
      </div>

      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={onExtensionClick}
          title={`Extension ${extension}`}
          aria-label={`Extension ${extension}`}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontFamily: 'var(--sr-font-mono)', fontSize: 8.5, color: EXT_TONE[extension],
          }}
        >
          <Icon icon="ant-design:api-outlined" width={16} aria-hidden="true" />
          {extension}
        </button>

        <button
          type="button"
          onClick={onUserClick}
          title={user.name}
          aria-label={user.name}
          style={{
            width: 28, height: 28, border: 'none',
            background: 'var(--sr-text-primary-on-dark)', color: 'var(--sr-surface-carbon)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{user.initials}</button>
      </div>
    </nav>
  );
}

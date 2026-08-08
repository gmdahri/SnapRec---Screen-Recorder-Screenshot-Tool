import { Icon } from '@iconify/react';
import type { NavDestination } from './AppShell';

export interface MobileBottomBarProps {
  items: NavDestination[];
  current: string;
  onSelect: (to: string) => void;
}

/** The 68px rail becomes a four-item bottom bar below 768.
 *
 * The cyan mark moves to the top of the active item, mirroring the rail's
 * leading mark — same signal, rotated to suit the edge it sits on. */
export function MobileBottomBar({ items, current, onSelect }: MobileBottomBarProps) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
        display: 'flex',
        background: 'var(--sr-surface-carbon)',
        borderTop: '1px solid var(--sr-border-dark)',
      }}
    >
      {items.map(item => {
        const active = item.key === current;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.to)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            style={{
              position: 'relative',
              flex: 1,
              // 44px is the floor; 56 gives the label room without crowding.
              minHeight: 56,
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: 2,
              background: active ? 'var(--sr-cyan)' : 'transparent',
            }} />
            <Icon icon={item.icon} width={18} aria-hidden="true" />
            <span style={{ fontSize: 9.5 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

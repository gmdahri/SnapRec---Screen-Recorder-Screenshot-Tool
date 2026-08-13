import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppRail, type RailItem } from '@snaprec/design-system';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useExtensionStatus } from '../hooks/useExtensionStatus';
import { TopBar } from './TopBar';
import { CapturePopover } from './CapturePopover';
import { MobileBottomBar } from './MobileBottomBar';

export interface NavDestination {
  key: string;
  label: string;
  icon: string;
  to: string;
}

/** Order is the contract — it is muscle memory, not a list. */
export const NAV: NavDestination[] = [
  { key: 'home', label: 'Home', icon: 'ant-design:home-outlined', to: '/home' },
  { key: 'library', label: 'Library', icon: 'ant-design:appstore-outlined', to: '/library' },
  { key: 'projects', label: 'Projects', icon: 'ant-design:folder-outlined', to: '/projects' },
  { key: 'shared', label: 'Shared', icon: 'ant-design:link-outlined', to: '/shared' },
  { key: 'analytics', label: 'Analytics', icon: 'ant-design:line-chart-outlined', to: '/analytics' },
  { key: 'settings', label: 'Settings', icon: 'ant-design:setting-outlined', to: '/settings' },
];

/** Below 768 the bar holds four; Projects and Settings move into the account
 * sheet, because a six-item bar gives 65px targets on a 390px screen. */
export const MOBILE_NAV = NAV.filter(n => !['projects', 'settings'].includes(n.key));

export interface AppShellProps {
  title: string;
  meta?: string;
  user: { initials: string; name: string };
  unreadActivity?: number;
  onSearch?: (query: string) => void;
  searchDefault?: string;
  children: ReactNode;
}

const EXTENSION_TONE = {
  checking: 'unknown',
  connected: 'on',
  notInstalled: 'off',
  notResponding: 'off',
  unsupported: 'unknown',
} as const;

export function AppShell({
  title, meta, user, unreadActivity = 0, onSearch, searchDefault, children,
}: AppShellProps) {
  const [capturePopover, setCapturePopover] = useState(false);
  const breakpoint = useBreakpoint();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { status } = useExtensionStatus();

  const mobile = breakpoint === 'mobile';
  const collapsed = breakpoint === 'tabletLandscape';
  const current = NAV.find(n => pathname.startsWith(n.to))?.key ?? 'home';

  const toRailItem = (n: NavDestination): RailItem => ({
    key: n.key,
    label: n.label,
    icon: n.icon,
    onSelect: () => navigate(n.to),
  });

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--sr-surface-panel-light)',
      color: 'var(--sr-text-primary-on-light)',
      fontFamily: 'var(--sr-font-ui)',
    }}>
      {!mobile && (
        <AppRail
          items={NAV.map(toRailItem)}
          current={current}
          collapsed={collapsed}
          extension={EXTENSION_TONE[status]}
          user={user}
          onExtensionClick={() => navigate('/home')}
          onUserClick={() => navigate('/settings')}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title={title}
          meta={meta}
          unreadActivity={unreadActivity}
          user={user}
          onSearch={onSearch}
          searchDefault={searchDefault}
          onNewCapture={() => setCapturePopover(open => !open)}
          onActivity={() => navigate('/home')}
          onUserMenu={() => navigate('/settings')}
        />

        {capturePopover && (
          <div style={{ position: 'relative', height: 0 }}>
            <CapturePopover
              onClose={() => setCapturePopover(false)}
              onTroubleshoot={() => { setCapturePopover(false); navigate('/home'); }}
            />
          </div>
        )}

        <main style={{
          flex: 1,
          padding: mobile ? '16px 16px 76px' : '22px 22px 34px',
          minWidth: 0,
        }}>
          {children}
        </main>
      </div>

      {mobile && (
        <MobileBottomBar
          items={MOBILE_NAV}
          current={current}
          onSelect={to => navigate(to)}
        />
      )}
    </div>
  );
}

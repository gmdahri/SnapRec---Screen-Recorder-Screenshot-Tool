import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

export interface FreshCaptureChromeProps {
  actions: ReactNode;
  children: ReactNode;
}

/** The frame around a just-finished capture.
 *
 * A management surface, so it is light — the editors are the dark ones. This
 * replaces MainLayout, whose header belonged to the pre-plate app: rounded
 * pill buttons and a coloured avatar that competed with the capture itself,
 * which is the only thing on this page anyone came to look at. */
export function FreshCaptureChrome({ actions, children }: FreshCaptureChromeProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sr-surface-panel-light)] font-[family-name:var(--sr-font-ui)]">
      <header className="h-12 shrink-0 flex items-center gap-3 px-5 bg-[var(--sr-surface-paper)] border-b border-[var(--sr-border-light-soft)]">
        <Link
          to="/dashboard"
          aria-label="Back to your library"
          title="Back to your library"
          className="w-7 h-7 inline-flex items-center justify-center text-[var(--sr-text-muted-on-light)] hover:text-[var(--sr-text-primary-on-light)]"
        >
          <Icon icon="ant-design:arrow-left-outlined" width={15} aria-hidden="true" />
        </Link>

        <span className="font-[family-name:var(--sr-font-mono)] text-[10px] tracking-[.12em] text-[var(--sr-text-faint-on-light)]">
          NEW CAPTURE
        </span>

        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

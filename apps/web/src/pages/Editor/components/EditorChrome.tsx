import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

export interface EditorChromeProps {
  title: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}

/** The image editor's frame — a Technical workspace, not a management page.
 *
 * 48px carbon header matching the video editor's, so the two editors read as
 * one place. MainLayout is a light management shell and was never right here:
 * a light chrome around a dark canvas makes the canvas look like a modal. */
export function EditorChrome({ title, actions, children }: EditorChromeProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--sr-surface-carbon)] text-[var(--sr-text-primary-on-dark)] font-[family-name:var(--sr-font-ui)]">
      <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-[var(--sr-border-dark-soft)]">
        <Link
          to="/library"
          aria-label="Back to library"
          title="Back to library"
          className="w-7 h-7 inline-flex items-center justify-center text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)]"
        >
          <Icon icon="ant-design:arrow-left-outlined" width={15} aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1">{title}</div>

        {actions}
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

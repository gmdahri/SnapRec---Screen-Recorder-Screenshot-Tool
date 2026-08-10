import type { ReactNode } from 'react';
import { LandingFooter, LandingNavbar } from '..';

export interface ContentPageProps {
  /** Mono eyebrow above the title. Names the kind of document, not the topic. */
  kind?: string;
  title: string;
  /** One sentence. Absent is better than filler. */
  standfirst?: string;
  /** Mono metadata rail under the title — dates, versions, reading time. */
  meta?: string;
  /** Wider for pages that carry tables or media. */
  measure?: 'prose' | 'wide';
  children: ReactNode;
}

/** The shell every content page shares.
 *
 * A measured column on panel-light, with the marketing nav and footer. The
 * plate has no card: content sits directly on the page and is separated by
 * rules and space, so a long document reads as one thing rather than a stack
 * of boxes. */
export function ContentPage({
  kind, title, standfirst, meta, measure = 'prose', children,
}: ContentPageProps) {
  return (
    <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
      <LandingNavbar />

      <main
        className="mx-auto px-6 lg:px-10 py-16"
        style={{ maxWidth: measure === 'wide' ? 1080 : 760 }}
      >
        <header className="flex flex-col gap-4 mb-12">
          {kind && (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-cyan-on-light)]">
              {kind}
            </span>
          )}

          <h1 className="text-[clamp(1.875rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.035em] m-0">
            {title}
          </h1>

          {standfirst && (
            <p className="text-[16px] leading-[1.65] text-[var(--sr-text-muted-on-light)] max-w-[54ch] m-0">
              {standfirst}
            </p>
          )}

          {meta && (
            <span className="font-mono text-[10.5px] text-[var(--sr-text-faint-on-light)]">
              {meta}
            </span>
          )}
        </header>

        {children}
      </main>

      <LandingFooter />
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { LandingFooter, LandingNavbar } from '..';

export interface LegalSection {
  /** Cited by number, so the number is content — not decoration. */
  n: number;
  title: string;
  body: ReactNode;
}

export interface LegalDocumentProps {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

/** Privacy and Terms.
 *
 * A legal document is referenced by clause — "under section 7" — so the
 * numbering is load-bearing and the margin index is a way to navigate rather
 * than an ornament. That is the one place these pages spend any complexity;
 * everything else is a plain measured column. */
export function LegalDocument({ title, updated, intro, sections }: LegalDocumentProps) {
  const [current, setCurrent] = useState(sections[0]?.n ?? 1);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(Number(visible.target.id.replace('s', '')));
      },
      // Only the band near the top counts as "where you are", or every section
      // on a tall screen claims to be current at once.
      { rootMargin: '-72px 0px -70% 0px' },
    );

    sections.forEach(s => {
      const el = document.getElementById(`s${s.n}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
      <LandingNavbar />

      <main className="max-w-[1080px] mx-auto px-6 lg:px-10 py-16">
        <header className="flex flex-col gap-4 mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-cyan-on-light)]">
            legal
          </span>
          <h1 className="text-[clamp(1.875rem,4vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.035em] m-0">
            {title}
          </h1>
          {intro && (
            <p className="text-[15.5px] leading-[1.65] text-[var(--sr-text-muted-on-light)] max-w-[58ch] m-0">
              {intro}
            </p>
          )}
          <span className="font-mono text-[10.5px] text-[var(--sr-text-faint-on-light)]">
            last updated {updated}
          </span>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_200px] gap-12 items-start">
          <div>
            {sections.map(section => (
              <section key={section.n} id={`s${section.n}`} className="mb-12 scroll-mt-20">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] m-0 mb-3 flex items-baseline gap-3">
                  <span className="font-mono text-[11px] font-normal text-[var(--sr-cyan-on-light)] shrink-0">
                    {String(section.n).padStart(2, '0')}
                  </span>
                  {section.title}
                </h2>
                <div className="flex flex-col gap-3.5 text-[14.5px] leading-[1.7] text-[var(--sr-text-muted-on-light)] [&_a]:text-[var(--sr-cyan-on-light)] [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:list-disc">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <nav
            aria-label="Sections"
            className="hidden lg:flex flex-col gap-1 sticky top-20"
          >
            {sections.map(section => {
              const active = section.n === current;
              return (
                <a
                  key={section.n}
                  href={`#s${section.n}`}
                  aria-current={active ? 'true' : undefined}
                  className="flex gap-2.5 py-1.5 text-[12px] leading-snug no-underline"
                  style={{
                    borderLeft: `2px solid ${active ? 'var(--sr-cyan)' : 'var(--sr-border-light-soft)'}`,
                    paddingLeft: 10,
                    color: active
                      ? 'var(--sr-text-primary-on-light)'
                      : 'var(--sr-text-faint-on-light)',
                  }}
                >
                  <span className="font-mono text-[10px] shrink-0">
                    {String(section.n).padStart(2, '0')}
                  </span>
                  {section.title}
                </a>
              );
            })}
          </nav>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

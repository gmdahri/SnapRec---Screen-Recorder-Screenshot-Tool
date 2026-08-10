import type { ReactNode } from 'react';

export interface ProseSectionProps {
  /** Mono label on a hairline rule — the product's own section device. */
  label?: string;
  title?: string;
  /** Present only where order carries information the reader needs. */
  index?: string;
  id?: string;
  children: ReactNode;
}

/** A section of a content page.
 *
 * The label-on-a-rule is the same device Home and Library use for their
 * sections, so a legal page and the app read as one product. */
export function ProseSection({ label, title, index, id, children }: ProseSectionProps) {
  return (
    <section id={id} className="flex flex-col gap-4 mb-14 scroll-mt-20">
      {label && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--sr-text-faint-on-light)]">
            {label}
          </span>
          <span className="flex-1 h-px bg-[var(--sr-border-light-soft)]" />
        </div>
      )}

      {title && (
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] m-0 flex items-baseline gap-3">
          {index && (
            <span className="font-mono text-[11px] font-normal text-[var(--sr-cyan-on-light)] shrink-0">
              {index}
            </span>
          )}
          {title}
        </h2>
      )}

      <div className="flex flex-col gap-4 text-[14.5px] leading-[1.7] text-[var(--sr-text-muted-on-light)] [&_a]:text-[var(--sr-cyan-on-light)] [&_strong]:text-[var(--sr-text-primary-on-light)] [&_strong]:font-semibold [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:list-disc">
        {children}
      </div>
    </section>
  );
}

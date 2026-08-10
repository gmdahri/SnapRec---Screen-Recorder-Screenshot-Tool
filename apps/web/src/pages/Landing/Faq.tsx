import { useState } from 'react';
import { Icon } from '@iconify/react';
import type { Faq as FaqItem } from './copy';

/** A disclosure list. The first answer is open, so the section reads as
 * content rather than a wall of closed rows. */
export function Faq({ faqs }: { faqs: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(faqs[0]?.n ?? null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {faqs.map(item => {
        const expanded = open === item.n;
        return (
          <div key={item.n} style={{ borderBottom: '1px solid var(--sr-border-light-soft)' }}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`faq-${item.n}`}
              onClick={() => setOpen(expanded ? null : item.n)}
              style={{
                width: '100%', minHeight: 48, padding: '12px 0',
                display: 'flex', alignItems: 'center', gap: 12,
                border: 'none', background: 'transparent', textAlign: 'left',
                fontSize: 14.5, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1 }}>{item.q}</span>
              <Icon
                icon={expanded ? 'ant-design:minus-outlined' : 'ant-design:plus-outlined'}
                width={13}
                style={{ color: expanded ? 'var(--sr-cyan-on-light)' : 'var(--sr-text-faint-on-light)' }}
                aria-hidden="true"
              />
            </button>

            {expanded && (
              <p id={`faq-${item.n}`} style={{
                margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.65, maxWidth: '68ch',
                color: 'var(--sr-text-muted-on-light)',
              }}>{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Icon } from '@iconify/react';
import { CaptureFrame } from '@snaprec/design-system';

/** The real product, not a stock mockup: a page with the extension open, and
 * the actual in-page recording bar overlapping its lower edge.
 *
 * The bar is the same component the extension injects — carbon body, coral
 * pulse, mono timer — so the hero shows what the product looks like rather
 * than an illustration of it. */
export function HeroMedia({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <CaptureFrame
        treatment="focused"
        inset={8}
        size={13}
        style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 10' }}
      >
        {children}
      </CaptureFrame>

      <div style={{
        position: 'absolute', left: '50%', bottom: -21, transform: 'translateX(-50%)',
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: 'var(--sr-surface-carbon)',
        border: '1px solid var(--sr-border-dark)',
        padding: 6,
        boxShadow: '0 8px 28px rgba(0,0,0,.28)',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '0 10px 0 8px', height: 30,
          color: 'var(--sr-text-primary-on-dark)',
          fontFamily: 'var(--sr-font-mono)', fontSize: 13,
        }}>
          <span aria-hidden="true" style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--sr-coral-mark)',
          }} />
          02:14
        </span>

        <span aria-hidden="true" style={divider} />

        {[
          ['ant-design:pause-outlined', 'var(--sr-text-secondary-on-dark)'],
          ['ant-design:audio-outlined', 'var(--sr-text-secondary-on-dark)'],
          ['ant-design:eye-invisible-outlined', 'var(--sr-text-faint-on-dark)'],
        ].map(([icon, color]) => (
          <span key={icon} style={{
            width: 30, height: 30, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', color,
          }}>
            <Icon icon={icon} width={15} aria-hidden="true" />
          </span>
        ))}

        <span aria-hidden="true" style={divider} />

        <span style={{
          height: 30, padding: '0 12px',
          display: 'inline-flex', alignItems: 'center',
          background: 'var(--sr-text-primary-on-dark)',
          color: 'var(--sr-surface-carbon)',
          fontSize: 12.5, fontWeight: 600,
        }}>Finish</span>
      </div>
    </div>
  );
}

const divider = {
  width: 1, height: 20, background: 'var(--sr-border-dark)',
} as const;

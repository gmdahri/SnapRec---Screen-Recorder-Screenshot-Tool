import { useRef, useState } from 'react';
import { DEMO_STEPS } from './copy';

/** The hero's companion: a carbon panel with a 300px step rail on the left and
 * the stage on the right.
 *
 * Not top tabs. The rail carries each step's body copy alongside its label, so
 * the three steps read as an explanation you can skim without clicking —
 * clicking only changes what the stage shows.
 *
 * A tablist with roving focus: arrow keys move between steps, which is what a
 * keyboard user expects of a stepped control. */
export function ProductDemo() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (delta: number) => {
    const next = (active + delta + DEMO_STEPS.length) % DEMO_STEPS.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
      background: 'var(--sr-surface-carbon)',
    }}>
      <div
        role="tablist"
        aria-label="How SnapRec works"
        aria-orientation="vertical"
        style={{
          display: 'flex', flexDirection: 'column', padding: '20px 0',
          borderRight: '1px solid var(--sr-border-dark-soft)',
        }}
      >
        {DEMO_STEPS.map((step, i) => {
          const on = i === active;
          return (
            <button
              key={step.key}
              ref={el => { refs.current[i] = el; }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(1); }
                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
              }}
              style={{
                border: 'none',
                borderLeft: `2px solid ${on ? 'var(--sr-cyan)' : 'transparent'}`,
                background: on ? 'var(--sr-surface-panel-dark)' : 'transparent',
                color: on ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
                padding: '14px 20px',
                display: 'flex', flexDirection: 'column', gap: 6,
                textAlign: 'left', cursor: 'pointer',
                transition: 'color var(--sr-dur-fast) var(--sr-ease)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{
                  fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                  color: on ? 'var(--sr-cyan)' : 'var(--sr-text-faint-on-dark)',
                }}>0{i + 1}</span>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.015em' }}>
                  {step.label}
                </span>
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.55 }}>{step.body}</span>
            </button>
          );
        })}
      </div>

      <div style={{
        position: 'relative',
        minHeight: 340,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--sr-surface-well)',
      }}>
        {/* Registration marks, not handles: the stage is the subject but it is
            not editable. */}
        {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
          <span
            key={corner}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 13, height: 13,
              ...(corner.startsWith('t') ? { top: 14 } : { bottom: 14 }),
              ...(corner.endsWith('l') ? { left: 14 } : { right: 14 }),
              [corner.startsWith('t') ? 'borderTop' : 'borderBottom']: '1px solid var(--sr-cyan)',
              [corner.endsWith('l') ? 'borderLeft' : 'borderRight']: '1px solid var(--sr-cyan)',
            }}
          />
        ))}

        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 11,
          color: 'var(--sr-text-faint-on-dark)',
        }}>{DEMO_STEPS[active].label}</span>
      </div>
    </div>
  );
}

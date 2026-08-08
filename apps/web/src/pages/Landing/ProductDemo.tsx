import { useRef, useState } from 'react';
import { CaptureFrame } from '@snaprec/design-system';
import { DEMO_STEPS } from './copy';

/** The hero opens on the real product, interactive — no empty hero.
 *
 * A tablist with roving focus rather than three buttons: arrow keys move
 * between steps, which is what a keyboard user expects of a stepped control. */
export function ProductDemo() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (delta: number) => {
    const next = (active + delta + DEMO_STEPS.length) % DEMO_STEPS.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="tablist" aria-label="How SnapRec works" style={{ display: 'flex', gap: 1 }}>
        {DEMO_STEPS.map((step, i) => (
          <button
            key={step.key}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
            }}
            style={{
              flex: 1, height: 'var(--sr-h-sm)', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: i === active ? 'var(--sr-cyan)' : 'var(--sr-surface-panel-light)',
              color: i === active ? 'var(--sr-cyan-fg)' : 'var(--sr-text-muted-on-light)',
            }}
          >{step.label}</button>
        ))}
      </div>

      <CaptureFrame
        treatment="focused"
        style={{
          background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 11,
          color: 'var(--sr-text-faint-on-dark)',
        }}>{DEMO_STEPS[active].label}</span>
      </CaptureFrame>

      <p style={{
        margin: 0, fontSize: 13.5, lineHeight: 1.6, maxWidth: '62ch',
        color: 'var(--sr-text-muted-on-light)',
      }}>{DEMO_STEPS[active].body}</p>
    </div>
  );
}

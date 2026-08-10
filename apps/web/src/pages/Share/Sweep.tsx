import type { CSSProperties } from 'react';

/** Indeterminate progress: a moving segment, never a fake percentage.
 *
 * One signal for "work in progress, duration unknown", shared by every surface
 * that has one — the processing page, a comment in flight, a description being
 * saved. It lives in a single file so the keyframes are declared once and the
 * reduced-motion fallback cannot drift between copies of them.
 *
 * Decorative: the caller carries the word. */
export function Sweep({ surface = 'dark', style }: {
  /** Which track the segment runs along. Cyan on both — only the rail changes. */
  surface?: 'dark' | 'light';
  style?: CSSProperties;
}) {
  return (
    <span
      data-testid="sweep"
      aria-hidden="true"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
        overflow: 'hidden',
        background: surface === 'dark'
          ? 'var(--sr-border-dark)'
          : 'var(--sr-border-light-soft)',
        ...style,
      }}
    >
      <span style={{
        position: 'absolute', top: 0, bottom: 0, width: '32%',
        background: surface === 'dark' ? 'var(--sr-cyan)' : 'var(--sr-cyan-on-light)',
        // The easing is spelled out rather than read from --sr-ease: this is an
        // inline shorthand, and a var() inside one is dropped wholesale by any
        // parser that cannot resolve it, which would silently kill the motion.
        animation: 'sr-share-sweep 1.1s cubic-bezier(.2,.8,.2,1) infinite',
      }} />

      <style>{`
        @keyframes sr-share-sweep { from { left: -32% } to { left: 100% } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="sweep"] > span { animation: none; width: 100%; opacity: .4 }
        }
      `}</style>
    </span>
  );
}

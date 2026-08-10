import { useEffect, useRef, useState } from 'react';
import { buildTicks, xToSec } from './timelineTicks';

/** P7 E2.1 + E2.4 — the ruler above the lanes, and the surface you seek on.
 *
 * It measures itself rather than being told a width, because tick density is a
 * function of pixels: the same clip needs different intervals at 400px and
 * 1600px, and the editor's panels resize.
 *
 * Dragging continues on window listeners, not on the element. A pointer that
 * leaves the ruler mid-drag would otherwise stop seeking while the button is
 * still held, which reads as the timeline having lost the drag. */

export interface TimelineRulerProps {
  durationSec: number;
  playheadSec: number;
  onSeek: (sec: number) => void;
}

export function TimelineRuler({ durationSec, playheadSec, onSeek }: TimelineRulerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    // ResizeObserver is absent in some test environments; the initial measure
    // above is enough there.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seekFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onSeek(xToSec(clientX - rect.left, rect.width || width, durationSec));
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) seekFromClientX(e.clientX); };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });

  const ticks = buildTicks(durationSec, width);
  const playheadPct = durationSec > 0
    ? Math.min(Math.max((playheadSec / durationSec) * 100, 0), 100)
    : 0;

  return (
    <div
      ref={ref}
      data-testid="timeline-ruler"
      role="slider"
      tabIndex={0}
      aria-label="Timeline position"
      aria-valuemin={0}
      aria-valuemax={Math.max(durationSec, 0)}
      aria-valuenow={playheadSec}
      aria-valuetext={`${Math.floor(playheadSec / 60)}:${String(Math.floor(playheadSec % 60)).padStart(2, '0')}`}
      onMouseDown={e => { dragging.current = true; seekFromClientX(e.clientX); }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(durationSec, playheadSec + 1)); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, playheadSec - 1)); }
      }}
      style={{
        position: 'relative', height: 22, cursor: durationSec > 0 ? 'pointer' : 'default',
        borderBottom: '1px solid var(--sr-border-dark-soft)',
        userSelect: 'none',
      }}
    >
      {ticks.map(tick => (
        <span
          key={tick.sec}
          data-testid="ruler-tick"
          style={{
            position: 'absolute', left: `${tick.pct}%`, top: 0,
            transform: tick.pct > 99 ? 'translateX(-100%)' : 'none',
            paddingLeft: 3, borderLeft: '1px solid var(--sr-border-dark)',
            fontFamily: 'var(--sr-font-mono)', fontSize: 9.5, lineHeight: '20px',
            color: 'var(--sr-text-faint-on-dark)', whiteSpace: 'nowrap',
          }}
        >{tick.label}</span>
      ))}

      {durationSec > 0 && (
        <span
          data-testid="ruler-playhead"
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, bottom: 0, left: `${playheadPct}%`,
            width: 1, background: 'var(--sr-text-primary-on-dark)',
          }}
        />
      )}
    </div>
  );
}

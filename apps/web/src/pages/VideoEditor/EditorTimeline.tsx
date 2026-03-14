import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { VideoPlayerHandle, VideoPlayerPlayback } from '../../components/VideoPlayer';

/** m:ss — total duration always plain (no tenths) so it never reads like extra “:04”) */
function fmt(t: number, withTenths?: boolean) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const base = `${m}:${s < 10 ? '0' : ''}${s}`;
  if (withTenths && t < 60) {
    const tenths = Math.floor((t % 1) * 10);
    return `${base}.${tenths}s`;
  }
  return base;
}

function fmtDuration(total: number) {
  return fmt(total, false);
}

function ticks(duration: number): number[] {
  if (duration <= 0) return [0];
  let step = duration <= 6 ? 2 : duration <= 15 ? 1 : duration <= 30 ? 2 : duration <= 60 ? 5 : duration <= 120 ? 10 : 30;
  if (duration > 6 && duration <= 20 && duration / step > 7) step = 2;
  const out: number[] = [];
  for (let x = 0; x <= duration + 0.001; x += step) out.push(Math.min(x, duration));
  if (out[out.length - 1] < duration - 0.05) out.push(duration);
  const sorted = [...new Set(out.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
  const last = sorted[sorted.length - 1];
  if (last === undefined || Math.abs(last - duration) > 0.05) sorted.push(duration);
  return [...new Set(sorted.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
}

type Props = {
  playerRef: RefObject<VideoPlayerHandle | null>;
  playback: VideoPlayerPlayback;
  clipName?: string;
  compact?: boolean;
  trimStart?: number;
  trimEnd?: number;
};

export function EditorTimeline({ playerRef, playback, clipName, compact, trimStart, trimEnd }: Props) {
  const { currentTime, duration, playing } = playback;
  const d = duration > 0 ? duration : 1;

  /** Aligned with &lt;video&gt; so playhead never disagrees with the clock */
  const [clock, setClock] = useState({ t: currentTime, d });
  const draggingRef = useRef(false);

  useLayoutEffect(() => {
    const snap = playerRef.current?.readPlaybackFromMedia();
    if (snap) setClock({ t: snap.currentTime, d: snap.duration });
    else setClock({ t: currentTime, d });
  }, [currentTime, duration, playerRef]);

  useEffect(() => {
    if (!playing || draggingRef.current) return;
    let id = 0;
    const loop = () => {
      const snap = playerRef.current?.readPlaybackFromMedia();
      if (snap) setClock({ t: snap.currentTime, d: snap.duration });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, playerRef]);

  const dClock = clock.d > 0 ? clock.d : d;
  const pct = Math.min(100, Math.max(0, (clock.t / dClock) * 100));
  const shortClip = dClock <= 15;

  const seekFromClientX = useCallback(
    (clientX: number, el: HTMLElement) => {
      const handle = playerRef.current;
      if (!handle) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const dur = handle.readPlaybackFromMedia()?.duration ?? dClock;
      if (dur <= 0) return;
      handle.seek(p * dur, { unrestricted: true });
      setClock({ t: p * dur, d: dur });
    },
    [playerRef, dClock],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX, e.currentTarget);
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    seekFromClientX(e.clientX, e.currentTarget);
  };

  const onTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    const snap = playerRef.current?.readPlaybackFromMedia();
    if (snap) setClock({ t: snap.currentTime, d: snap.duration });
  };

  const seekFromSlider = (valuePct: number) => {
    const handle = playerRef.current;
    if (!handle || dClock <= 0) return;
    const t = (valuePct / 100) * dClock;
    handle.seek(t, { unrestricted: true });
    setClock({ t, d: dClock });
  };

  const tickList = ticks(dClock);

  return (
    <footer
      className={`bg-white border-t border-slate-200 flex flex-col shrink-0 ${compact ? 'h-44' : 'h-56'}`}
      aria-label="Timeline"
    >
      <div className="h-11 border-b flex items-center px-3 gap-3 bg-slate-50/80 min-h-11">
        <button
          type="button"
          onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <span className="material-symbols-outlined text-xl">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <div
          className="flex items-center gap-2 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm"
          title="Current time / clip length"
        >
          <span className="text-xs font-mono text-primary font-bold tabular-nums min-w-[3.25rem] text-right">
            {fmt(clock.t, shortClip)}
          </span>
          <span className="text-slate-300 text-xs font-light select-none" aria-hidden>
            /
          </span>
          <span className="text-xs font-mono text-slate-600 tabular-nums min-w-[3.25rem]">
            {fmtDuration(dClock)}
          </span>
        </div>
        <div className="flex-1 min-w-[96px] min-h-[2rem] ml-2 pl-2 border-l border-slate-200/80">
          <input
            type="range"
            min={0}
            max={100}
            step={0.05}
            value={Number.isFinite(pct) ? pct : 0}
            onInput={(e) => seekFromSlider(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => seekFromSlider(Number(e.target.value))}
            className="w-full h-2 accent-primary cursor-pointer touch-none"
            aria-label="Seek"
          />
        </div>
      </div>

      {/* Ruler: 0% and 100% labels flush inset so they are never clipped; middle ticks centered */}
      <div className="h-9 border-b bg-white shrink-0 overflow-visible">
        <div className="relative h-full w-full min-w-[120px]">
          {tickList.map((sec, i) => {
            const n = tickList.length;
            const pct = dClock > 0 ? (sec / dClock) * 100 : 0;
            const isFirst = i === 0;
            const isLast = i === n - 1;
            const base = 'absolute bottom-0.5 text-[10px] font-mono tabular-nums whitespace-nowrap leading-none';
            if (n === 1) {
              return (
                <span key={sec} className={`${base} left-1.5 text-slate-500`}>
                  {fmt(sec)}
                </span>
              );
            }
            if (isFirst) {
              return (
                <span key={sec} className={`${base} left-1.5 text-slate-500`}>
                  {fmt(sec)}
                </span>
              );
            }
            if (isLast) {
              return (
                <span
                  key={sec}
                  className={`${base} right-1.5 z-[2] rounded px-1.5 py-0.5 text-slate-600 text-right bg-white shadow-sm ring-1 ring-slate-200/90`}
                >
                  {fmtDuration(sec)}
                </span>
              );
            }
            return (
              <span
                key={sec}
                className={`${base} text-slate-400 -translate-x-1/2`}
                style={{ left: `${pct}%` }}
              >
                {fmt(sec)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto relative bg-slate-50/80 p-2">
        <div className="relative rounded-lg border border-slate-200 bg-slate-100 min-h-[48px] mb-2 overflow-hidden touch-none select-none">
          {trimStart != null && trimEnd != null && trimEnd > trimStart && dClock > 0 && (
            <div
              className="absolute top-0 bottom-0 bg-emerald-400/25 border-x-2 border-emerald-600 z-0 pointer-events-none"
              style={{
                left: `${(trimStart / dClock) * 100}%`,
                width: `${((trimEnd - trimStart) / dClock) * 100}%`,
              }}
              aria-hidden
            />
          )}
          <div
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={dClock}
            aria-valuenow={clock.t}
            aria-label="Seek on video track"
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-[1] flex items-center px-3 py-2 text-xs font-medium text-violet-800/90 truncate hover:bg-violet-50/20"
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            onPointerCancel={onTrackPointerUp}
            onKeyDown={(e) => {
              if (!playerRef.current || dClock <= 0) return;
              const step = Math.min(0.5, Math.max(0.05, dClock / 80));
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                playerRef.current.seek(Math.max(0, clock.t - step), { unrestricted: true });
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                playerRef.current.seek(Math.min(dClock, clock.t + step), { unrestricted: true });
              }
            }}
          >
            <span className="pointer-events-none">{clipName ?? 'Video'}</span>
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-sm -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45 rounded-sm" />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 px-1">
          Ruler and playhead use the same scale (0 → end). Click or drag the bar to seek.
        </p>
      </div>
    </footer>
  );
}

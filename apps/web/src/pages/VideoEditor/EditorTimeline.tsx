import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { VideoPlayerHandle, VideoPlayerPlayback } from '../../components/VideoPlayer';
import type { ZoomSegment } from './types';

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
  zoomSegments?: ZoomSegment[];
  onSplitZoom?: () => void;
};

export function EditorTimeline({
  playerRef,
  playback,
  clipName,
  compact,
  trimStart,
  trimEnd,
  zoomSegments = [],
  onSplitZoom,
}: Props) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(48);
  const trackWidth = Math.max(320, dClock * pxPerSec);

  const fitTimeline = useCallback(() => {
    const el = scrollRef.current;
    if (!el || dClock <= 0) return;
    const w = el.clientWidth - 16;
    setPxPerSec(Math.max(20, Math.min(120, w / dClock)));
  }, [dClock]);

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
        {onSplitZoom ? (
          <button
            type="button"
            onClick={onSplitZoom}
            className="text-[10px] font-bold uppercase text-primary border border-violet-200 rounded-lg px-2 py-1 hover:bg-violet-50 shrink-0"
          >
            Split zoom
          </button>
        ) : null}
        <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-2">
          <span className="text-[10px] text-slate-400 hidden sm:inline">Zoom</span>
          <input
            type="range"
            min={20}
            max={120}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            className="w-16 sm:w-24 h-1.5 accent-primary"
            aria-label="Timeline zoom"
          />
          <button
            type="button"
            onClick={fitTimeline}
            className="text-[10px] font-semibold text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100"
          >
            Fit
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative bg-slate-50/80 flex flex-col">
        <div className="h-9 border-b bg-white shrink-0 sticky top-0 z-[1]">
          <div className="relative h-full min-w-[120px]" style={{ width: trackWidth, minWidth: '100%' }}>
            {tickList.map((sec, i) => {
              const n = tickList.length;
              const pct = dClock > 0 ? (sec / dClock) * 100 : 0;
              const isFirst = i === 0;
              const isLast = i === n - 1;
              const base =
                'absolute bottom-0.5 text-[10px] font-mono tabular-nums whitespace-nowrap leading-none';
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
        <div className="p-2 space-y-1" style={{ width: trackWidth, minWidth: '100%' }}>
        <div className="relative rounded-lg border border-slate-200 bg-slate-100 min-h-[48px] overflow-hidden touch-none select-none">
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
        {zoomSegments.length > 0 && dClock > 0 ? (
          <div className="relative h-7 rounded-lg border border-violet-200 bg-violet-50/50 overflow-hidden">
            <span className="absolute left-1 top-0.5 text-[9px] font-bold text-violet-700 z-[2]">Zoom</span>
            {zoomSegments.map((s) => (
              <div
                key={s.id}
                className="absolute top-1 bottom-0.5 bg-primary/80 rounded text-[8px] text-white flex items-center justify-center font-bold truncate px-0.5"
                style={{
                  left: `${(s.startSec / dClock) * 100}%`,
                  width: `${Math.max(0.5, ((s.endSec - s.startSec) / dClock) * 100)}%`,
                }}
                title={`${s.startSec.toFixed(1)}s–${s.endSec.toFixed(1)}s ${s.peakScale.toFixed(1)}×`}
              >
                {s.peakScale.toFixed(1)}×
              </div>
            ))}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 z-[3] pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          </div>
        ) : null}
        </div>
        <p className="text-[10px] text-slate-400 px-3 pb-2">
          Ruler and playhead use the same scale (0 → end). Click or drag the bar to seek.
        </p>
      </div>
    </footer>
  );
}

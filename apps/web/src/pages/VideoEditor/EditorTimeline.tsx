import type { RefObject } from 'react';
import type { VideoPlayerHandle, VideoPlayerPlayback } from '../../components/VideoPlayer';

function fmt(t: number) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function ticks(duration: number): number[] {
  if (duration <= 0) return [0];
  const step = duration <= 30 ? 5 : duration <= 120 ? 15 : 30;
  const out: number[] = [];
  for (let x = 0; x <= duration; x += step) out.push(x);
  if (out[out.length - 1] < duration) out.push(duration);
  return out;
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
  const pct = Math.min(100, Math.max(0, (currentTime / d) * 100));

  const scrub = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    playerRef.current?.seek(p * (duration || 0));
  };

  return (
    <footer
      className={`bg-white border-t border-slate-200 flex flex-col shrink-0 ${compact ? 'h-44' : 'h-56'}`}
      aria-label="Timeline"
    >
      <div className="h-10 border-b flex items-center px-3 gap-3 bg-slate-50/80">
        <button
          type="button"
          onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-700"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <span className="material-symbols-outlined text-xl">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <span className="text-xs font-mono text-slate-600 tabular-nums">
          <span className="text-primary font-bold">{fmt(currentTime)}</span>
          <span className="text-slate-400 mx-1">/</span>
          {fmt(duration)}
        </span>
        <div className="flex-1 min-w-[80px] max-w-xs ml-auto">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={(e) => playerRef.current?.seek((Number(e.target.value) / 100) * d)}
            className="w-full h-1.5 accent-primary cursor-pointer"
            aria-label="Seek"
          />
        </div>
      </div>

      <div className="h-8 border-b flex items-end px-2 gap-0 overflow-x-auto bg-white">
        {ticks(duration).map((sec) => (
          <span
            key={sec}
            className="text-[10px] font-mono text-slate-400 shrink-0"
            style={{ minWidth: '3rem' }}
          >
            {fmt(sec)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto relative bg-slate-50/80 p-2">
        <div className="relative rounded-lg border border-slate-200 bg-slate-100 min-h-[44px] mb-2 overflow-hidden">
          {trimStart != null && trimEnd != null && trimEnd > trimStart && duration > 0 && (
            <div
              className="absolute top-0 bottom-0 bg-emerald-400/25 border-x-2 border-emerald-600 z-0 pointer-events-none"
              style={{
                left: `${(trimStart / d) * 100}%`,
                width: `${((trimEnd - trimStart) / d) * 100}%`,
              }}
              aria-hidden
            />
          )}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-pointer text-left px-3 py-2 text-xs font-medium text-violet-800 truncate hover:bg-violet-50/30 rounded-lg z-[1]"
            onClick={(e) => scrub(e.clientX, e.currentTarget)}
            aria-label="Seek on video track"
          >
            {clipName ?? 'Video'}
          </button>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-sm"
            style={{ left: `${pct}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45 rounded-sm" />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 px-1">Click the clip bar to seek. Drag the slider above for fine scrubbing.</p>
      </div>
    </footer>
  );
}

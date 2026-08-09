import { useEffect } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { EDITOR_LEFT_PANEL_WIDTH } from './editorLayout';

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const MIN_RANGE = 0.15;

export function TrimSidebar() {
  const {
    projectTitle,
    trimStartSec,
    trimEndSec,
    setTrimStartSec,
    setTrimEndSec,
    videoDurationSec,
    editorPlaybackTime,
    setWorkspace,
    setActiveTool,
    setMediaLibraryOpen,
    currentProjectId,
    editorVideoSrc,
    applyLocalTrim,
    localModifyStatus,
    localModifyError,
    clearLocalModifyError,
  } = useVideoEditor();

  const d = videoDurationSec > 0 ? videoDurationSec : 1;
  const start = Math.min(trimStartSec, d - MIN_RANGE);
  const end = Math.max(trimEndSec, start + MIN_RANGE);
  const endClamped = Math.min(end, d);

  useEffect(() => {
    if (videoDurationSec > 0) {
      if (trimEndSec > videoDurationSec || trimEndSec <= trimStartSec) {
        setTrimEndSec(videoDurationSec);
      }
      if (trimStartSec >= videoDurationSec) setTrimStartSec(0);
      if (trimStartSec >= trimEndSec) {
        setTrimEndSec(Math.min(trimStartSec + MIN_RANGE * 2, videoDurationSec));
      }
    }
  }, [videoDurationSec]);

  const setStart = (v: number) => {
    const lo = Math.max(0, Math.min(v, d - MIN_RANGE));
    setTrimStartSec(lo);
    if (trimEndSec <= lo + MIN_RANGE) {
      setTrimEndSec(Math.min(lo + MIN_RANGE * 2, d));
    }
  };

  const setEnd = (v: number) => {
    const hi = Math.min(d, Math.max(v, start + MIN_RANGE));
    setTrimEndSec(hi);
  };

  return (
    <aside
      className={`${EDITOR_LEFT_PANEL_WIDTH} bg-[var(--sr-surface-panel-dark)] border-r border-[var(--sr-border-dark)] flex flex-col min-h-0 z-20`}
    >
      <div className="p-4 border-b border-[var(--sr-border-dark)] bg-gradient-to-b from-violet-50/70 to-white">
        <h2 className="text-xl font-extrabold text-[var(--sr-cyan)] tracking-tight">Trim</h2>
        <p className="text-sm font-medium text-[var(--sr-text-primary-on-dark)] truncate mt-1">{projectTitle}</p>
        <p className="text-xs text-[var(--sr-text-faint-on-dark)] mt-2">Save in the top bar when you’re done.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="rounded-[2px] bg-violet-50 border border-violet-100 p-3 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-[var(--sr-text-muted-on-dark)]">Playhead</span>
            <span className="text-lg font-mono font-semibold text-[var(--sr-text-primary-on-dark)]">{fmt(editorPlaybackTime)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2 text-xs font-semibold bg-[var(--sr-surface-panel-dark)] border border-violet-200 rounded-[2px] hover:bg-violet-100/80"
              onClick={() => setStart(Math.min(editorPlaybackTime, endClamped - MIN_RANGE))}
            >
              Set start
            </button>
            <button
              type="button"
              className="flex-1 py-2 text-xs font-semibold bg-[var(--sr-surface-panel-dark)] border border-violet-200 rounded-[2px] hover:bg-violet-100/80"
              onClick={() => setEnd(Math.max(editorPlaybackTime, start + MIN_RANGE))}
            >
              Set end
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--sr-text-secondary-on-dark)]">Start {fmt(start)}</label>
            <input
              type="range"
              min={0}
              max={Math.max(0, d - MIN_RANGE)}
              step={0.05}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              className="w-full accent-primary mt-1"
              aria-label="Trim start"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--sr-text-secondary-on-dark)]">End {fmt(endClamped)}</label>
            <input
              type="range"
              min={start + MIN_RANGE}
              max={d}
              step={0.05}
              value={endClamped}
              onChange={(e) => setEnd(Number(e.target.value))}
              className="w-full accent-primary mt-1"
              aria-label="Trim end"
            />
          </div>
          <p className="text-xs text-[var(--sr-text-faint-on-dark)]">
            Selection <span className="font-semibold text-[var(--sr-text-secondary-on-dark)]">{fmt(endClamped - start)}</span>
            <span className="text-[var(--sr-text-faint-on-dark)] mx-1">·</span>
            Video {fmt(d)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTrimStartSec(0);
            setTrimEndSec(d);
          }}
          className="w-full py-2.5 text-sm font-medium border border-[var(--sr-border-dark)] rounded-[2px] bg-[var(--sr-surface-panel-dark)] hover:bg-[var(--sr-surface-panel-dark)] text-[var(--sr-text-primary-on-dark)]"
        >
          Reset to full length
        </button>

        <div className="rounded-[2px] border border-[var(--sr-border-dark)] p-3 space-y-2 bg-[var(--sr-surface-panel-dark)]">
          <p className="text-xs text-[var(--sr-text-muted-on-dark)]">
            <strong>Modify</strong> applies this range as your working clip. Then Save.
          </p>
          <button
            type="button"
            disabled={
              !currentProjectId ||
              !editorVideoSrc ||
              localModifyStatus === 'working' ||
              endClamped - start < 0.2
            }
            onClick={() => void applyLocalTrim()}
            className="w-full py-2.5 rounded-[2px] text-sm font-bold bg-[var(--sr-cyan)] text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {localModifyStatus === 'working' ? 'Applying…' : 'Modify'}
          </button>
          {localModifyStatus === 'error' && localModifyError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-[2px] px-2 py-2">
              {localModifyError}
              <button type="button" className="block mt-1 font-semibold underline" onClick={clearLocalModifyError}>
                Dismiss
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-[var(--sr-border-dark)]">
        <button
          type="button"
          className="w-full py-2 text-sm font-medium text-[var(--sr-cyan)] hover:underline text-left"
          onClick={() => {
            setWorkspace('timeline');
            setActiveTool('media');
            setMediaLibraryOpen(true);
          }}
        >
          ← Media gallery
        </button>
      </div>
    </aside>
  );
}

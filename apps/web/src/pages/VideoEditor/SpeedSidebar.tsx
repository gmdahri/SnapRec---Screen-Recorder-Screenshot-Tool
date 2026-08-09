import { useVideoEditor } from './VideoEditorContext';
import { EDITOR_LEFT_PANEL_WIDTH } from './editorLayout';

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function SpeedSidebar() {
  const {
    projectTitle,
    playbackRate,
    setPlaybackRate,
    editorVideoSrc,
    setWorkspace,
    setActiveTool,
    setMediaLibraryOpen,
    addMediaToTimeline,
  } = useVideoEditor();

  return (
    <aside
      className={`${EDITOR_LEFT_PANEL_WIDTH} bg-[var(--sr-surface-panel-dark)] border-r border-[var(--sr-border-dark)] flex flex-col min-h-0 z-20`}
    >
      <div className="p-4 border-b border-[var(--sr-border-dark)] bg-[var(--sr-surface-panel-dark)]">
        <h2 className="text-xl font-extrabold text-[var(--sr-cyan)] tracking-tight">Speed</h2>
        <p className="text-sm font-medium text-[var(--sr-text-primary-on-dark)] truncate mt-1">{projectTitle}</p>
        <p className="text-xs text-[var(--sr-text-faint-on-dark)] mt-2">Save in the top bar when you’re done.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <p className="text-xs text-[var(--sr-text-muted-on-dark)] leading-relaxed rounded-[2px] bg-[var(--sr-surface-panel-dark-alt)] border border-[var(--sr-border-dark)] p-3">
          Preview only — export uses normal speed. Save stores your choice for next time.
        </p>

        <div>
          <p className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase tracking-widest mb-2">Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {SPEED_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!editorVideoSrc}
                onClick={() => setPlaybackRate(s)}
                className={`py-3 rounded-[2px] text-sm font-bold transition-colors ${
                  playbackRate === s
                    ? 'bg-[var(--sr-cyan)] text-white shadow-md'
                    : 'bg-[var(--sr-surface-panel-dark)] text-[var(--sr-text-secondary-on-dark)] hover:bg-[var(--sr-border-dark)] disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase">Speed (dropdown)</label>
          <select
            className="w-full mt-2 rounded-[2px] border border-[var(--sr-border-dark)] bg-[var(--sr-surface-panel-dark)] py-2.5 px-3 text-sm font-semibold"
            value={playbackRate}
            disabled={!editorVideoSrc}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            aria-label="Playback speed"
          >
            {SPEED_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {!editorVideoSrc && (
          <button
            type="button"
            onClick={() => {
              setWorkspace('timeline');
              setActiveTool('media');
              setMediaLibraryOpen(true);
              addMediaToTimeline();
            }}
            className="w-full py-3 text-sm font-semibold bg-[var(--sr-cyan)] text-white rounded-[2px]"
          >
            Add media first
          </button>
        )}
      </div>
    </aside>
  );
}

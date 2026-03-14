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
      className={`${EDITOR_LEFT_PANEL_WIDTH} bg-white border-r border-slate-200 flex flex-col min-h-0 z-20`}
    >
      <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-violet-50/70 to-white">
        <h2 className="text-xl font-extrabold text-primary tracking-tight">Speed</h2>
        <p className="text-sm font-medium text-slate-800 truncate mt-1">{projectTitle}</p>
        <p className="text-xs text-slate-500 mt-2">Save in the top bar when you’re done.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <p className="text-xs text-slate-600 leading-relaxed rounded-xl bg-violet-50/80 border border-violet-100 p-3">
          Preview only — export uses normal speed. Save stores your choice for next time.
        </p>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {SPEED_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!editorVideoSrc}
                onClick={() => setPlaybackRate(s)}
                className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                  playbackRate === s
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Speed (dropdown)</label>
          <select
            className="w-full mt-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-semibold"
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
            className="w-full py-3 text-sm font-semibold bg-primary text-white rounded-xl"
          >
            Add media first
          </button>
        )}
      </div>
    </aside>
  );
}

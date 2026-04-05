import { useState } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import type { ZoomKeyframe } from './types';
import type { VideoPlayerHandle } from '../../components/VideoPlayer';
import type { RefObject } from 'react';

const PIVOT_PRESETS = [
  { label: 'Center',       x: 50, y: 50 },
  { label: 'Top left',     x: 20, y: 20 },
  { label: 'Top right',    x: 80, y: 20 },
  { label: 'Bottom left',  x: 20, y: 80 },
  { label: 'Bottom right', x: 80, y: 80 },
] as const;

function pivotLabel(x: number, y: number): string {
  const p = PIVOT_PRESETS.find((p) => p.x === x && p.y === y);
  return p ? p.label : 'Custom';
}

function fmt(ms: number) {
  const t = ms / 1000;
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1);
  return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
    </label>
  );
}

function KeyframeRow({
  kf,
  onUpdate,
  onDelete,
  onSeek,
}: {
  kf: ZoomKeyframe;
  onUpdate: (patch: Partial<ZoomKeyframe>) => void;
  onDelete: () => void;
  onSeek: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pivot = pivotLabel(kf.x, kf.y);
  const isCustomPivot = pivot === 'Custom';

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left"
        onClick={() => { setExpanded((v) => !v); onSeek(); }}
      >
        <span className="text-slate-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
        </span>
        <span className="flex-1 text-sm font-mono tabular-nums text-slate-700">{fmt(kf.timestamp)}</span>
        <span className="text-sm font-semibold text-primary">{kf.scale.toFixed(1)}×</span>
        <span className="text-slate-400 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-3 bg-slate-50/60">
          {/* Scale */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Scale</label>
              <span className="text-xs font-semibold text-primary tabular-nums">{kf.scale.toFixed(1)}×</span>
            </div>
            <input
              type="range" min={1.1} max={3.0} step={0.1}
              value={kf.scale}
              onChange={(e) => onUpdate({ scale: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>1.1×</span><span>3.0×</span>
            </div>
          </div>

          {/* Pivot */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Zoom pivot</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white text-sm py-1.5 px-2"
              value={isCustomPivot ? 'Custom' : pivot}
              onChange={(e) => {
                const p = PIVOT_PRESETS.find((p) => p.label === e.target.value);
                if (p) onUpdate({ x: p.x, y: p.y });
              }}
            >
              {PIVOT_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
              <option value="Custom">Custom</option>
            </select>
            {isCustomPivot && (
              <div className="flex gap-2 mt-2">
                <label className="flex-1">
                  <span className="text-[10px] text-slate-500 block mb-0.5">X %</span>
                  <input
                    type="number" min={0} max={100} value={kf.x}
                    onChange={(e) => onUpdate({ x: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    className="w-full rounded-lg border border-slate-200 text-sm py-1 px-2"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Y %</span>
                  <input
                    type="number" min={0} max={100} value={kf.y}
                    onChange={(e) => onUpdate({ y: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    className="w-full rounded-lg border border-slate-200 text-sm py-1 px-2"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Duration</label>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">{(kf.duration / 1000).toFixed(1)}s</span>
            </div>
            <input
              type="range" min={500} max={10000} step={100}
              value={kf.duration}
              onChange={(e) => onUpdate({ duration: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>0.5s</span><span>10s</span>
            </div>
          </div>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete keyframe
          </button>
        </div>
      )}
    </div>
  );
}

export function ZoomSidebar({ playerRef }: { playerRef: RefObject<VideoPlayerHandle | null> }) {
  const {
    setWorkspace,
    setActiveTool,
    autoZoom,
    setAutoZoom,
    metadata,
    zoomKeyframes,
    addZoomKeyframe,
    updateZoomKeyframe,
    deleteZoomKeyframe,
  } = useVideoEditor();

  const autoEventCount = metadata.filter(
    (m) => m.type === 'mousedown' || m.type === 'scrollstop',
  ).length;

  const handleAddKeyframe = () => {
    const snap = playerRef.current?.readPlaybackFromMedia();
    const timestamp = snap ? snap.currentTime * 1000 : 0;
    const newKf: ZoomKeyframe = {
      id: crypto.randomUUID(),
      timestamp,
      x: 50,
      y: 50,
      scale: 1.3,
      duration: 3000,
    };
    addZoomKeyframe(newKf);
  };

  const handleBack = () => {
    setWorkspace('timeline');
    setActiveTool('media');
  };

  return (
    <aside className="w-72 xl:w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0 hidden lg:flex">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-sm font-bold text-slate-900">Zoom</h2>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
        {/* Auto-Zoom section */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Auto-Zoom</p>
              <p className="text-xs text-slate-500 mt-0.5">Follow clicks &amp; scroll stops</p>
            </div>
            <Toggle checked={autoZoom} onChange={setAutoZoom} />
          </div>
          {autoEventCount > 0 ? (
            <p className="text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200">
              <span className="font-semibold text-primary">{autoEventCount}</span> zoom {autoEventCount === 1 ? 'event' : 'events'} detected in this recording
            </p>
          ) : (
            <p className="text-xs text-slate-400 bg-white rounded-lg px-3 py-2 border border-slate-200">
              No auto-zoom events detected. Record with the latest extension to capture clicks.
            </p>
          )}
        </div>

        {/* Custom Keyframes section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Custom Keyframes</p>
            {zoomKeyframes.length > 0 && (
              <span className="text-[10px] font-semibold bg-violet-100 text-primary px-2 py-0.5 rounded-full">
                {zoomKeyframes.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddKeyframe}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-violet-300 text-primary text-sm font-semibold hover:bg-violet-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add keyframe at playhead
          </button>

          {zoomKeyframes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Add a keyframe to zoom in at a specific moment in the video.
            </p>
          ) : (
            <div className="space-y-2">
              {zoomKeyframes.map((kf) => (
                <KeyframeRow
                  key={kf.id}
                  kf={kf}
                  onUpdate={(patch) => updateZoomKeyframe(kf.id, patch)}
                  onDelete={() => deleteZoomKeyframe(kf.id)}
                  onSeek={() => {
                    playerRef.current?.seek(kf.timestamp / 1000, { unrestricted: true });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

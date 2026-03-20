import { useState } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { ZOOM_SCALE_MAX, ZOOM_SCALE_MIN } from './zoomMath';

export function ZoomPanel() {
  const {
    zoomSegments,
    addZoomSegment,
    updateZoomSegment,
    removeZoomSegment,
    videoDurationSec,
    editorPlaybackTime,
    recordingMeta,
    applyAutoZoomFromMeta,
    autoZoomProducedZero,
    pushUndoSnapshot,
  } = useVideoEditor();

  const d = videoDurationSec > 0 ? videoDurationSec : 0;
  const [addErr, setAddErr] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5);
  const [peak, setPeak] = useState(1.4);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.5);

  function handleAdd() {
    setAddErr(null);
    if (d <= 0) {
      setAddErr('Load video to add zoom (duration needed).');
      return;
    }
    const ok = addZoomSegment({
      startSec: Math.min(start, d - 0.2),
      endSec: Math.min(Math.max(end, start + 0.2), d),
      peakScale: peak,
      focusX,
      focusY,
    });
    if (!ok) setAddErr('Overlaps another segment or invalid range.');
  }

  return (
    <div className="space-y-3 text-sm border-t border-slate-100 pt-3 mt-2">
      <p className="text-xs font-bold text-slate-500 uppercase">Zoom (preview)</p>
      <p className="text-[11px] text-slate-500 leading-snug">
        Export is still flat video; zoom is preview-only until bake is supported.
      </p>
      <p className="text-[11px] text-slate-400 leading-snug">
        Zoom on clicks: single clicks get a short zoom; 2+ clicks within a few seconds get one sustained zoom. Zoom also applies on focus and typing.
      </p>
      {recordingMeta?.pointerSamples?.length ? (
        <button
          type="button"
          onClick={() => applyAutoZoomFromMeta()}
          className="w-full py-2 rounded-lg border border-primary text-primary text-xs font-semibold hover:bg-violet-50"
        >
          Apply auto zoom (from recording)
        </button>
      ) : null}
      <p className="text-[11px] text-slate-400">
        Playhead: <span className="font-mono">{editorPlaybackTime.toFixed(2)}s</span>
        {d > 0 ? (
          <>
            {' '}
            / {d.toFixed(1)}s
          </>
        ) : null}
      </p>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 space-y-2">
        <p className="text-xs font-semibold text-slate-700">New segment</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-500">
            Start (s)
            <input
              type="number"
              step={0.1}
              min={0}
              className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </label>
          <label className="text-[10px] text-slate-500">
            End (s)
            <input
              type="number"
              step={0.1}
              min={0}
              className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="text-[10px] text-slate-500 block">
          Peak scale ({ZOOM_SCALE_MIN}–{ZOOM_SCALE_MAX}×)
          <input
            type="range"
            min={ZOOM_SCALE_MIN + 0.05}
            max={ZOOM_SCALE_MAX}
            step={0.05}
            className="w-full accent-primary mt-1"
            value={peak}
            onChange={(e) => setPeak(Number(e.target.value))}
          />
          <span className="text-xs font-mono">{peak.toFixed(2)}×</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-500">
            Focus X (0–1)
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={focusX}
              onChange={(e) => setFocusX(Number(e.target.value))}
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Focus Y (0–1)
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-1 text-xs"
              value={focusY}
              onChange={(e) => setFocusY(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="w-full py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-95"
        >
          Add zoom segment
        </button>
        {addErr ? <p className="text-[11px] text-amber-700">{addErr}</p> : null}
      </div>

      {(zoomSegments.length === 0 && (autoZoomProducedZero || (recordingMeta?.pointerSamples?.length ?? 0) > 0)) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          No auto-zoom detected. Add zoom manually below or add segments.
        </div>
      ) : null}
      <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
        {zoomSegments.length === 0 ? (
          <li className="text-xs text-slate-400">No segments — add one above.</li>
        ) : (
          zoomSegments.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-100 bg-white p-2 text-xs space-y-1.5"
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-mono text-[11px] text-slate-600">
                  {s.startSec.toFixed(1)}s–{s.endSec.toFixed(1)}s
                </span>
                <button
                  type="button"
                  className="text-red-600 text-[11px] font-semibold shrink-0"
                  onClick={() => removeZoomSegment(s.id)}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <label className="text-[9px] text-slate-400">
                  Start
                  <input
                    type="number"
                    step={0.1}
                    className="w-full rounded border border-slate-100 px-1 py-0.5 text-[10px]"
                    value={s.startSec}
                    onChange={(e) =>
                      updateZoomSegment(s.id, { startSec: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-[9px] text-slate-400">
                  End
                  <input
                    type="number"
                    step={0.1}
                    className="w-full rounded border border-slate-100 px-1 py-0.5 text-[10px]"
                    value={s.endSec}
                    onChange={(e) => updateZoomSegment(s.id, { endSec: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="text-[9px] text-slate-400 block">
                Scale {s.peakScale.toFixed(2)}×
                <input
                  type="range"
                  min={ZOOM_SCALE_MIN + 0.05}
                  max={ZOOM_SCALE_MAX}
                  step={0.05}
                  className="w-full accent-primary h-1"
                  value={s.peakScale}
                  onPointerDown={() => pushUndoSnapshot()}
                  onChange={(e) =>
                    updateZoomSegment(s.id, { peakScale: Number(e.target.value) })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-1">
                <label className="text-[9px] text-slate-400">
                  Focus X {s.focusX.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full accent-primary h-1"
                    value={s.focusX}
                    onPointerDown={() => pushUndoSnapshot()}
                    onChange={(e) =>
                      updateZoomSegment(s.id, { focusX: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-[9px] text-slate-400">
                  Focus Y {s.focusY.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full accent-primary h-1"
                    value={s.focusY}
                    onPointerDown={() => pushUndoSnapshot()}
                    onChange={(e) =>
                      updateZoomSegment(s.id, { focusY: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            </li>
          ))
        )}
      </ul>
      <p className="text-[10px] text-slate-400">
        {zoomSegments.length} segment{zoomSegments.length !== 1 ? 's' : ''}. Drag sliders to adjust focus and scale.
      </p>
    </div>
  );
}

import { useCallback, useRef } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import type { FrameAspect } from './types';
import { DEFAULT_FRAME_STYLE } from './types';

const PRESETS: { id: string; label: string; className: string }[] = [
  { id: 'slate', label: 'Slate', className: 'bg-slate-200' },
  { id: 'violet-wash', label: 'Violet', className: 'bg-gradient-to-br from-violet-100 to-slate-100' },
  { id: 'neutral', label: 'Paper', className: 'bg-stone-100' },
  { id: 'mist', label: 'Mist', className: 'bg-gradient-to-b from-slate-50 to-slate-200' },
  { id: 'custom', label: 'Custom', className: 'bg-slate-300 border-2 border-dashed border-slate-400' },
];

const ASPECTS: { id: FrameAspect; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
];

export function FramePanel() {
  const { frameStyle, setFrameStyle, pushUndoSnapshot } = useVideoEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = useCallback(
    (p: Partial<FrameStyle>) => {
      pushUndoSnapshot();
      setFrameStyle((prev) => ({ ...prev, ...p }));
    },
    [pushUndoSnapshot, setFrameStyle],
  );

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <label className="text-xs font-bold text-slate-500 uppercase">Frame</label>
      <p className="text-[10px] text-slate-400">Preview only until export bake (Phase 5).</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((pr) => (
          <button
            key={pr.id}
            type="button"
            onClick={() => patch({ backgroundPresetId: pr.id })}
            className={`h-8 px-2 rounded-lg text-[10px] font-bold uppercase ${
              frameStyle.backgroundPresetId === pr.id
                ? 'ring-2 ring-primary ring-offset-1'
                : 'opacity-90 hover:opacity-100'
            } ${pr.className} text-slate-700`}
          >
            {pr.label}
          </button>
        ))}
      </div>
      {frameStyle.backgroundPresetId === 'custom' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              pushUndoSnapshot();
              const url = URL.createObjectURL(f);
              setFrameStyle((prev) => ({ ...prev, customBackgroundUrl: url }));
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full text-xs py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100"
          >
            Upload background
          </button>
        </div>
      ) : null}
      <div>
        <span className="text-[10px] text-slate-500">Aspect</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => patch({ aspect: a.id })}
              className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                frameStyle.aspect === a.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-slate-500">Padding {frameStyle.paddingPct}%</label>
        <input
          type="range"
          min={0}
          max={20}
          value={frameStyle.paddingPct}
          onPointerDown={() => pushUndoSnapshot()}
          onChange={(e) => setFrameStyle((p) => ({ ...p, paddingPct: Number(e.target.value) }))}
          className="w-full accent-primary"
        />
      </div>
      <div>
        <label className="text-[10px] text-slate-500">Radius {frameStyle.radiusPx}px</label>
        <input
          type="range"
          min={0}
          max={48}
          value={frameStyle.radiusPx}
          onPointerDown={() => pushUndoSnapshot()}
          onChange={(e) => setFrameStyle((p) => ({ ...p, radiusPx: Number(e.target.value) }))}
          className="w-full accent-primary"
        />
      </div>
      <div>
        <label className="text-[10px] text-slate-500">Shadow</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(frameStyle.shadow * 100)}
          onPointerDown={() => pushUndoSnapshot()}
          onChange={(e) =>
            setFrameStyle((p) => ({ ...p, shadow: Number(e.target.value) / 100 }))
          }
          className="w-full accent-primary"
        />
      </div>
      <div>
        <label className="text-[10px] text-slate-500">Background blur</label>
        <input
          type="range"
          min={0}
          max={24}
          value={frameStyle.blurBg}
          onPointerDown={() => pushUndoSnapshot()}
          onChange={(e) => setFrameStyle((p) => ({ ...p, blurBg: Number(e.target.value) }))}
          className="w-full accent-primary"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          pushUndoSnapshot();
          setFrameStyle({ ...DEFAULT_FRAME_STYLE });
        }}
        className="text-xs text-primary font-semibold"
      >
        Reset frame
      </button>
    </div>
  );
}

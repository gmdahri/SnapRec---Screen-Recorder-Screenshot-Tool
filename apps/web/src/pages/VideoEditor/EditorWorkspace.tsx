import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { getActiveZoom, AUTO_ZOOM_SCALE, ZOOM_DURATION_MS } from './zoomUtils';
import { useVideoEditor } from './VideoEditorContext';
import { VideoPlayer, type VideoPlayerHandle, type VideoPlayerPlayback } from '../../components/VideoPlayer';
import { EditorTimeline } from './EditorTimeline';
import type { EditorWorkspace as EditorWorkspaceType } from './types';
import { MediaGalleryTabContent } from './MediaLibraryPanel';
import { ZoomSidebar, ZoomEntry } from './ZoomSidebar';

const defaultPlayback: VideoPlayerPlayback = { currentTime: 0, duration: 0, playing: false };

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function CanvasSlot({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-4xl mx-auto aspect-video rounded-[2px] overflow-hidden bg-black shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function EmptyCanvasPlaceholder({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions: React.ReactNode;
}) {
  return (
    <CanvasSlot className="flex flex-col items-center justify-center p-6 text-center border border-white/10">
      <div className="w-14 h-14 rounded-[2px] bg-[var(--sr-surface-panel-dark)]/10 flex items-center justify-center text-white/90 text-2xl mb-3">
        ▶
      </div>
      <p className="text-white font-semibold text-sm mb-1">{title}</p>
      <p className="text-white/50 text-xs mb-5 max-w-sm">{subtitle}</p>
      {actions}
    </CanvasSlot>
  );
}

function PropertiesPanelCore({
  playbackRate,
  onPlaybackRateChange,
}: {
  playbackRate: number;
  onPlaybackRateChange: (r: number) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase">Speed</label>
        <select
          className="w-full mt-1 rounded-[2px] border-0 bg-[var(--sr-surface-panel-dark)] py-2 px-2"
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
          aria-label="Playback speed"
        >
          {SPEED_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PropertiesPanel({
  playbackRate,
  onPlaybackRateChange,
}: {
  playbackRate: number;
  onPlaybackRateChange: (r: number) => void;
}) {
  return (
    <div className="p-4 overflow-y-auto min-h-0 flex-1">
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase">Canvas</label>
          <p className="mt-1 bg-[var(--sr-surface-panel-dark)] rounded-[2px] p-2 border border-[var(--sr-border-dark)]">1920 × 1080</p>
        </div>
        <div>
          <label className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase">Opacity</label>
          <input type="range" className="w-full accent-[var(--sr-cyan)] mt-1" defaultValue={100} />
        </div>
        <PropertiesPanelCore playbackRate={playbackRate} onPlaybackRateChange={onPlaybackRateChange} />
        <hr className="border-[var(--sr-border-dark)]" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Auto-captions</span>
          <span className="text-xs text-[var(--sr-text-faint-on-dark)]">Off</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Noise reduction</span>
          <span className="text-xs text-[var(--sr-cyan)]">On</span>
        </div>
      </div>
    </div>
  );
}

/** Left sidebar: Media gallery | Properties (tabs). */
function LeftDockTabs({
  playbackRate,
  setPlaybackRate,
}: {
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
}) {
  const { rightDockTab, setRightDockTab } = useVideoEditor();
  return (
    <aside className="w-72 xl:w-80 shrink-0 border-r border-[var(--sr-border-dark)] bg-[var(--sr-surface-panel-dark)] flex flex-col min-h-0 hidden lg:flex">
      <div className="flex shrink-0 border-b border-[var(--sr-border-dark)]" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={rightDockTab === 'mediaGallery'}
          onClick={() => setRightDockTab('mediaGallery')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${
            rightDockTab === 'mediaGallery'
              ? 'text-[var(--sr-cyan)] border-b-2 border-[var(--sr-cyan)] bg-[var(--sr-surface-panel-dark-alt)]'
              : 'text-[var(--sr-text-faint-on-dark)] hover:bg-[var(--sr-surface-panel-dark)] border-b-2 border-transparent'
          }`}
        >
          Media gallery
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={rightDockTab === 'properties'}
          onClick={() => setRightDockTab('properties')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${
            rightDockTab === 'properties'
              ? 'text-[var(--sr-cyan)] border-b-2 border-[var(--sr-cyan)] bg-[var(--sr-surface-panel-dark-alt)]'
              : 'text-[var(--sr-text-faint-on-dark)] hover:bg-[var(--sr-surface-panel-dark)] border-b-2 border-transparent'
          }`}
        >
          Properties
        </button>
      </div>
      {rightDockTab === 'mediaGallery' ? (
        <MediaGalleryTabContent />
      ) : (
        <PropertiesPanel playbackRate={playbackRate} onPlaybackRateChange={setPlaybackRate} />
      )}
    </aside>
  );
}

function ToolRail({
  workspace,
}: {
  workspace: EditorWorkspaceType;
}) {
  if (workspace === 'effects') {
    return (
      <aside className="w-72 xl:w-80 shrink-0 border-l border-[var(--sr-border-dark)] bg-[var(--sr-surface-panel-dark)] flex flex-col min-h-0 overflow-y-auto hidden lg:flex">
        <div className="p-4 border-b border-[var(--sr-border-dark)]">
          <h2 className="text-xs font-bold text-[var(--sr-text-faint-on-dark)] uppercase tracking-widest">Effects</h2>
          <p className="text-sm font-extrabold text-[var(--sr-text-primary-on-dark)] mt-1">Coming soon</p>
        </div>
        <p className="p-4 text-sm text-[var(--sr-text-muted-on-dark)]">Looks and filters will live here.</p>
      </aside>
    );
  }

  return null;
}

export function EditorWorkspace() {
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [playback, setPlayback] = useState<VideoPlayerPlayback>(defaultPlayback);

  const {
    workspace,
    hasTimelineContent,
    addMediaToTimeline,
    editorVideoSrc,
    trimStartSec,
    trimEndSec,
    setVideoDurationSec,
    setEditorPlaybackTime,
    playbackRate,
    setPlaybackRate,
    autoZoom,
    metadata,
    zoomKeyframes,
    addZoomKeyframe,
    updateZoomKeyframe,
    deleteZoomKeyframe,
  } = useVideoEditor();

  const onPlaybackUpdate = useCallback(
    (p: VideoPlayerPlayback) => {
      setPlayback(p);
      setEditorPlaybackTime(p.currentTime);
      if (p.duration > 0) setVideoDurationSec(p.duration);
    },
    [setEditorPlaybackTime, setVideoDurationSec],
  );

  const d = playback.duration > 0 ? playback.duration : 1;
  const rangeOk = trimEndSec > trimStartSec && trimEndSec <= d + 0.01;
  const trimRange =
    workspace === 'trim' && rangeOk ? { start: trimStartSec, end: Math.min(trimEndSec, d) } : null;

  // Which zoom region the sidebar is editing. New with the redesign: the
  // context tracks keyframes, not which one is selected.
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const selectedZoom = zoomKeyframes.find((k) => k.id === selectedZoomId) ?? null;

  const suggestionEvents = useMemo(
    () => (autoZoom
      ? metadata.filter((m) => m.type === 'mousedown' || m.type === 'scrollstop')
      : []),
    [autoZoom, metadata],
  );

  /** Places a zoom region and selects it, so accepting is one click and the
   * controls for what you just made are already open. */
  const placeZoom = useCallback(
    (atMs: number, x: number, y: number, source: 'auto' | 'manual') => {
      const id = `z${Math.round(atMs)}`;
      // Whole percent, because the focus fields are 0–1 stepping by 0.01 and
      // read x/100. Anything finer rendered as 0.347222222…, overflowing the
      // input with precision the control cannot accept and the frame cannot
      // honour — 1% of 1280px is under 13px.
      const clamp = (v: number) => Math.round(Math.max(15, Math.min(85, v)));
      addZoomKeyframe({
        id,
        timestamp: atMs,
        x: clamp(x),
        y: clamp(y),
        scale: AUTO_ZOOM_SCALE,
        duration: ZOOM_DURATION_MS,
        source,
      });
      setSelectedZoomId(id);
    },
    [addZoomKeyframe],
  );

  const acceptSuggestion = useCallback(
    (id: string) => {
      const event = suggestionEvents[Number(id.slice(1))];
      if (!event) return;
      // Fall back to centre when the event carries no viewport: a zoom pinned
      // to 0,0 would swing the frame into the corner.
      const w = event.viewportWidth || 0;
      const h = event.viewportHeight || 0;
      placeZoom(
        event.timestamp,
        w ? (event.x / w) * 100 : 50,
        h ? (event.y / h) * 100 : 50,
        'auto',
      );
    },
    [suggestionEvents, placeZoom],
  );

  const showEditorTimeline = !!(editorVideoSrc && hasTimelineContent);
  const emptyOnboarding = !hasTimelineContent || workspace === 'empty';

  const showLeftDock =
    workspace !== 'trim' && workspace !== 'speed' && workspace !== 'zoom' && workspace !== 'effects';
  const toolRailOnly = workspace === 'effects';

  const emptyActions = (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        type="button"
        onClick={() => {
          addMediaToTimeline();
        }}
        className="px-4 py-2 bg-[var(--sr-cyan)] text-white rounded-[2px] text-sm font-semibold"
      >
        + Import
      </button>
      <button
        type="button"
        onClick={() => addMediaToTimeline()}
        className="px-4 py-2 border border-white/30 text-white rounded-[2px] text-sm font-semibold"
      >
        Media
      </button>
    </div>
  );

  // rAF-driven zoom at 60fps — reads video.currentTime directly, bypasses timeupdate throttle
  const autoZoomRef = useRef(autoZoom);
  autoZoomRef.current = autoZoom;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const zoomKeyframesRef = useRef(zoomKeyframes);
  zoomKeyframesRef.current = zoomKeyframes;

  useEffect(() => {
    let rafId: number;
    const frame = () => {
      rafId = requestAnimationFrame(frame);
      const videoEl = playerRef.current?.getVideoElement();
      if (!videoEl) return;
      const currentMs = videoEl.currentTime * 1000;
      const zoom = getActiveZoom(currentMs, zoomKeyframesRef.current, metadataRef.current, autoZoomRef.current);
      if (!zoom) {
        videoEl.style.transform = 'scale(1)';
        videoEl.style.transformOrigin = '';
      } else {
        videoEl.style.transform = `scale(${zoom.scale.toFixed(4)})`;
        videoEl.style.transformOrigin = `${zoom.originX.toFixed(2)}% ${zoom.originY.toFixed(2)}%`;
      }
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <main className="flex-1 flex min-w-0 min-h-0">
      {workspace === 'zoom' && !selectedZoom ? (
        // Progressive complexity applies to *properties*, not to the tool
        // itself: ZoomSidebar rightly renders null with nothing selected, but
        // that left the Zoom tool with no way in at all — nothing called
        // addZoomKeyframe anywhere in the app. This is the entry point.
        <ZoomEntry
          onAdd={() => placeZoom(Math.round((playback.currentTime || 0) * 1000), 50, 50, 'manual')}
          suggestionCount={suggestionEvents.length}
        />
      ) : workspace === 'zoom' ? (
        <ZoomSidebar
          region={selectedZoom
            ? {
                id: selectedZoom.id,
                startMs: selectedZoom.timestamp,
                endMs: selectedZoom.timestamp + selectedZoom.duration,
                scale: selectedZoom.scale,
                source: selectedZoom.source ?? 'manual',
                originMs: selectedZoom.source === 'auto' ? selectedZoom.timestamp : undefined,
                focus: {
                  x: Math.round(selectedZoom.x) / 100,
                  y: Math.round(selectedZoom.y) / 100,
                },
              }
            : null}
          onChange={(patch) => {
            if (!selectedZoom) return;
            updateZoomKeyframe(selectedZoom.id, {
              ...(patch.scale != null ? { scale: patch.scale } : {}),
              ...(patch.focus ? { x: patch.focus.x * 100, y: patch.focus.y * 100 } : {}),
            });
          }}
          onRemove={() => selectedZoom && deleteZoomKeyframe(selectedZoom.id)}
        />
      ) : showLeftDock ? (
        <LeftDockTabs playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
      ) : null}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--sr-surface-panel-dark)]">
        <div className="flex-1 flex items-center justify-center p-6 min-h-[200px] min-w-0 overflow-hidden">
          {editorVideoSrc ? (
            <CanvasSlot className="shadow-xl relative overflow-hidden">
              <VideoPlayer
                key={editorVideoSrc}
                ref={playerRef}
                src={editorVideoSrc}
                onPlaybackUpdate={onPlaybackUpdate}
                playbackRange={trimRange}
                playbackRate={playbackRate}
                onPlaybackRateChange={setPlaybackRate}
              />
            </CanvasSlot>
          ) : (
            <EmptyCanvasPlaceholder
              title={emptyOnboarding ? 'No video yet' : 'No preview'}
              subtitle={
                emptyOnboarding
                  ? 'Pick a clip in Media (left) or Import.'
                  : 'Load a project with video.'
              }
              actions={emptyOnboarding ? emptyActions : null}
            />
          )}
        </div>

        {showEditorTimeline ? (
          <EditorTimeline
            project={{
              durationMs: (playback.duration || 0) * 1000,
              trim: {
                startMs: (trimRange?.start ?? 0) * 1000,
                endMs: (trimRange?.end ?? playback.duration ?? 0) * 1000,
              },
              zoomRegions: zoomKeyframes.map((k) => ({
                id: k.id,
                startMs: k.timestamp,
                endMs: k.timestamp + k.duration,
                scale: k.scale,
                source: k.source ?? 'manual',
              })),
              suggestions: suggestionEvents.map((m, i) => ({
                id: `s${i}`,
                atMs: m.timestamp,
              })),
              playheadMs: (playback.currentTime || 0) * 1000,
            }}
            selection={selectedZoomId}
            onSelect={(id) => {
              setSelectedZoomId(id);
              const k = zoomKeyframes.find((z) => z.id === id);
              if (k) playerRef.current?.seek(k.timestamp / 1000, { unrestricted: true });
            }}
            onTrim={(_edge, ms) => playerRef.current?.seek(ms / 1000, { unrestricted: true })}
            onAcceptSuggestion={acceptSuggestion}
          />
        ) : (
          <TimelineFooter empty={emptyOnboarding} />
        )}
      </div>

      {toolRailOnly ? (
        <ToolRail
          workspace={workspace}
        />
      ) : null}
    </main>
  );
}

function TimelineFooter({ empty }: { empty?: boolean }) {
  return (
    <footer className="h-44 sm:h-48 bg-[var(--sr-surface-panel-dark)] border-t border-[var(--sr-border-dark)] flex flex-col shrink-0">
      <div className="h-10 border-b flex items-center px-4 justify-between text-xs text-[var(--sr-text-faint-on-dark)] bg-[var(--sr-surface-panel-dark)]/80">
        <span>Timeline</span>
        <span className="text-[var(--sr-text-faint-on-dark)]">—</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[var(--sr-surface-carbon)] px-4">
        <p className="text-sm text-[var(--sr-text-faint-on-dark)] font-medium text-center">
          {empty ? 'Add media to enable scrubbing.' : ''}
        </p>
      </div>
    </footer>
  );
}

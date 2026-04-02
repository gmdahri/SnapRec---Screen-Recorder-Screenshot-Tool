import React, { useRef, useState, useCallback } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { VideoPlayer, type VideoPlayerHandle, type VideoPlayerPlayback } from '../../components/VideoPlayer';
import { EditorTimeline } from './EditorTimeline';
import type { EditorWorkspace as EditorWorkspaceType } from './types';
import { MediaGalleryTabContent } from './MediaLibraryPanel';

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
      className={`w-full max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden bg-black shadow-2xl ${className}`}
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
      <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white/90 text-2xl mb-3">
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
        <label className="text-xs font-bold text-slate-500 uppercase">Speed</label>
        <select
          className="w-full mt-1 rounded-xl border-0 bg-slate-50 py-2 px-2"
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
  autoZoom,
  setAutoZoom,
}: {
  playbackRate: number;
  onPlaybackRateChange: (r: number) => void;
  autoZoom: boolean;
  setAutoZoom: (v: boolean) => void;
}) {
  return (
    <div className="p-4 overflow-y-auto min-h-0 flex-1">
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Canvas</label>
          <p className="mt-1 bg-slate-50 rounded-xl p-2 border border-slate-100">1920 × 1080</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Opacity</label>
          <input type="range" className="w-full accent-primary mt-1" defaultValue={100} />
        </div>
        <PropertiesPanelCore playbackRate={playbackRate} onPlaybackRateChange={onPlaybackRateChange} />
        <hr className="border-slate-100" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Auto-captions</span>
          <span className="text-xs text-slate-400">Off</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Noise reduction</span>
          <span className="text-xs text-primary">On</span>
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
          <span className="text-sm font-semibold">Auto-Zoom (Beta)</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={autoZoom}
              onChange={(e) => setAutoZoom(e.target.checked)}
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
    </div>
  );
}

/** Left sidebar: Media gallery | Properties (tabs). */
function LeftDockTabs({
  playbackRate,
  setPlaybackRate,
  autoZoom,
  setAutoZoom,
}: {
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
  autoZoom: boolean;
  setAutoZoom: (v: boolean) => void;
}) {
  const { rightDockTab, setRightDockTab } = useVideoEditor();
  return (
    <aside className="w-72 xl:w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0 hidden lg:flex">
      <div className="flex shrink-0 border-b border-slate-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={rightDockTab === 'mediaGallery'}
          onClick={() => setRightDockTab('mediaGallery')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${
            rightDockTab === 'mediaGallery'
              ? 'text-primary border-b-2 border-primary bg-violet-50/50'
              : 'text-slate-500 hover:bg-slate-50 border-b-2 border-transparent'
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
              ? 'text-primary border-b-2 border-primary bg-violet-50/50'
              : 'text-slate-500 hover:bg-slate-50 border-b-2 border-transparent'
          }`}
        >
          Properties
        </button>
      </div>
      {rightDockTab === 'mediaGallery' ? (
        <MediaGalleryTabContent />
      ) : (
        <PropertiesPanel playbackRate={playbackRate} onPlaybackRateChange={setPlaybackRate} autoZoom={autoZoom} setAutoZoom={setAutoZoom} />
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
      <aside className="w-72 xl:w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0 overflow-y-auto hidden lg:flex">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Effects</h2>
          <p className="text-sm font-extrabold text-slate-900 mt-1">Coming soon</p>
        </div>
        <p className="p-4 text-sm text-slate-600">Looks and filters will live here.</p>
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
    selectedClipId,
    clips,
    editorVideoSrc,
    trimStartSec,
    trimEndSec,
    setVideoDurationSec,
    setEditorPlaybackTime,
    playbackRate,
    setPlaybackRate,
    autoZoom,
    setAutoZoom,
    metadata,
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

  const clip = clips.find((c) => c.id === selectedClipId) ?? clips[0];
  const showEditorTimeline = !!(editorVideoSrc && hasTimelineContent);
  const emptyOnboarding = !hasTimelineContent || workspace === 'empty';

  const showLeftDock =
    workspace !== 'trim' && workspace !== 'speed' && workspace !== 'effects';
  const toolRailOnly = workspace === 'effects';

  const emptyActions = (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        type="button"
        onClick={() => {
          addMediaToTimeline();
        }}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
      >
        + Import
      </button>
      <button
        type="button"
        onClick={() => addMediaToTimeline()}
        className="px-4 py-2 border border-white/30 text-white rounded-lg text-sm font-semibold"
      >
        Media
      </button>
    </div>
  );

  // Calculate dynamic auto-zoom styling
  const zoomStyle = React.useMemo(() => {
    if (!autoZoom || metadata.length === 0) {
      return { transition: 'transform 0.4s ease-in-out, transform-origin 0.4s ease-in-out', transform: 'scale(1)' };
    }

    const currentMs = playback.currentTime * 1000;
    const ZOOM_DURATION_MS = 3000;
    
    // Find the current window size
    let currentWidth = 1920;
    let currentHeight = 1080;
    for (const m of metadata) {
      if (m.timestamp > currentMs) break;
      if (m.viewportWidth && m.viewportHeight) {
        currentWidth = m.viewportWidth;
        currentHeight = m.viewportHeight;
      }
    }

    // Find the *latest* click event
    let latestClick = null;
    for (let i = metadata.length - 1; i >= 0; i--) {
      // The content script tracks clicks as 'mousedown'
      if (metadata[i].timestamp <= currentMs && metadata[i].type === 'mousedown') {
        latestClick = metadata[i];
        break;
      }
    }

    // Determine if we should be zoomed in right now
    const isZoomedIn = latestClick && (currentMs - latestClick.timestamp) < ZOOM_DURATION_MS;

    if (!isZoomedIn) {
      return { transition: 'transform 0.5s ease-in-out, transform-origin 0.5s ease-in-out', transform: 'scale(1)' };
    }

    // Convert click pixels to percentage origin
    const originX = Math.max(0, Math.min(100, (latestClick.x / currentWidth) * 100));
    const originY = Math.max(0, Math.min(100, (latestClick.y / currentHeight) * 100));

    // Clamp the transform origin to avoid pushing the video edge past the canvas edge
    // A scale of 1.3 means we can shift the origin roughly to 15% - 85% to keep edges covered.
    const clampedX = Math.max(15, Math.min(85, originX));
    const clampedY = Math.max(15, Math.min(85, originY));

    return {
      transition: 'transform 0.5s ease-in-out, transform-origin 0.5s ease-in-out',
      transform: 'scale(1.3)',
      transformOrigin: `${clampedX}% ${clampedY}%`,
    };
  }, [autoZoom, metadata, playback.currentTime]);

  return (
    <main className="flex-1 flex min-w-0 min-h-0">
      {showLeftDock ? (
        <LeftDockTabs playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} autoZoom={autoZoom} setAutoZoom={setAutoZoom} />
      ) : null}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-100">
        <div className="flex-1 flex items-center justify-center p-6 min-h-[200px] min-w-0 overflow-hidden">
          {editorVideoSrc ? (
            <CanvasSlot className="shadow-xl relative overflow-hidden">
              <VideoPlayer
                key={editorVideoSrc}
                ref={playerRef}
                src={editorVideoSrc}
                zoomStyle={zoomStyle}
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
          workspace === 'trim' ? (
            <EditorTimeline
              playerRef={playerRef}
              playback={playback}
              clipName="Trim range"
              compact
              trimStart={trimRange?.start}
              trimEnd={trimRange?.end}
            />
          ) : (
            <EditorTimeline playerRef={playerRef} playback={playback} clipName={clip?.name ?? 'Clip'} />
          )
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
    <footer className="h-44 sm:h-48 bg-white border-t border-slate-200 flex flex-col shrink-0">
      <div className="h-10 border-b flex items-center px-4 justify-between text-xs text-slate-500 bg-slate-50/80">
        <span>Timeline</span>
        <span className="text-slate-400">—</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc] px-4">
        <p className="text-sm text-slate-400 font-medium text-center">
          {empty ? 'Add media to enable scrubbing.' : ''}
        </p>
      </div>
    </footer>
  );
}

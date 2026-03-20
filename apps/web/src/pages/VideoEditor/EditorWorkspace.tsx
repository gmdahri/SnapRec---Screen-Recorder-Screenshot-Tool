import React, { useRef, useState, useCallback } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { VideoPlayer, type VideoPlayerHandle, type VideoPlayerPlayback } from '../../components/VideoPlayer';
import { EditorTimeline } from './EditorTimeline';
import type { EditorWorkspace as EditorWorkspaceType } from './types';
import { MediaGalleryTabContent } from './MediaLibraryPanel';
import { ZoomPanel } from './ZoomPanel';
import { FramePanel } from './FramePanel';
import { focusAtTime, scaleAtTime } from './zoomMath';
import type { FrameStyle } from './types';
import type { RecordingMeta } from './autoZoomFromMeta';

const defaultPlayback: VideoPlayerPlayback = { currentTime: 0, duration: 0, playing: false };

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function frameBackgroundClass(fs: FrameStyle): string {
  if (fs.backgroundPresetId === 'custom' && fs.customBackgroundUrl) return '';
  switch (fs.backgroundPresetId) {
    case 'violet-wash':
      return 'bg-gradient-to-br from-violet-100 to-slate-100';
    case 'neutral':
      return 'bg-stone-100';
    case 'mist':
      return 'bg-gradient-to-b from-slate-50 to-slate-200';
    default:
      return 'bg-slate-200';
  }
}

function aspectBoxClass(aspect: FrameStyle['aspect']): string {
  switch (aspect) {
    case '9:16':
      return 'aspect-[9/16]';
    case '1:1':
      return 'aspect-square';
    case '4:3':
      return 'aspect-[4/3]';
    default:
      return 'aspect-video';
  }
}

function PreviewCompositor({
  t,
  segments,
  frameStyle,
  recordingMeta,
  showClicks,
  showKeys,
  children,
}: {
  t: number;
  segments: import('./types').ZoomSegment[];
  frameStyle: FrameStyle;
  recordingMeta: RecordingMeta | null;
  showClicks: boolean;
  showKeys: boolean;
  children: React.ReactNode;
}) {
  const pad = frameStyle.paddingPct;
  const shadowPx = 8 + frameStyle.shadow * 32;
  const bgStyle: React.CSSProperties =
    frameStyle.backgroundPresetId === 'custom' && frameStyle.customBackgroundUrl
      ? {
          backgroundImage: `url(${frameStyle.customBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {};
  const recentKey = (recordingMeta?.keyEvents || []).filter((e) => e.t <= t && e.t > t - 1.2).slice(-1)[0];
  const recentClicks = (recordingMeta?.clicks || []).filter((c) => Math.abs(c.t - t) < 0.08);

  return (
    <div className="w-full h-full min-h-0 flex items-center justify-center overflow-hidden relative bg-slate-200">
      <div
        className={`absolute inset-0 ${frameBackgroundClass(frameStyle)}`}
        style={{
          ...bgStyle,
          filter: frameStyle.blurBg > 0 ? `blur(${frameStyle.blurBg}px)` : undefined,
          transform: frameStyle.blurBg > 0 ? 'scale(1.06)' : undefined,
        }}
        aria-hidden
      />
      <div className="relative z-[1] w-full h-full flex items-center justify-center min-h-0">
      <div
        className="relative flex items-center justify-center w-full h-full min-h-0 p-[var(--pad)] box-border"
        style={
          {
            '--pad': `${pad}%`,
            padding: `${pad}%`,
            boxShadow: frameStyle.shadow > 0.02 ? `inset 0 0 60px rgba(0,0,0,${frameStyle.shadow * 0.06})` : undefined,
          } as React.CSSProperties
        }
      >
        <div
          className={`relative max-w-full max-h-full w-full overflow-hidden ${aspectBoxClass(frameStyle.aspect)} bg-black/5`}
          style={{
            borderRadius: frameStyle.radiusPx,
            boxShadow:
              frameStyle.shadow > 0.02
                ? `0 ${shadowPx / 4}px ${shadowPx}px rgba(15,23,42,${0.15 + frameStyle.shadow * 0.25})`
                : undefined,
          }}
        >
          <div className="absolute inset-0 w-full h-full [&_.aspect-video]:min-h-0 [&_.aspect-video]:h-full">
            {children}
          </div>
          {showClicks &&
            recentClicks.map((c, i) => (
              <div
                key={`${c.t}-${i}`}
                className="absolute pointer-events-none rounded-full border-2 border-primary/90 bg-primary/20 animate-ping"
                style={{
                  left: `${c.x * 100}%`,
                  top: `${c.y * 100}%`,
                  width: '12%',
                  height: '12%',
                  maxWidth: 48,
                  maxHeight: 48,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          {showKeys && recentKey ? (
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-slate-900/85 text-white text-sm font-mono shadow-lg border border-white/10 pointer-events-none"
              style={{ zIndex: 5 }}
            >
              {recentKey.key}
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}

function CanvasSlot({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-4xl mx-auto min-h-[200px] rounded-xl overflow-hidden shadow-2xl ${className}`}
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
}: {
  playbackRate: number;
  onPlaybackRateChange: (r: number) => void;
}) {
  const { showOverlayClicks, setShowOverlayClicks, showOverlayKeys, setShowOverlayKeys } =
    useVideoEditor();
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
        <ZoomPanel />
        <FramePanel />
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlayClicks}
              onChange={(e) => setShowOverlayClicks(e.target.checked)}
            />
            Show clicks
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlayKeys}
              onChange={(e) => setShowOverlayKeys(e.target.checked)}
            />
            Show keyboard
          </label>
        </div>
        <hr className="border-slate-100" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Auto-captions</span>
          <span className="text-xs text-slate-400">Off</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Noise reduction</span>
          <span className="text-xs text-primary">On</span>
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
        <PropertiesPanel playbackRate={playbackRate} onPlaybackRateChange={setPlaybackRate} />
      )}
    </aside>
  );
}

function ToolRail({
  workspace,
  playbackRate,
  setPlaybackRate,
  setMediaLibraryOpen,
  addMediaToTimeline,
}: {
  workspace: EditorWorkspaceType;
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
  setMediaLibraryOpen: (o: boolean) => void;
  addMediaToTimeline: () => void;
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
    setMediaLibraryOpen,
    selectedClipId,
    clips,
    editorVideoSrc,
    trimStartSec,
    trimEndSec,
    setVideoDurationSec,
    setEditorPlaybackTime,
    playbackRate,
    setPlaybackRate,
    zoomSegments,
    editorPlaybackTime,
    splitZoomAtPlayhead,
    frameStyle,
    recordingMeta,
    showOverlayClicks,
    showOverlayKeys,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useVideoEditor();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Avoid full-page submit (reload) when Enter is pressed inside a form wrapper
      if (
        e.key === 'Enter' &&
        (e.target as HTMLElement)?.closest?.('form') &&
        !(e.target as HTMLInputElement)?.matches?.('textarea')
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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

  return (
    <main className="flex-1 flex min-w-0 min-h-0">
      {showLeftDock ? (
        <LeftDockTabs playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
      ) : null}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-100">
        <div className="flex-1 flex items-center justify-center p-6 min-h-[200px] min-w-0">
          {editorVideoSrc ? (
            <CanvasSlot className="shadow-xl min-h-[280px]">
              <PreviewCompositor
                t={editorPlaybackTime}
                segments={zoomSegments}
                frameStyle={frameStyle}
                recordingMeta={recordingMeta}
                showClicks={showOverlayClicks}
                showKeys={showOverlayKeys}
              >
                <VideoPlayer
                  key={editorVideoSrc}
                  ref={playerRef}
                  src={editorVideoSrc}
                  onPlaybackUpdate={onPlaybackUpdate}
                  playbackRange={trimRange}
                  playbackRate={playbackRate}
                  onPlaybackRateChange={setPlaybackRate}
                  videoZoomScale={scaleAtTime(editorPlaybackTime, zoomSegments)}
                  videoZoomFocus={focusAtTime(editorPlaybackTime, zoomSegments)}
                  metaViewport={
                    recordingMeta?.vw && recordingMeta?.vh
                      ? { w: recordingMeta.vw, h: recordingMeta.vh }
                      : null
                  }
                />
              </PreviewCompositor>
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
            <EditorTimeline
              playerRef={playerRef}
              playback={playback}
              clipName={clip?.name ?? 'Clip'}
              zoomSegments={zoomSegments}
              onSplitZoom={splitZoomAtPlayhead}
            />
          )
        ) : (
          <TimelineFooter empty={emptyOnboarding} />
        )}
      </div>

      {toolRailOnly ? (
        <ToolRail
          workspace={workspace}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          setMediaLibraryOpen={setMediaLibraryOpen}
          addMediaToTimeline={addMediaToTimeline}
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

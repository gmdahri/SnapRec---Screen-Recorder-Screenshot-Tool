import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { CaptureFrame } from '@snaprec/design-system';
import { StageZoomOverlay } from './StageZoomOverlay';
import { getActiveZoom, AUTO_ZOOM_SCALE, ZOOM_DURATION_MS } from './zoomUtils';
import { useVideoEditor } from './VideoEditorContext';
import { VideoPlayer, type VideoPlayerHandle, type VideoPlayerPlayback } from '../../components/VideoPlayer';
import { EditorTimeline } from './EditorTimeline';
import { TimelineRuler } from './TimelineRuler';
import { TimelineZoom } from './TimelineZoom';
import { useWaveform } from './useWaveform';
import { fadeOpacityAt } from './fades';
import type { EditorWorkspace as EditorWorkspaceType } from './types';
import { MediaGalleryTabContent } from './MediaLibraryPanel';
import { ZoomSidebar, ZoomEntry } from './ZoomSidebar';

const defaultPlayback: VideoPlayerPlayback = { currentTime: 0, duration: 0, playing: false };

function CanvasSlot({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="w-full max-w-4xl mx-auto p-3 border border-dashed border-[var(--sr-border-dark-strong)] rounded-[2px]">
      <CaptureFrame
        treatment="focused"
        style={{ aspectRatio: '16 / 9', background: 'var(--sr-surface-carbon)' }}
      >
        <div className={`w-full h-full overflow-hidden ${className}`}>
          {children}
        </div>
      </CaptureFrame>
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
    <CanvasSlot className="flex flex-col items-center justify-center p-6 text-center border border-[var(--sr-border-dark)]">
      <div className="w-14 h-14 rounded-[2px] bg-[var(--sr-surface-panel-dark)]/10 flex items-center justify-center text-[var(--sr-text-primary-on-dark)] text-2xl mb-3">
        ▶
      </div>
      <p className="text-[var(--sr-text-primary-on-dark)] font-semibold text-sm mb-1">{title}</p>
      <p className="text-[var(--sr-text-faint-on-dark)] text-xs mb-5 max-w-sm">{subtitle}</p>
      {actions}
    </CanvasSlot>
  );
}

/* The dock's Properties tab used to render a placeholder here: a hardcoded
   1920x1080 canvas size, an opacity slider with no handler, and static
   "Auto-captions: Off" / "Noise reduction: On" rows — the last of which
   asserted something untrue. The real panel is passed in from
   VideoEditorPage, which owns the waveform analysis it needs. */

/** Left sidebar: Media gallery | Properties (tabs). */
function LeftDockTabs({ properties }: { properties?: React.ReactNode }) {
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
      {rightDockTab === 'mediaGallery' ? <MediaGalleryTabContent /> : properties}
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

/** `properties` fills the dock's Properties tab.
 *
 * It arrives as a node rather than being built here because the panel needs the
 * decoded waveform — silences, loudness — which VideoEditorPage measures. It
 * used to be a second sidebar of its own alongside this dock, so Media showed
 * two panels and set the trim in one of them while the Trim tool owned the
 * same controls in the other. */
export function EditorWorkspace({ properties }: { properties?: React.ReactNode }) {
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
    cuts,
    removeCut,
    fadeInSec,
    fadeOutSec,
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

  // E2.5 — decoded once per clip and cached; an unreadable file (expired URL,
  // odd codec, no microphone) leaves the lane empty rather than failing.
  const { peaks: waveform } = useWaveform(editorVideoSrc);

  // E2.6 — how much wider than the panel the track is drawn.
  const [timelineZoom, setTimelineZoom] = useState(1);

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
        className="px-4 py-2 bg-[var(--sr-cyan)] text-[var(--sr-cyan-fg)] rounded-[2px] text-sm font-semibold"
      >
        + Import
      </button>
      <button
        type="button"
        onClick={() => addMediaToTimeline()}
        className="px-4 py-2 border border-[var(--sr-border-dark-strong)] text-[var(--sr-text-primary-on-dark)] rounded-[2px] text-sm font-semibold"
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
        <LeftDockTabs properties={properties} />
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
                skipRanges={cuts}
                playbackRate={playbackRate}
                onPlaybackRateChange={setPlaybackRate}
              />
              {/* E1.4 — drawn over the stage, never intercepting the pointer,
                  so scrubbing and play/pause still reach the player beneath. */}
              <StageZoomOverlay keyframe={selectedZoom} />
              {/* E4.1 — the same ramp the export will apply, drawn over the
                  stage. Scrubbing through the head or tail therefore shows the
                  fade rather than full-brightness footage that will not ship. */}
              {(fadeInSec > 0 || fadeOutSec > 0) && (
                <div
                  data-testid="fade-overlay"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'var(--sr-surface-well)',
                    opacity: 1 - fadeOpacityAt(
                      playback.currentTime || 0,
                      trimRange?.start ?? 0,
                      trimRange?.end ?? (playback.duration || 0),
                      { inSec: fadeInSec, outSec: fadeOutSec },
                    ),
                  }}
                />
              )}
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
          <>
            {/* E2.6 — the control sits with the timeline it scales, not with
                the picture zoom on the stage above. */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '6px 16px 0', background: 'var(--sr-surface-carbon)',
            }}>
              <TimelineZoom zoom={timelineZoom} onChange={setTimelineZoom} />
            </div>

            {/* Zooming widens the track and scrolls it, rather than redrawing
                at a different scale: every lane already positions by percent,
                so one container width drives ruler and lanes together and they
                cannot drift apart. */}
            <div style={{ overflowX: 'auto', background: 'var(--sr-surface-carbon)' }}>
              <div style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}>
            {/* E2.1/E2.4 — the ruler is the seek surface; the lanes below stay
                display-and-drag. Seeks go straight to the element so the
                playhead does not lag a React round-trip behind the video. */}
            <div style={{ padding: '0 16px', background: 'var(--sr-surface-carbon)' }}>
              <TimelineRuler
                durationSec={playback.duration || 0}
                playheadSec={playback.currentTime || 0}
                onSeek={(sec) => playerRef.current?.seek(sec, { unrestricted: true })}
              />
            </div>
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
              // E2.5 — real peaks, or an empty lane if the audio cannot be read.
              waveform,
              cuts: cuts.map((c) => ({
                id: c.id, startMs: c.startSec * 1000, endMs: c.endSec * 1000,
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
            onRemoveCut={removeCut}
          />
              </div>
            </div>
          </>
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

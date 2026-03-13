import { useRef, useState, useCallback } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { VideoPlayer, type VideoPlayerHandle, type VideoPlayerPlayback } from '../../components/VideoPlayer';
import { EditorTimeline } from './EditorTimeline';

const defaultPlayback: VideoPlayerPlayback = { currentTime: 0, duration: 0, playing: false };

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
  } = useVideoEditor();

  const onPlaybackUpdate = useCallback(
    (p: VideoPlayerPlayback) => {
      setPlayback(p);
      setEditorPlaybackTime(p.currentTime);
      if (p.duration > 0) setVideoDurationSec(p.duration);
    },
    [setEditorPlaybackTime, setVideoDurationSec],
  );

  if (workspace === 'effects') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Effects</p>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Coming soon</h2>
        <p className="text-sm text-slate-600 max-w-sm mb-6">
          Looks, filters, and presets will live here. Use <strong>Media gallery</strong> and <strong>Trim</strong>{' '}
          for now.
        </p>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 font-semibold">
          Speed &amp; Text tools are coming soon too
        </p>
      </div>
    );
  }

  if (workspace === 'trim') {
    const d = playback.duration > 0 ? playback.duration : 1;
    const rangeOk = trimEndSec > trimStartSec && trimEndSec <= d + 0.01;
    const range = rangeOk ? { start: trimStartSec, end: Math.min(trimEndSec, d) } : null;
    return (
      <div className="flex-1 flex min-w-0 bg-slate-100">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            <div className="w-full max-w-4xl text-white/50 text-sm">
              {editorVideoSrc ? (
                <VideoPlayer
                  key={editorVideoSrc}
                  ref={playerRef}
                  src={editorVideoSrc}
                  onPlaybackUpdate={onPlaybackUpdate}
                  playbackRange={range}
                />
              ) : (
                <div className="aspect-video w-full max-w-4xl bg-black rounded-xl flex items-center justify-center text-slate-400">
                  Load a project with video to trim
                </div>
              )}
            </div>
          </div>
          <EditorTimeline
            playerRef={playerRef}
            playback={playback}
            clipName="Trim range"
            compact
            trimStart={range?.start}
            trimEnd={range?.end}
          />
        </div>
      </div>
    );
  }

  if (!hasTimelineContent || workspace === 'empty') {
    return (
      <main className="flex-1 flex flex-col min-w-0 relative">
        <section className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl aspect-video border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center text-primary text-2xl mb-4">↑</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Import video or record again</h1>
            <p className="text-slate-500 text-center text-sm mb-6">Upload files or open media library.</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => {
                  setMediaLibraryOpen(true);
                  addMediaToTimeline();
                }}
                className="px-6 py-3 bg-primary text-white rounded-xl font-semibold"
              >
                + Import Media
              </button>
              <button
                type="button"
                onClick={() => setMediaLibraryOpen(true)}
                className="px-6 py-3 border-2 border-primary text-primary rounded-xl font-semibold"
              >
                Record
              </button>
            </div>
          </div>
        </section>
        <TimelineFooter empty />
      </main>
    );
  }

  const clip = clips.find((c) => c.id === selectedClipId) ?? clips[0];

  return (
    <main className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl shadow-xl text-white/40 text-sm">
            {editorVideoSrc ? (
              <VideoPlayer
                key={editorVideoSrc}
                ref={playerRef}
                src={editorVideoSrc}
                onPlaybackUpdate={onPlaybackUpdate}
              />
            ) : (
              <div className="aspect-video w-full max-w-4xl bg-black rounded-2xl flex items-center justify-center">
                {clip?.name ?? 'Preview'}
              </div>
            )}
          </div>
        </div>
        <EditorTimeline
          playerRef={playerRef}
          playback={playback}
          clipName={clip?.name}
        />
      </div>
      <PropertiesPanel />
    </main>
  );
}

function TimelineFooter({ empty }: { empty?: boolean }) {
  return (
    <footer className="h-48 bg-white border-t border-slate-200 flex flex-col shrink-0">
      <div className="h-10 border-b flex items-center px-4 justify-between text-xs text-slate-500">
        <span>00:00:00</span>
        <span>Export</span>
      </div>
      <div className="h-8 border-b flex items-end px-4 gap-8 text-[10px] text-slate-400">
        {[0, 2, 4, 6, 8, 10, 12, 14].map((s) => (
          <span key={s}>{s}s</span>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <p className="text-sm text-slate-400 font-medium">
          {empty ? 'Timeline is empty. Add media to get started.' : ''}
        </p>
      </div>
    </footer>
  );
}

function PropertiesPanel() {
  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto hidden xl:block">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Properties</h2>
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Canvas</label>
          <p className="mt-1 bg-slate-50 rounded-xl p-2 border border-slate-100">1920 × 1080</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Opacity</label>
          <input type="range" className="w-full accent-primary mt-1" defaultValue={100} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Speed</label>
          <select className="w-full mt-1 rounded-xl border-0 bg-slate-50 py-2">
            <option>1.0x</option>
          </select>
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
    </aside>
  );
}


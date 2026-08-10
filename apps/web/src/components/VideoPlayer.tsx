import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export type VideoPlayerPlayback = {
  currentTime: number;
  duration: number;
  playing: boolean;
};

export type VideoPlayerHandle = {
  /** @param unrestricted When true, do not clamp to trim range — timeline scrub uses full duration */
  seek: (seconds: number, opts?: { unrestricted?: boolean }) => void;
  play: () => void;
  pause: () => void;
  /** Read clock from &lt;video&gt; so timeline playhead matches the element (avoids React/state desync). */
  readPlaybackFromMedia: () => { currentTime: number; duration: number } | null;
  /** Direct access to the underlying HTMLVideoElement for imperative style updates (e.g. rAF zoom). */
  getVideoElement: () => HTMLVideoElement | null;
};

export interface PlayerMarker {
  id: string;
  ms: number;
  /** Coral marker — the one thing on this product that is genuinely owed. */
  needsReply?: boolean;
}

interface VideoPlayerProps {
  src?: string;
  /** Comment anchors drawn on the scrubber. Nothing is drawn until the running
   * time is known, otherwise every marker stacks at zero. */
  markers?: PlayerMarker[];
  onMarkerClick?: (ms: number) => void;
  /** Source ranges the edit removes (P7 E3.4). Playback jumps over them so the
   * preview shows what the export will contain, not the raw footage.
   * Must already be normalised — see cuts.ts. */
  skipRanges?: { startSec: number; endSec: number }[];
  isProcessing?: boolean;
  isReady?: boolean;
  /** Fires on timeupdate + play/pause + duration ready — use to sync timeline. */
  onPlaybackUpdate?: (state: VideoPlayerPlayback) => void;
  /** When set, playback stays within [start, end] (seconds); pauses at end. */
  playbackRange?: { start: number; end: number } | null;
  /** Controlled preview speed; when set, syncs HTMLVideoElement and speed menu. */
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  zoomStyle?: React.CSSProperties;
  /** Show SnapRec branding watermark in the top-right corner */
  showBranding?: boolean;
  /** The length as recorded in the database.
   *
   * A webm written by MediaRecorder carries no duration in its header, so the
   * browser must fetch the WHOLE file before `video.duration` becomes finite —
   * ten seconds of staring at `--:--` for a forty-second screen recording. The
   * stored value is known immediately, so the transport can be honest from the
   * first paint and playback can start as soon as enough has buffered. */
  knownDurationSec?: number;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    src, isProcessing, onPlaybackUpdate, playbackRange, playbackRate, onPlaybackRateChange,
    zoomStyle, showBranding, markers = [], onMarkerClick,
    skipRanges, knownDurationSec,
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(knownDurationSec ?? 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlaybackUpdateRef = useRef(onPlaybackUpdate);
  onPlaybackUpdateRef.current = onPlaybackUpdate;

  const emitPlayback = (playing?: boolean) => {
    const el = videoRef.current;
    const d = el && isFinite(el.duration) ? el.duration : duration;
    const t = el?.currentTime ?? currentTime;
    const p = playing ?? (el ? !el.paused : isPlaying);
    onPlaybackUpdateRef.current?.({ currentTime: t, duration: d, playing: p });
  };

  useImperativeHandle(ref, () => ({
    seek(seconds: number, opts?: { unrestricted?: boolean }) {
      const el = videoRef.current;
      if (!el || isProcessing) return;
      const fromEl = isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      const fromState = isFinite(duration) && duration > 0 ? duration : 0;
      const d = fromEl || fromState;
      if (d <= 0) return;
      let t = Math.max(0, Math.min(seconds, d));
      if (!opts?.unrestricted) {
        const r = rangeRef.current;
        if (r && r.end > r.start) {
          t = Math.max(r.start, Math.min(t, r.end));
        }
      }
      el.currentTime = t;
      setCurrentTime(el.currentTime);
      emitPlayback();
    },
    readPlaybackFromMedia() {
      const el = videoRef.current;
      if (!el) return null;
      const d = isFinite(el.duration) && el.duration > 0 ? el.duration : duration;
      if (!isFinite(d) || d <= 0) return null;
      return { currentTime: el.currentTime, duration: d };
    },
    play() {
      if (!isProcessing) void videoRef.current?.play();
    },
    pause() {
      videoRef.current?.pause();
    },
    getVideoElement() {
      return videoRef.current;
    },
  }));

  const togglePlay = () => {
    if (!videoRef.current || isProcessing) return;
    const el = videoRef.current;
    const r = rangeRef.current;
    if (el.paused) {
      if (r && r.end > r.start && el.currentTime >= r.end - 0.05) el.currentTime = r.start;
      else if (r && r.end > r.start && el.currentTime < r.start) el.currentTime = r.start;
      void el.play();
    } else {
      el.pause();
    }
  };

  const rangeRef = useRef(playbackRange);
  rangeRef.current = playbackRange;
  const skipRef = useRef(skipRanges);
  skipRef.current = skipRanges;

  const controlledRate = playbackRate !== undefined;
  const displayRate = controlledRate ? playbackRate! : playbackSpeed;

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const el = videoRef.current;
    let t = el.currentTime;
    const r = rangeRef.current;
    if (r && r.end > r.start) {
      if (t < r.start) {
        el.currentTime = r.start;
        t = r.start;
      } else if (t >= r.end - 0.04) {
        el.pause();
        el.currentTime = r.end;
        t = r.end;
      }
    }
    // E3.4 — jump over removed footage. Applied after the trim clamp so a cut
    // that reaches the end of the kept range stops playback rather than seeking
    // past it. Scrubbing into a cut lands the same way, which is what makes the
    // preview agree with the export.
    const skips = skipRef.current;
    if (skips?.length) {
      const inside = skips.find(c => t >= c.startSec && t < c.endSec);
      if (inside) {
        const limit = r && r.end > r.start ? r.end : (isFinite(el.duration) ? el.duration : t);
        if (inside.endSec >= limit) {
          el.pause();
          el.currentTime = limit;
          t = limit;
        } else {
          el.currentTime = inside.endSec;
          t = inside.endSec;
        }
      }
    }

    setCurrentTime(t);
    emitPlayback();
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const el = videoRef.current;
      const d = el.duration;
      el.playbackRate = controlledRate ? playbackRate! : playbackSpeed;
      if (isFinite(d)) {
        setDuration(d);
      } else if (d === Infinity && !knownDurationSec) {
        // No length in the header. Seeking past the end makes the browser scan
        // for the real one — which means downloading the WHOLE file before the
        // transport can show anything but `--:--`. Ten seconds, measured, for a
        // forty-second recording.
        //
        // Only worth paying when nobody has told us the length. When the
        // recording carries a stored durationSec the answer is already in hand,
        // so the scan buys a number we have and costs the wait.
        el.currentTime = 1e10;
      }
      emitPlayback();
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      if (isFinite(d)) {
        setDuration(d);
        emitPlayback();
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || isProcessing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * (duration || 1);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    emitPlayback();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
      setIsMuted(value === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      if (onPlaybackRateChange) onPlaybackRateChange(speed);
      else setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu) setShowControls(false);
    }, 3000);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
      emitPlayback();
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  /** Only reload when src (or processing) changes — never on playbackRate or the video resets to t=0 on every speed change. */
  useEffect(() => {
    if (src && videoRef.current && !isProcessing) {
      const el = videoRef.current;
      el.load();
      setIsPlaying(false);
      const rate = controlledRate ? playbackRate! : playbackSpeed;
      queueMicrotask(() => {
        if (videoRef.current) videoRef.current.playbackRate = rate;
      });
      let pollCount = 0;
      const pollDuration = setInterval(() => {
        if (videoRef.current && isFinite(videoRef.current.duration)) {
          videoRef.current.playbackRate = rate;
          setDuration(videoRef.current.duration);
          emitPlayback();
          clearInterval(pollDuration);
        }
        pollCount++;
        if (pollCount > 10) clearInterval(pollDuration);
      }, 500);
      return () => clearInterval(pollDuration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: load() only on src/isProcessing
  }, [src, isProcessing]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || isProcessing) return;
    el.playbackRate = controlledRate ? playbackRate! : playbackSpeed;
  }, [playbackRate, playbackSpeed, controlledRate, isProcessing]);

  /** One frame at 30fps. The file's real rate is not exposed by HTMLVideoElement,
   * so this is the conventional approximation every web editor uses. */
  const FRAME = 1 / 30;

  const nudge = (delta: number) => {
    const el = videoRef.current;
    if (!el) return;
    const limit = isFinite(el.duration) ? el.duration : duration;
    el.currentTime = Math.max(0, Math.min(limit || 0, el.currentTime + delta));
    setCurrentTime(el.currentTime);
    emitPlayback();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Never steal typing from a comment box that happens to be focused.
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;

    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); nudge(5); break;
      case 'ArrowLeft': e.preventDefault(); nudge(-5); break;
      case '.': e.preventDefault(); nudge(FRAME); break;
      case ',': e.preventDefault(); nudge(-FRAME); break;
      case 'm': e.preventDefault(); toggleMute(); break;
      case 'f': e.preventDefault(); videoRef.current?.requestFullscreen?.(); break;
      default: break;
    }
  };

  return (
    <div
      data-testid="player-stage"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full aspect-video bg-[var(--sr-surface-carbon)] rounded-xl overflow-hidden shadow-2xl group select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sr-cyan)]"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !showSpeedMenu && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className={`w-full h-full object-contain transition-opacity duration-500 ${isProcessing ? 'opacity-30' : 'opacity-100'}`}
        style={zoomStyle}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onCanPlay={handleDurationChange}
        onSeeked={() => emitPlayback()}
        onClick={togglePlay}
        playsInline
        /* 'metadata', not 'auto'. With a stored duration there is no reason to
           pull the whole file down before the page is usable. */
        preload="metadata"
        muted={isMuted}
        onPlay={() => {
          setIsPlaying(true);
          emitPlayback(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          emitPlayback(false);
        }}
      />

      {!isPlaying && !isProcessing && src && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <button
            type="button"
            aria-label="Play video"
            className="size-20 bg-[var(--sr-cyan)]/90 backdrop-blur-sm flex items-center justify-center rounded-[2px] shadow-[0_0_30px_rgba(6,166,192,0.45)] transition-transform duration-300 hover:scale-110 pointer-events-auto"
            onClick={togglePlay}
          >
            <span className="material-symbols-outlined text-[var(--sr-text-primary-on-dark)] text-5xl">play_arrow</span>
          </button>
        </div>
      )}

      {showBranding && (
        <a
          href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--sr-scrim-dark)] hover:bg-[var(--sr-surface-well)] backdrop-blur-sm border border-[var(--sr-border-dark)] hover:border-[var(--sr-cyan)]/60 transition-all duration-300 group overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <img src="/logo.png" alt="SnapRec" className="size-5 rounded shrink-0" />
          <span className="text-[var(--sr-text-primary-on-dark)] text-sm font-bold group-hover:text-[var(--sr-text-primary-on-dark)] transition-colors shrink-0">SnapRec</span>
          <span className="max-w-0 group-hover:max-w-[200px] overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out text-xs text-[var(--sr-text-secondary-on-dark)] font-semibold">
            — Record your screen free →
          </span>
        </a>
      )}

      <div
        /* pointer-events-none on the container: it covers the whole picture,
           so leaving it interactive meant a click in the middle of the video
           hit the gradient instead of toggling playback. The controls inside
           re-enable it for themselves. */
        className={`absolute inset-0 bg-gradient-to-t from-[var(--sr-scrim-dark)] via-transparent to-transparent transition-opacity duration-300 z-30 flex flex-col justify-end p-4 pt-20 pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className="group/progress relative w-full h-1.5 bg-[var(--sr-border-dark-strong)] rounded-full cursor-pointer mb-5 transition-all hover:h-2 pointer-events-auto"
          onClick={handleSeek}
        >
          <div
            className="absolute h-full bg-[var(--sr-cyan)] rounded-full transition-all pointer-events-none"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 size-3.5 bg-[var(--sr-text-primary-on-dark)] rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none" />
          </div>

          {/* Comment anchors. Held back until the duration is known — without it
              every marker divides by a fallback of 1 and stacks at the far left. */}
          {duration > 0 && markers.map(marker => (
            <button
              key={marker.id}
              type="button"
              aria-label={`Comment at ${formatTime(marker.ms / 1000)}`}
              onClick={e => { e.stopPropagation(); onMarkerClick?.(marker.ms); }}
              className="absolute -top-1 w-0.5 h-3.5 p-0 border-none cursor-pointer z-10"
              style={{
                left: `${(marker.ms / 1000 / duration) * 100}%`,
                background: marker.needsReply
                  ? 'var(--sr-coral-mark)' : 'var(--sr-text-primary-on-dark)',
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <button type="button" aria-label="Back 10 seconds" onClick={() => skip(-10)} className="text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] transition-colors">
              <span className="material-symbols-outlined text-2xl">replay_10</span>
            </button>
            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlay}
              className="text-[var(--sr-text-primary-on-dark)] hover:scale-110 transition-transform flex items-center bg-[var(--sr-surface-panel-dark)] p-2 rounded-full backdrop-blur-md"
            >
              <span className="material-symbols-outlined text-3xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button type="button" aria-label="Forward 10 seconds" onClick={() => skip(10)} className="text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] transition-colors">
              <span className="material-symbols-outlined text-2xl">forward_10</span>
            </button>
            <span data-testid="player-time" className="text-[var(--sr-text-primary-on-dark)] text-sm font-semibold tabular-nums ml-2 bg-[var(--sr-scrim-dark)] px-3 py-1 rounded-full backdrop-blur-sm">
              {formatTime(currentTime)} <span className="text-[var(--sr-text-faint-on-dark)] mx-1">/</span>{' '}
              {duration > 0 ? formatTime(duration) : '--:--'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                aria-label="Playback speed"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] font-bold text-sm bg-[var(--sr-surface-panel-dark)] px-3 py-1.5 rounded-lg backdrop-blur-md transition-all border border-[var(--sr-border-dark-soft)] hover:border-[var(--sr-border-dark-strong)]"
              >
                {displayRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-[var(--sr-surface-panel-dark)]/95 backdrop-blur-xl border border-[var(--sr-border-dark)] rounded-xl overflow-hidden shadow-2xl min-w-[100px] py-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[var(--sr-cyan)]/20 ${displayRate === speed ? 'text-[var(--sr-cyan)] font-bold bg-[var(--sr-cyan)]/10' : 'text-[var(--sr-text-muted-on-dark)]'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 group/volume relative">
              <button type="button" aria-label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} className="text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] transition-colors relative z-10">
                <span className="material-symbols-outlined text-2xl">
                  {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                </span>
              </button>
              <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 h-8 flex items-center pr-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-1 accent-[var(--sr-cyan)] cursor-pointer opacity-0 group-hover/volume:opacity-100 transition-opacity duration-300"
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Full screen"
              onClick={() => videoRef.current?.requestFullscreen()}
              className="text-[var(--sr-text-secondary-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] hover:scale-110 transition-transform"
            >
              <span className="material-symbols-outlined text-2xl">fullscreen</span>
            </button>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--sr-scrim-dark)] backdrop-blur-md transition-all z-40">
          <div className="relative">
            <div className="size-20 border-4 border-[var(--sr-cyan)]/20 rounded-full animate-pulse shadow-[0_0_40px_rgba(6,166,192,0.2)]" />
            <div className="absolute inset-0 border-t-4 border-[var(--sr-cyan)] rounded-full animate-spin" />
          </div>
          <div className="flex flex-col items-center text-center px-6 mt-8">
            <h3 className="text-[var(--sr-text-primary-on-dark)] text-2xl font-black mb-3 tracking-tight">Polishing your video</h3>
            <p className="text-[var(--sr-text-muted-on-dark)] text-base max-w-[320px] leading-relaxed">
              Hang tight! We&apos;re making sure your recording looks perfect for everyone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

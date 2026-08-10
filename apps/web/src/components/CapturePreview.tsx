import { useCallback, useEffect, useRef } from 'react';
import type { Recording } from '../hooks/useRecordings';
import { capturePreviewUrl, toCaptureKind } from '../lib/captureAdapter';
import { drawCoverDownscaled, releaseScratch } from '../lib/downscale';

/** Fills a plate's media slot.
 *
 * A screenshot is a still image. A recording is a `<video>` painted through a
 * `<canvas>`: the element decodes, the canvas does the shrinking. That indirection
 * exists because captures come off a Retina display at around 3600×2338 and a
 * plate in the four-up grid is about 280 CSS pixels, and the browser's own video
 * scaler reduces in a single step. At that ratio one step aliases badly — real
 * measurement on a real recording turned "APN / Username / Password" into
 * "APH / Ushrlarw / Fmravwe". See downscale.ts for what replaces it.
 *
 * The same canvas covers both jobs: one draw when the poster frame is ready, and
 * a frame-by-frame loop while the pointer is over the card. Only one card is
 * hovered at a time, so only one loop ever runs.
 *
 * `poster` is still honoured, rendered behind the canvas, so the day something
 * starts writing `thumbnailUrl` the card has a still before the video has
 * decoded anything and the hover preview keeps working unchanged. */

const fill: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
};

/** The pointer leaves and the loop stops, but the scratch canvases would sit on
 * several megabytes until the next hover. Held briefly in case the pointer is
 * just crossing between two cards. */
const SCRATCH_IDLE_MS = 2000;

export interface CapturePreviewProps {
  recording: Recording;
  /** Called once the file reports how long it is. Recordings uploaded before
   * anything measured a duration have no stored value, and the element is then
   * the only place the length exists. */
  onDuration?: (seconds: number) => void;
}

export function CapturePreview({ recording, onDuration }: CapturePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** One frame, sized to the card in device pixels — anything less and the
   * halving is undone by the browser scaling a small canvas back up. */
  const paint = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return false;

    const box = canvas.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(box.width * ratio);
    const height = Math.round(box.height * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    return drawCoverDownscaled(video, video.videoWidth, video.videoHeight, canvas);
  }, []);

  const reportDuration = useCallback(() => {
    const seconds = videoRef.current?.duration;
    // A webm written by MediaRecorder often carries no duration in its header
    // and the element reports Infinity. Better to show no length than to
    // render "Infinity:NaN" on the card.
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      onDuration?.(seconds);
    }
  }, [onDuration]);

  /** The frame the card rests on. Fired by both `loadeddata` and `seeked`
   * because which one arrives first depends on whether the browser honoured the
   * `#t=` fragment, and the first frame is drawable either way. */
  const paintStill = useCallback(() => {
    // Layout may not have settled on the first event; the next frame it has.
    if (!paint()) requestAnimationFrame(() => paint());
  }, [paint]);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // Honoured the same way the rest of the product honours it — the frame
    // still shows, it just never animates.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (releaseRef.current) {
      clearTimeout(releaseRef.current);
      releaseRef.current = null;
    }
    // play() rejects if the pointer leaves before playback begins. That is an
    // ordinary race, not an error worth surfacing as an unhandled rejection.
    videoRef.current?.play().catch(() => {});

    stopLoop();
    const tick = () => {
      paint();
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [paint, stopLoop]);

  const stop = useCallback(() => {
    stopLoop();
    const video = videoRef.current;
    if (video) {
      video.pause();
      // Rewind so the card returns to its thumbnail rather than sitting on
      // whatever frame the pointer happened to leave on. The redraw waits for
      // the seek: painting now would just repaint the frame we are leaving.
      video.addEventListener('seeked', paintStill, { once: true });
      video.currentTime = 0;
    }
    releaseRef.current = setTimeout(() => {
      releaseRef.current = null;
      releaseScratch();
    }, SCRATCH_IDLE_MS);
  }, [paintStill, stopLoop]);

  useEffect(() => () => {
    stopLoop();
    if (releaseRef.current) clearTimeout(releaseRef.current);
  }, [stopLoop]);

  if (toCaptureKind(recording) !== 'recording') {
    const still = capturePreviewUrl(recording);
    return still
      ? <img data-testid="capture-image" src={still} alt="" style={fill} />
      : null;
  }

  return (
    <div
      data-testid="capture-preview"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseEnter={start}
      onMouseLeave={stop}
    >
      {recording.thumbnailUrl && (
        <img src={recording.thumbnailUrl} alt="" style={{ ...fill, position: 'absolute', inset: 0 }} />
      )}
      <video
        data-testid="capture-video"
        ref={videoRef}
        // The fragment asks the browser to land on a frame worth showing; the
        // canvas is what actually displays it.
        src={`${recording.fileUrl}#t=0.1`}
        preload="metadata"
        muted
        loop
        playsInline
        onLoadedMetadata={reportDuration}
        onLoadedData={paintStill}
        onSeeked={paintStill}
        // Present for decoding, never for display — the canvas above is the
        // picture. `hidden` would stop it decoding at all.
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <canvas
        data-testid="capture-canvas"
        ref={canvasRef}
        style={{ ...fill, position: 'absolute', inset: 0 }}
      />
    </div>
  );
}

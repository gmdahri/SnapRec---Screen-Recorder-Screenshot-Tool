import { getActiveZoom } from './zoomUtils';
import { outputDurationSec } from './cuts';
import type { ZoomKeyframe } from './types';

/**
 * Re-encodes [startSec, endSec] into a WebM blob in-memory (no network).
 * Requires same-origin or CORS-safe video so captureStream() is usable.
 */
export async function recordVideoSegmentToWebm(
  src: string,
  startSec: number,
  endSec: number,
  options?: {
    metadata?: any[];
    autoZoom?: boolean;
    zoomKeyframes?: ZoomKeyframe[];
    /** P7 E3.4 — source ranges to leave out. Must already be normalised
     * (sorted, non-overlapping) — see cuts.ts. */
    cuts?: { startSec: number; endSec: number }[];
    /** P7 E5.2 — linear multiplier applied to the audio while recording.
     * 1 leaves it untouched. */
    audioGain?: number;
    /** Progress for the export dialog. Reported from the render loop, which is
     * the only place that knows how far through the segment it is — this is a
     * real-time encode, so there is nothing else to measure. */
    onProgress?: (p: { pct: number; frame: number; frames: number }) => void;
  }
): Promise<Blob> {
  const lo = Math.max(0, startSec);
  const hi = Math.max(lo + 0.15, endSec);
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.src = src;

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video load timeout')), 60000);
    video.onloadedmetadata = () => {
      clearTimeout(t);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(t);
      reject(new Error('Could not load video (check connection / CORS).'));
    };
  });

  let mime = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

  video.currentTime = lo;
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error('Seek failed'));
  });

  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context failed');

  let stream: MediaStream;
  const keyframes = options?.zoomKeyframes ?? [];
  const useZoom = (options?.autoZoom && options.metadata && options.metadata.length > 0) || keyframes.length > 0;

  if (useZoom) {
    stream = canvas.captureStream(30);
  } else {
    stream = (video as any).captureStream();
  }

  if (!stream.getVideoTracks().length) {
    throw new Error('Cannot capture this video (try Export → stage a file, then Save).');
  }

  /* Audio.
   *
   * Two things are fixed here. A zoomed export takes its video from
   * `canvas.captureStream()`, which carries no audio at all — those exports
   * came out silent. And normalising (E5.2) needs the audio to pass through a
   * gain stage on the way to the recorder.
   *
   * The element is un-muted and routed into the graph instead: with a
   * MediaElementSource the audio goes only where it is connected, and this
   * graph never connects to ctx.destination, so nothing plays aloud while the
   * export runs. */
  const gainValue = options?.audioGain ?? 1;
  const needsGraph = useZoom || gainValue !== 1;
  let audioCtx: AudioContext | null = null;

  if (needsGraph) {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        audioCtx = new Ctor();
        video.muted = false;
        const source = audioCtx.createMediaElementSource(video);
        const gain = audioCtx.createGain();
        gain.gain.value = gainValue;
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(gain).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
    } catch {
      // A recording with no audio track, or a source the graph will not accept.
      // Falling through leaves the export silent rather than failing it — the
      // picture is the part nobody can recreate.
      audioCtx = null;
    }
  }

  // Only cuts that fall inside the segment being written matter; anything
  // outside it is already excluded by the trim.
  const skips = (options?.cuts ?? [])
    .filter((c) => c.endSec > lo && c.startSec < hi)
    .sort((a, b) => a.startSec - b.startSec);

  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  await video.play();
  recorder.start(250);

  await new Promise<void>((resolve, reject) => {
    const stopAt = Math.min(hi, video.duration || hi);
    // Frames rather than a bare percentage: the dialog names a frame count,
    // because "62%" on its own tells you nothing about how much is left.
    const outputSec = Math.max(0.001, outputDurationSec(lo, hi, skips));
    const totalFrames = Math.max(1, Math.round(outputSec * 30));
    let reported = -1;
    const tick = () => {
      if (options?.onProgress) {
        const doneSec = Math.max(0, outputDurationSec(lo, Math.min(video.currentTime, hi), skips));
        const pct = Math.min(100, Math.round((doneSec / outputSec) * 100));
        if (pct !== reported) {
          reported = pct;
          options.onProgress({
            pct,
            frame: Math.min(totalFrames, Math.round((pct / 100) * totalFrames)),
            frames: totalFrames,
          });
        }
      }
      if (video.currentTime >= stopAt - 0.04) {
        video.pause();
        try {
          recorder.stop();
        } catch {
          reject(new Error('Recorder stop failed'));
        }
        return;
      }

      // E3.4 — skip removed footage. The recorder keeps running across the
      // seek, so the cut lands as a jump rather than a gap. Checked before any
      // drawing so no frame from inside a cut reaches the canvas.
      const inCut = skips.find(
        (c) => video.currentTime >= c.startSec && video.currentTime < c.endSec,
      );
      if (inCut) {
        if (inCut.endSec >= stopAt - 0.04) {
          video.pause();
          try { recorder.stop(); } catch { reject(new Error('Recorder stop failed')); }
          return;
        }
        video.currentTime = inCut.endSec;
        requestAnimationFrame(tick);
        return;
      }

      const currentMs = video.currentTime * 1000;
      
      if (useZoom) {
        const zoom = getActiveZoom(
          currentMs,
          keyframes,
          options?.metadata ?? [],
          options?.autoZoom ?? false,
        );

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        if (zoom && zoom.scale > 1.0) {
          const originX = (zoom.originX / 100) * width;
          const originY = (zoom.originY / 100) * height;
          ctx.translate(originX, originY);
          ctx.scale(zoom.scale, zoom.scale);
          ctx.translate(-originX, -originY);
        }

        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();
      }

      // If !useZoom we don't need to manually draw; raw video captureStream is already pushing data.
      
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    recorder.onerror = () => reject(new Error('Recording failed'));
    recorder.onstop = () => resolve();
  });

  void audioCtx?.close().catch(() => {});

  const blob = new Blob(chunks, { type: 'video/webm' });
  if (blob.size < 256) {
    throw new Error('Recording produced no data; browser may block capture on this source.');
  }
  return blob;
}

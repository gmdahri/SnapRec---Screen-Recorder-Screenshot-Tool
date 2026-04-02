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
  const useZoom = options?.autoZoom && options.metadata && options.metadata.length > 0;
  
  if (useZoom) {
    stream = canvas.captureStream(30); // 30 FPS fallback, though drawing loop drives it
  } else {
    stream = (video as any).captureStream();
  }

  if (!stream.getVideoTracks().length) {
    throw new Error('Cannot capture this video (try Export → stage a file, then Save).');
  }

  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  await video.play();
  recorder.start(250);

  await new Promise<void>((resolve, reject) => {
    const stopAt = Math.min(hi, video.duration || hi);
    const tick = () => {
      if (video.currentTime >= stopAt - 0.04) {
        video.pause();
        try {
          recorder.stop();
        } catch {
          reject(new Error('Recorder stop failed'));
        }
        return;
      }

      const currentMs = video.currentTime * 1000;
      
      if (useZoom) {
        let currentWidth = width;
        let currentHeight = height;
        const meta = options.metadata!;
        
        for (const m of meta) {
          if (m.timestamp > currentMs) break;
          if (m.viewportWidth && m.viewportHeight) {
            currentWidth = m.viewportWidth;
            currentHeight = m.viewportHeight;
          }
        }

        let latestClick = null;
        for (let i = meta.length - 1; i >= 0; i--) {
          if (meta[i].timestamp <= currentMs && meta[i].type === 'mousedown') {
            latestClick = meta[i];
            break;
          }
        }

        const ZOOM_DURATION_MS = 3000;
        const TRANSITION_MS = 500;
        let scale = 1.0;
        let px = 0.5;
        let py = 0.5;

        if (latestClick) {
            const timeSince = currentMs - latestClick.timestamp;
            if (timeSince < ZOOM_DURATION_MS) {
                px = latestClick.x / currentWidth;
                py = latestClick.y / currentHeight;

                if (timeSince < TRANSITION_MS) {
                    // Zooming in (ease out)
                    const p = timeSince / TRANSITION_MS;
                    const ease = 1 - Math.pow(1 - p, 3);
                    scale = 1.0 + (0.3 * ease);
                } else if (timeSince > ZOOM_DURATION_MS - TRANSITION_MS) {
                    // Zooming out (ease in)
                    const timeOut = timeSince - (ZOOM_DURATION_MS - TRANSITION_MS);
                    const p = Math.max(0, Math.min(1, timeOut / TRANSITION_MS));
                    const ease = Math.pow(p, 3);
                    scale = 1.3 - (0.3 * ease);
                } else {
                    // Fully zoomed
                    scale = 1.3;
                }
            }
        }

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        if (scale > 1.0) {
           const clampedX = Math.max(0.15, Math.min(0.85, px));
           const clampedY = Math.max(0.15, Math.min(0.85, py));
           
           const originX = clampedX * width;
           const originY = clampedY * height;

           ctx.translate(originX, originY);
           ctx.scale(scale, scale);
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

  const blob = new Blob(chunks, { type: 'video/webm' });
  if (blob.size < 256) {
    throw new Error('Recording produced no data; browser may block capture on this source.');
  }
  return blob;
}

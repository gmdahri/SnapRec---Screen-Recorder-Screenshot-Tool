/**
 * Re-encodes [startSec, endSec] into a WebM blob in-memory (no network).
 * Requires same-origin or CORS-safe video so captureStream() is usable.
 */
export async function recordVideoSegmentToWebm(
  src: string,
  startSec: number,
  endSec: number,
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

  const stream = video.captureStream();
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

import { useEffect, useRef, useState } from 'react';
import { framePoints, type FramePoint } from '../lib/videoFrames';

/** Draws preview frames out of a recording, in the browser, on demand.
 *
 * A hidden video is seeked to each sample point and painted to a canvas. That
 * costs one seek per frame, so it fills the strip in as it goes rather than
 * blocking on the whole set.
 *
 * It waits for `enabled` before touching the network. This is a SECOND element
 * on the same URL as the player, and starting it eagerly meant two concurrent
 * downloads of the same file: the player sat on `--:--`, unable to get even its
 * metadata through, while the strip drew frames. The person is here to watch
 * the video; previews come after it can play.
 *
 * Nothing is uploaded or stored. The trade is that every viewer regenerates
 * them, which is fine for a dozen small canvases and means recordings made
 * before this existed get a strip too.
 *
 * The failure that matters is a **tainted canvas**: the media is served from R2
 * on a presigned URL, and unless that response carries CORS headers the browser
 * refuses `toDataURL` after drawing it. That throws a SecurityError, which is
 * caught — the strip then shows timecodes with no pictures, which still
 * navigates, rather than breaking the page. */

export interface VideoFrame extends FramePoint {
  /** A data URL, or null when this frame could not be drawn. */
  dataUrl: string | null;
}

export interface VideoFramesState {
  frames: VideoFrame[];
  generating: boolean;
  /** True when the canvas was tainted — pictures are impossible, not merely
   * slow, so the caller can stop waiting for them. */
  blocked: boolean;
}

const THUMB_WIDTH = 240;
const cache = new Map<string, VideoFrame[]>();

export function useVideoFrames(
  src: string | null | undefined,
  durationSec: number,
  /** Hold off until the player has what it needs. */
  enabled = true,
): VideoFramesState {
  const key = src ? `${src}|${Math.round(durationSec)}` : null;
  const [frames, setFrames] = useState<VideoFrame[]>(() => (key && cache.get(key)) || []);
  const [generating, setGenerating] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const wanted = useRef(key);

  useEffect(() => {
    wanted.current = key;
    if (!key || !src || !(durationSec > 0)) { setFrames([]); return; }
    if (!enabled) return;

    const cached = cache.get(key);
    if (cached) { setFrames(cached); return; }

    const points = framePoints(durationSec);
    if (points.length === 0) { setFrames([]); return; }

    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    // 'metadata', not 'auto': each seek range-requests the bytes it needs, so
    // the strip does not pull down the whole file behind the player's back.
    video.preload = 'metadata';
    video.src = src;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const seekTo = (sec: number) => new Promise<void>((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = sec;
      // A seek that never lands must not stall the whole strip.
      setTimeout(done, 3000);
    });

    (async () => {
      setGenerating(true);
      // Start with the placement so the strip lays out immediately and the
      // pictures fill in — the timecodes are the part that navigates.
      const built: VideoFrame[] = points.map(p => ({ ...p, dataUrl: null }));
      if (!cancelled) setFrames(built);

      try {
        await new Promise<void>((resolve, reject) => {
          if (video.readyState >= 1) return resolve();
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          video.addEventListener('error', () => reject(new Error('load failed')), { once: true });
          setTimeout(() => reject(new Error('load timeout')), 15000);
        });

        canvas.width = THUMB_WIDTH;
        canvas.height = Math.max(
          1,
          Math.round(THUMB_WIDTH * (video.videoHeight / (video.videoWidth || 1))),
        );

        for (let i = 0; i < built.length; i += 1) {
          if (cancelled || wanted.current !== key) return;
          await seekTo(built[i].sampleSec);
          if (!ctx) break;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          built[i] = { ...built[i], dataUrl: canvas.toDataURL('image/jpeg', 0.7) };
          if (!cancelled) setFrames([...built]);
        }
        cache.set(key, built);
      } catch (e) {
        // SecurityError means the canvas is tainted: pictures are impossible
        // for this source, not just slow.
        if (e instanceof DOMException && e.name === 'SecurityError') setBlocked(true);
        cache.set(key, built);
      } finally {
        video.removeAttribute('src');
        video.load();
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [key, src, durationSec, enabled]);

  return { frames, generating, blocked };
}

/** Exposed for tests; the cache is otherwise private to the tab. */
export function __clearFrameCache() {
  cache.clear();
}

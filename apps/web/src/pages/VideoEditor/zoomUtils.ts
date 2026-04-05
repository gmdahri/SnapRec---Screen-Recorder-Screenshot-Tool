import type { ZoomKeyframe } from './types';

export const ZOOM_DURATION_MS = 3000;
export const TRANSITION_MS = 500;

export interface ActiveZoom {
  scale: number;
  originX: number; // % clamped 15–85
  originY: number; // % clamped 15–85
}

/**
 * Unified zoom resolver used by both the rAF preview and the canvas export.
 * Custom keyframes take priority over auto-zoom metadata when they overlap.
 * Returns null when no zoom is active (scale === 1).
 */
export function getActiveZoom(
  currentMs: number,
  keyframes: ZoomKeyframe[],
  metadata: any[],
  autoZoom: boolean,
): ActiveZoom | null {
  // Custom keyframes — sorted ascending by timestamp, check each window
  for (let i = keyframes.length - 1; i >= 0; i--) {
    const kf = keyframes[i];
    if (kf.timestamp > currentMs) continue;
    const timeSince = currentMs - kf.timestamp;
    if (timeSince >= kf.duration) continue;

    const transMs = Math.min(TRANSITION_MS, kf.duration * 0.17);
    let scale: number;
    if (timeSince < transMs) {
      const ease = 1 - Math.pow(1 - timeSince / transMs, 3);
      scale = 1.0 + (kf.scale - 1.0) * ease;
    } else if (timeSince > kf.duration - transMs) {
      const p = Math.max(0, Math.min(1, (timeSince - (kf.duration - transMs)) / transMs));
      scale = kf.scale - (kf.scale - 1.0) * Math.pow(p, 3);
    } else {
      scale = kf.scale;
    }
    if (scale <= 1.001) return null;
    return {
      scale,
      originX: Math.max(15, Math.min(85, kf.x)),
      originY: Math.max(15, Math.min(85, kf.y)),
    };
  }

  // Auto-zoom from metadata
  if (!autoZoom || metadata.length === 0) return null;

  let currentWidth = 1920, currentHeight = 1080;
  const upperIdx = binarySearchLastBefore(metadata, currentMs);
  for (let i = upperIdx; i >= 0; i--) {
    if (metadata[i].viewportWidth && metadata[i].viewportHeight) {
      currentWidth = metadata[i].viewportWidth;
      currentHeight = metadata[i].viewportHeight;
      break;
    }
  }

  const latestClick = findLatestClickBefore(metadata, currentMs);
  if (!latestClick) return null;

  const timeSince = currentMs - latestClick.timestamp;
  if (timeSince >= ZOOM_DURATION_MS) return null;

  const scale = computeZoomScale(timeSince);
  if (scale <= 1.001) return null;

  return {
    scale,
    originX: Math.max(15, Math.min(85, (latestClick.x / currentWidth) * 100)),
    originY: Math.max(15, Math.min(85, (latestClick.y / currentHeight) * 100)),
  };
}

/**
 * Returns the index of the last element in arr whose timestamp <= currentMs.
 * Returns -1 if none. Assumes arr is sorted ascending by timestamp.
 */
export function binarySearchLastBefore(arr: any[], currentMs: number): number {
  let lo = 0, hi = arr.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].timestamp <= currentMs) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

/**
 * Returns the latest zoom-triggering event (mousedown or scrollstop) at or before currentMs, or null.
 */
export function findLatestClickBefore(arr: any[], currentMs: number): any | null {
  const upperIdx = binarySearchLastBefore(arr, currentMs);
  for (let i = upperIdx; i >= 0; i--) {
    if (arr[i].type === 'mousedown' || arr[i].type === 'scrollstop') return arr[i];
  }
  return null;
}

/**
 * Computes zoom scale for a given timeSince (ms after the click).
 * Cubic ease-out on zoom-in, cubic ease-in on zoom-out. Identical math
 * used in both the canvas export (localVideoTrim.ts) and live preview (EditorWorkspace.tsx).
 */
export function computeZoomScale(timeSince: number): number {
  if (timeSince < TRANSITION_MS) {
    const ease = 1 - Math.pow(1 - timeSince / TRANSITION_MS, 3);
    return 1.0 + 0.3 * ease;
  }
  if (timeSince > ZOOM_DURATION_MS - TRANSITION_MS) {
    const p = Math.max(0, Math.min(1, (timeSince - (ZOOM_DURATION_MS - TRANSITION_MS)) / TRANSITION_MS));
    return 1.3 - 0.3 * Math.pow(p, 3);
  }
  return 1.3;
}

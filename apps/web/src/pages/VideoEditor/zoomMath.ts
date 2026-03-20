import type { ZoomSegment } from './types';

export const ZOOM_SCALE_MIN = 1;
export const ZOOM_SCALE_MAX = 2.5;
export const ZOOM_DEFAULT_EASE = 0.35;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Normalize segment for safe math. */
export function sanitizeSegment(s: ZoomSegment, durationSec: number): ZoomSegment | null {
  const d = Math.max(0.01, durationSec);
  let start = Math.max(0, Number(s.startSec) || 0);
  let end = Math.max(start + 0.05, Number(s.endSec) || start + 0.05);
  end = Math.min(end, d);
  if (end <= start) return null;
  const peakScale = Math.min(ZOOM_SCALE_MAX, Math.max(ZOOM_SCALE_MIN, Number(s.peakScale) || 1));
  if (peakScale <= 1.001) return null;
  const focusX = Math.min(1, Math.max(0, Number(s.focusX) ?? 0.5));
  const focusY = Math.min(1, Math.max(0, Number(s.focusY) ?? 0.5));
  const easeIn = Math.min((end - start) / 2, Math.max(0.05, Number(s.easeInSec) ?? ZOOM_DEFAULT_EASE));
  const easeOut = Math.min((end - start) / 2, Math.max(0.05, Number(s.easeOutSec) ?? ZOOM_DEFAULT_EASE));
  return {
    ...s,
    startSec: start,
    endSec: end,
    peakScale,
    focusX,
    focusY,
    easeInSec: easeIn,
    easeOutSec: easeOut,
  };
}

export function sanitizeSegments(raw: unknown, durationSec: number): ZoomSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: ZoomSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const seg = item as ZoomSegment;
    const ok = sanitizeSegment(seg, durationSec);
    if (ok) out.push(ok);
  }
  return out;
}

/** Find the segment containing time t. Last match wins on overlap. */
function activeSegmentAt(t: number, segments: ZoomSegment[]): ZoomSegment | null {
  let hit: ZoomSegment | null = null;
  for (const s of segments) {
    if (t >= s.startSec && t <= s.endSec) hit = s;
  }
  return hit;
}

/** Find adjacent segment (the one right before the given segment). */
function prevSegment(seg: ZoomSegment, segments: ZoomSegment[]): ZoomSegment | null {
  let best: ZoomSegment | null = null;
  for (const s of segments) {
    if (s.id === seg.id) continue;
    if (s.endSec <= seg.startSec + 0.01) {
      if (!best || s.endSec > best.endSec) best = s;
    }
  }
  return best;
}

/**
 * Compute click-boost scale multiplier at time t.
 * Each boost is a smoothstep pulse: 0.15s ramp-up, 0.3s hold, 0.25s ramp-down.
 */
function clickBoostAt(t: number, boosts: { tSec: number; scale: number }[] | undefined): number {
  if (!boosts || boosts.length === 0) return 0;
  let maxBoost = 0;
  for (const b of boosts) {
    const rampUp = 0.15;
    const hold = 0.3;
    const rampDown = 0.25;
    const start = b.tSec - rampUp;
    const holdEnd = b.tSec + hold;
    const end = holdEnd + rampDown;
    if (t < start || t > end) continue;

    let strength: number;
    if (t < b.tSec) {
      strength = smoothstep((t - start) / rampUp);
    } else if (t <= holdEnd) {
      strength = 1;
    } else {
      strength = smoothstep((end - t) / rampDown);
    }
    const boost = (b.scale - 1) * strength;
    if (boost > maxBoost) maxBoost = boost;
  }
  return maxBoost;
}

export function scaleAtTime(t: number, segments: ZoomSegment[]): number {
  const seg = activeSegmentAt(t, segments);
  if (!seg) return 1;
  const {
    startSec: a,
    endSec: b,
    peakScale: peak,
    easeInSec: ei = ZOOM_DEFAULT_EASE,
    easeOutSec: eo = ZOOM_DEFAULT_EASE,
  } = seg;
  const easeIn = Math.min(ei, (b - a) / 2);
  const easeOut = Math.min(eo, (b - a) / 2);
  const midStart = a + easeIn;
  const midEnd = b - easeOut;

  let baseScale: number;
  if (t <= a) {
    baseScale = 1;
  } else if (t >= b) {
    baseScale = 1;
  } else if (t < midStart) {
    const u = easeIn > 0 ? (t - a) / easeIn : 1;
    baseScale = 1 + (peak - 1) * smoothstep(u);
  } else if (t > midEnd) {
    const u = easeOut > 0 ? (b - t) / easeOut : 1;
    baseScale = 1 + (peak - 1) * smoothstep(u);
  } else {
    baseScale = peak;
  }

  const boost = clickBoostAt(t, seg.clickBoosts);
  return Math.min(ZOOM_SCALE_MAX, baseScale + boost);
}

/**
 * Compute focus point at time t, interpolating between adjacent segments
 * for smooth panning (no hard jumps).
 */
export function focusAtTime(t: number, segments: ZoomSegment[]): { x: number; y: number } {
  const seg = activeSegmentAt(t, segments);
  if (!seg) return { x: 0.5, y: 0.5 };

  const {
    startSec: a,
    endSec: b,
    easeInSec: ei = ZOOM_DEFAULT_EASE,
    easeOutSec: eo = ZOOM_DEFAULT_EASE,
  } = seg;
  const easeIn = Math.min(ei, (b - a) / 2);
  const easeOut = Math.min(eo, (b - a) / 2);

  const fx = seg.focusX;
  const fy = seg.focusY;

  // During ease-in: blend from previous segment's focus (or center) to this segment's focus
  if (t < a + easeIn && easeIn > 0) {
    const u = smoothstep((t - a) / easeIn);
    const prev = prevSegment(seg, segments);
    const px = prev ? prev.focusX : 0.5;
    const py = prev ? prev.focusY : 0.5;
    return { x: lerp(px, fx, u), y: lerp(py, fy, u) };
  }

  // During ease-out: blend from this segment's focus toward center (next will take over)
  if (t > b - easeOut && easeOut > 0) {
    const u = smoothstep((b - t) / easeOut);
    return { x: lerp(0.5, fx, u), y: lerp(0.5, fy, u) };
  }

  return { x: fx, y: fy };
}

/**
 * Map viewport-normalized focus (0–1) to transform-origin % on a container
 * where video is shown with object-contain (letterboxing).
 * nx, ny = cursor position in the recorded viewport (extension meta).
 */
export function viewportFocusToContainerPercent(
  nx: number,
  ny: number,
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
  _metaVw?: number,
  _metaVh?: number,
): { xPct: number; yPct: number } {
  const px = Math.min(1, Math.max(0, nx));
  const py = Math.min(1, Math.max(0, ny));
  if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
    return { xPct: px * 100, yPct: py * 100 };
  }
  const u = px;
  const v = py;
  const aspect = videoW / videoH;
  const displayW = Math.min(containerW, containerH * aspect);
  const displayH = Math.min(containerH, containerW / aspect);
  const ox = (containerW - displayW) / 2;
  const oy = (containerH - displayH) / 2;
  const originX = ox + u * displayW;
  const originY = oy + v * displayH;
  return {
    xPct: (originX / containerW) * 100,
    yPct: (originY / containerH) * 100,
  };
}

/** True if [start,end] overlaps any existing segment (for UI add validation). */
export function overlapsSegment(
  start: number,
  end: number,
  segments: ZoomSegment[],
  exceptId?: string,
): boolean {
  for (const s of segments) {
    if (exceptId && s.id === exceptId) continue;
    if (start < s.endSec && end > s.startSec) return true;
  }
  return false;
}

import type { ZoomSegment } from './types';

export type RecordingMeta = {
  pointerSamples?: { t: number; x: number; y: number }[];
  clicks?: { t: number; x: number; y: number }[];
  keyEvents?: { t: number; key: string }[];
  focusSessions?: { startSec: number; endSec: number; x: number; y: number }[];
  typingSessions?: { startSec: number; endSec: number; x: number; y: number }[];
  vw?: number;
  vh?: number;
  /** Capture device pixel ratio for zoom coordinate correctness across HiDPI/retina. */
  devicePixelRatio?: number;
  /** Scroll at flush time; future: per-event scroll for scroll-spanning segments. */
  scrollX?: number;
  scrollY?: number;
};

const SEGMENT_SCALE = 1.4;
/** Cursorful-style: clicks within this window form a burst; 2+ clicks = one sustained zoom; 1 click = short zoom so timeline is never empty. */
const CLICK_CLUSTER_WINDOW_SEC = 3;
const MIN_CLICKS_TO_ZOOM = 1;
const CLICK_BURST_LEAD_SEC = 0.15;
const CLICK_BURST_TRAIL_SEC = 0.6;
const EASE_IN = 0.22;
const EASE_OUT = 0.28;
/** Long focus/typing spans become several timeline blocks so zoom isn’t a single bar. */
const MAX_FOCUS_CHUNK_SEC = 2.35;
/** Option C: ignore focus-only sessions shorter than this to reduce spurious zoom (e.g. from scroll/tab). */
const MIN_FOCUS_ONLY_SEC = 0.3;
/** Time windows along the pointer trail (Option B only; not used in Option A). */
const POINTER_WINDOW_SEC = 1.65;
const POINTER_STEP_SEC = 1.45;
const POINTER_MIN_SAMPLES = 4;

type Interval = { a: number; b: number; x: number; y: number };

/** Break one long interval into chunks (same focus) for clearer timeline + motion. */
function splitLongIntervals(ivs: Interval[], maxLen: number, durationSec: number): Interval[] {
  const out: Interval[] = [];
  const d = durationSec;
  for (const iv of ivs) {
    let a = Math.max(0, Math.min(iv.a, d));
    const end = Math.max(a, Math.min(iv.b, d));
    if (end <= a + 0.02) continue;
    while (end - a > maxLen + 0.03) {
      out.push({ a, b: a + maxLen, x: iv.x, y: iv.y });
      a += maxLen;
    }
    if (end > a + 0.02) out.push({ a, b: end, x: iv.x, y: iv.y });
  }
  return out;
}

/** Short zoom segments where the cursor actually moved (even without input focus). */
function pointerWindowIntervals(
  samples: { t: number; x: number; y: number }[],
  durationSec: number,
): Interval[] {
  if (samples.length < POINTER_MIN_SAMPLES || durationSec <= 0) return [];
  const sorted = [...samples]
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((p, q) => p.t - q.t);
  if (sorted.length < POINTER_MIN_SAMPLES) return [];
  const out: Interval[] = [];
  const d = durationSec;
  for (let wStart = 0; wStart < d; wStart += POINTER_STEP_SEC) {
    const wEnd = Math.min(d, wStart + POINTER_WINDOW_SEC);
    const inWin: typeof sorted = [];
    for (const p of sorted) {
      if (p.t < wStart) continue;
      if (p.t > wEnd) break;
      inWin.push(p);
    }
    if (inWin.length < POINTER_MIN_SAMPLES) continue;
    let sx = 0;
    let sy = 0;
    for (const p of inWin) {
      sx += Math.min(1, Math.max(0, p.x));
      sy += Math.min(1, Math.max(0, p.y));
    }
    const n = inWin.length;
    const hold = Math.min(1.45, POINTER_WINDOW_SEC * 0.92);
    const segEnd = Math.min(d, wStart + hold);
    if (segEnd <= wStart + 0.08) continue;
    out.push({
      a: wStart,
      b: segEnd,
      x: sx / n,
      y: sy / n,
    });
  }
  return out;
}

function mergeIntervals(raw: Interval[], durationSec: number): Interval[] {
  if (raw.length === 0) return [];
  const d = durationSec;
  const sorted = raw
    .map((r) => ({
      a: Math.max(0, Math.min(r.a, d)),
      b: Math.max(0, Math.min(r.b, d)),
      x: r.x,
      y: r.y,
    }))
    .filter((r) => r.b > r.a + 0.02)
    .sort((p, q) => p.a - q.a);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last || cur.a > last.b + 0.05) {
      out.push({ ...cur });
    } else {
      last.b = Math.max(last.b, cur.b);
      last.x = (last.x + cur.x) / 2;
      last.y = (last.y + cur.y) / 2;
    }
  }
  return out;
}

/** Cursorful-style: group clicks into bursts (consecutive clicks within CLICK_CLUSTER_WINDOW_SEC); return one interval per burst with >= MIN_CLICKS_TO_ZOOM; then merge overlapping. */
function clickBurstIntervals(
  clicks: { t: number; x: number; y: number }[],
  durationSec: number,
): Interval[] {
  if (clicks.length < MIN_CLICKS_TO_ZOOM || durationSec <= 0) return [];
  const sorted = [...clicks]
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.x) && Number.isFinite(c.y))
    .sort((a, b) => a.t - b.t);
  if (sorted.length < MIN_CLICKS_TO_ZOOM) return [];
  const d = durationSec;
  const bursts: { t: number; x: number; y: number }[][] = [];
  let current: { t: number; x: number; y: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    if (sorted[i].t - prev.t <= CLICK_CLUSTER_WINDOW_SEC) {
      current.push(sorted[i]);
    } else {
      if (current.length >= MIN_CLICKS_TO_ZOOM) bursts.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= MIN_CLICKS_TO_ZOOM) bursts.push(current);
  const raw: Interval[] = bursts.map((burst) => {
    const first = burst[0];
    const last = burst[burst.length - 1];
    let sx = 0;
    let sy = 0;
    for (const c of burst) {
      sx += Math.min(1, Math.max(0, c.x));
      sy += Math.min(1, Math.max(0, c.y));
    }
    const n = burst.length;
    return {
      a: Math.max(0, first.t - CLICK_BURST_LEAD_SEC),
      b: Math.min(d, last.t + CLICK_BURST_TRAIL_SEC),
      x: sx / n,
      y: sy / n,
    };
  });
  return mergeIntervals(raw, d);
}

/** Returns true if [a, b] overlaps [c, d] (intersects). */
function overlaps(a: number, b: number, c: number, d: number): boolean {
  return a < d && b > c;
}

/**
 * Zoom from: (1) focus + typing — typing sessions take priority; focus-only
 * intervals that overlap a typing interval are dropped. Merged then split into
 * ~2.3s chunks. (2) Clicks — Cursorful-style: only when 2+ clicks in ~3s (burst);
 * one sustained zoom per burst, merged if overlapping. Pointer-only movement not used (Option A).
 */
export function autoZoomSegmentsFromMeta(
  meta: RecordingMeta | null | undefined,
  durationSec: number,
): ZoomSegment[] {
  if (!meta || durationSec <= 0) return [];
  const d = durationSec;
  const typingIv: Interval[] = [];
  for (const s of meta.typingSessions || []) {
    const a = Number(s.startSec);
    const b = Number(s.endSec);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      typingIv.push({
        a,
        b,
        x: Math.min(1, Math.max(0, s.x)),
        y: Math.min(1, Math.max(0, s.y)),
      });
    }
  }
  const focusOnlyIv: Interval[] = [];
  for (const s of meta.focusSessions || []) {
    const a = Number(s.startSec);
    const b = Number(s.endSec);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    const iv = {
      a,
      b,
      x: Math.min(1, Math.max(0, s.x)),
      y: Math.min(1, Math.max(0, s.y)),
    };
    const overlapsTyping = typingIv.some((t) => overlaps(iv.a, iv.b, t.a, t.b));
    if (!overlapsTyping && iv.b - iv.a >= MIN_FOCUS_ONLY_SEC) focusOnlyIv.push(iv);
  }
  const intervals = [...typingIv, ...focusOnlyIv];
  const merged = mergeIntervals(intervals, d);
  const focusChunks = splitLongIntervals(merged, MAX_FOCUS_CHUNK_SEC, d);
  // Option A: do not add pointer-only segments — zoom only on clicks and focus/typing
  // pointerWindowIntervals(meta.pointerSamples || [], d) is intentionally not used here

  let idCounter = 0;
  const nextId = () => `auto-${Date.now()}-${idCounter++}`;
  const segments: ZoomSegment[] = [];

  const pushInterval = (iv: Interval, easeInScale = 1, easeOutScale = 1) => {
    const len = iv.b - iv.a;
    const ei = Math.min(EASE_IN * easeInScale, len / 3);
    const eo = Math.min(EASE_OUT * easeOutScale, len / 3);
    segments.push({
      id: nextId(),
      startSec: iv.a,
      endSec: iv.b,
      peakScale: SEGMENT_SCALE,
      focusX: iv.x,
      focusY: iv.y,
      easeInSec: Math.max(0.06, ei),
      easeOutSec: Math.max(0.06, eo),
    });
  };

  for (const iv of focusChunks) {
    pushInterval(iv);
  }

  const clickIv = clickBurstIntervals(meta.clicks || [], d);
  for (const iv of clickIv) {
    if (iv.b > iv.a + 0.02) pushInterval(iv, 0.9, 0.9);
  }

  segments.sort((p, q) => p.startSec - q.startSec);
  return segments;
}

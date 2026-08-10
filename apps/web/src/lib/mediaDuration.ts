/** Measuring how long a recording runs, at the moment it is uploaded.
 *
 * The server stores `durationSec` as a whole number of seconds and rejects
 * anything outside 0–86400. A webm produced by MediaRecorder frequently ships
 * with no duration in its header, and a `<video>` then reports `Infinity`, so
 * every value has to be treated as suspect before it is sent: a create request
 * that fails validation would lose the capture entirely, which is far worse
 * than a card that shows no length. */

/** Matches the DTO's @Max. A day is longer than any screen recording, so a
 * value beyond it is a broken measurement rather than a long meeting. */
export const MAX_DURATION_SEC = 86_400;

/** Whole seconds the server will accept, or undefined when the number cannot
 * be trusted. Undefined means "unknown", which the column stores as null. */
export function normalizeDurationSec(seconds: number | undefined | null): number | undefined {
  if (typeof seconds !== 'number') return undefined;
  if (!Number.isFinite(seconds)) return undefined;
  if (seconds <= 0) return undefined;

  const whole = Math.round(seconds);
  if (whole < 1 || whole > MAX_DURATION_SEC) return undefined;
  return whole;
}

/** The element API this needs, so a test can supply one without a media stack. */
export interface DurationSource {
  duration: number;
  currentTime: number;
  preload: string;
  src: string;
  /** 0 until metadata loads, and 0 forever for audio-only sources. */
  videoWidth?: number;
  videoHeight?: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface MeasureOptions {
  createElement?: () => DurationSource;
  /** Give up rather than hold an upload open forever on a file that never
   * reports its length. */
  timeoutMs?: number;
}

/** Reads a recording's length from the blob about to be uploaded.
 *
 * When the header carries no duration the element says Infinity; seeking far
 * past the end forces the browser to scan for the real end and emit
 * `durationchange`. That costs a pass over a local blob, which is acceptable
 * once at upload — it is the reason this is not done for every card in a grid. */
export interface MediaMeta {
  durationSec?: number;
  widthPx?: number;
  heightPx?: number;
}

/** Duration and frame size in one pass.
 *
 * Both come from the same `loadedmetadata`, so measuring them separately would
 * mean loading the file twice. Dimensions are reported even when the duration
 * cannot be determined — a webm with no duration in its header still knows how
 * big its frames are. */
export async function measureMedia(
  blob: Blob,
  options: MeasureOptions = {},
): Promise<MediaMeta> {
  // The element is created here and handed down, so the dimensions can be read
  // off the same one that measured the duration. An earlier version stashed
  // them in a module-level variable, which two concurrent measurements would
  // have clobbered.
  const el = options.createElement?.()
    ?? (document.createElement('video') as unknown as DurationSource);

  const durationSec = await measureDurationSec(blob, options, el);
  const w = el.videoWidth;
  const h = el.videoHeight;
  return {
    durationSec,
    widthPx: w && w > 0 ? w : undefined,
    heightPx: h && h > 0 ? h : undefined,
  };
}

export async function measureDurationSec(
  blob: Blob,
  { createElement, timeoutMs = 8000 }: MeasureOptions = {},
  reuse?: DurationSource | null,
): Promise<number | undefined> {
  const url = URL.createObjectURL(blob);
  const el = reuse
    ?? (createElement
      ? createElement()
      : (document.createElement('video') as unknown as DurationSource));

  try {
    return await new Promise<number | undefined>((resolve) => {
      let settled = false;
      const finish = (value: number | undefined) => {
        if (settled) return;
        settled = true;
        el.removeEventListener('loadedmetadata', onMetadata);
        el.removeEventListener('durationchange', onDurationChange);
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => finish(undefined), timeoutMs);

      function onDurationChange() {
        const known = normalizeDurationSec(el.duration);
        if (known !== undefined) finish(known);
      }

      function onMetadata() {
        const known = normalizeDurationSec(el.duration);
        if (known !== undefined) return finish(known);
        // Unknown length: provoke the scan, then wait for durationchange.
        el.currentTime = 1e101;
      }

      el.addEventListener('loadedmetadata', onMetadata);
      el.addEventListener('durationchange', onDurationChange);
      el.preload = 'metadata';
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

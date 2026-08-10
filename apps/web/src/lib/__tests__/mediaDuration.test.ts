import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  MAX_DURATION_SEC, measureDurationSec, normalizeDurationSec, type DurationSource,
  measureMedia,
} from '../mediaDuration';

describe('a duration the server will accept', () => {
  it('rounds to whole seconds', () => {
    expect(normalizeDurationSec(87.4)).toBe(87);
    expect(normalizeDurationSec(87.6)).toBe(88);
  });

  /** A webm without a duration in its header reads as Infinity. Sending that
   * fails @IsInt and the create request 400s — losing the capture over a
   * number the card could simply have omitted. */
  it('refuses a length that is not a real number', () => {
    expect(normalizeDurationSec(Infinity)).toBeUndefined();
    expect(normalizeDurationSec(NaN)).toBeUndefined();
    expect(normalizeDurationSec(undefined)).toBeUndefined();
    expect(normalizeDurationSec(null)).toBeUndefined();
  });

  it('refuses a length of zero or less', () => {
    expect(normalizeDurationSec(0)).toBeUndefined();
    expect(normalizeDurationSec(-5)).toBeUndefined();
    expect(normalizeDurationSec(0.4)).toBeUndefined();
  });

  /** The DTO caps at 86400. Sending more would be rejected wholesale, so an
   * implausible measurement is dropped here instead. */
  it('refuses a length beyond what the server allows', () => {
    expect(normalizeDurationSec(MAX_DURATION_SEC)).toBe(MAX_DURATION_SEC);
    expect(normalizeDurationSec(MAX_DURATION_SEC + 1)).toBeUndefined();
  });
});

/** A stand-in for <video>: jsdom has no media pipeline, so the events a real
 * element would fire are driven by hand. */
function fakeVideo(script: { onSrc?: (el: FakeVideo) => void } = {}) {
  const listeners: Record<string, Array<() => void>> = {};
  const el = {
    duration: NaN,
    currentTime: 0,
    preload: '',
    _src: '',
    get src() { return this._src; },
    set src(value: string) { this._src = value; script.onSrc?.(el); },
    addEventListener(type: string, fn: () => void) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners[type] = (listeners[type] ?? []).filter(l => l !== fn);
    },
    emit(type: string) { [...(listeners[type] ?? [])].forEach(fn => fn()); },
  };
  return el as unknown as FakeVideo;
}
type FakeVideo = DurationSource & { emit(type: string): void };

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
});

describe('measuring the blob about to be uploaded', () => {
  const blob = new Blob(['x']);

  it('reads a length the file reports directly', async () => {
    const el = fakeVideo({ onSrc: v => { v.duration = 12.2; v.emit('loadedmetadata'); } });
    await expect(measureDurationSec(blob, { createElement: () => el })).resolves.toBe(12);
  });

  /** The webm case: metadata says Infinity, so the element is seeked past the
   * end to make the browser find the real one. */
  it('provokes a scan when the header carries no length', async () => {
    const el = fakeVideo({
      onSrc: v => {
        v.duration = Infinity;
        v.emit('loadedmetadata');
        expect(v.currentTime).toBeGreaterThan(1e9);   // it seeked
        v.duration = 31.5;
        v.emit('durationchange');
      },
    });
    await expect(measureDurationSec(blob, { createElement: () => el })).resolves.toBe(32);
  });

  it('gives up rather than holding the upload open forever', async () => {
    vi.useFakeTimers();
    const el = fakeVideo();  // never fires anything
    const pending = measureDurationSec(blob, { createElement: () => el, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('releases the object URL whatever happens', async () => {
    const el = fakeVideo({ onSrc: v => { v.duration = 5; v.emit('loadedmetadata'); } });
    await measureDurationSec(blob, { createElement: () => el });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});

describe('measuring dimensions alongside duration', () => {
  const blob = new Blob(['x']);

  it('reports both from one pass over the file', async () => {
    const el = fakeVideo({ onSrc: v => {
      (v as unknown as { videoWidth: number }).videoWidth = 1920;
      (v as unknown as { videoHeight: number }).videoHeight = 1080;
      v.duration = 12; v.emit('loadedmetadata');
    } });
    await expect(measureMedia(blob, { createElement: () => el }))
      .resolves.toEqual({ durationSec: 12, widthPx: 1920, heightPx: 1080 });
  });

  /** A webm with no duration in its header still knows its frame size. */
  it('still reports dimensions when the duration is unknowable', async () => {
    const el = fakeVideo({ onSrc: v => {
      (v as unknown as { videoWidth: number }).videoWidth = 1280;
      (v as unknown as { videoHeight: number }).videoHeight = 720;
      v.duration = Infinity; v.emit('loadedmetadata');
    } });
    vi.useFakeTimers();
    const pending = measureMedia(blob, { createElement: () => el, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(80);
    const out = await pending;
    vi.useRealTimers();
    expect(out).toEqual({ durationSec: undefined, widthPx: 1280, heightPx: 720 });
  });

  /** An audio-only source reports 0×0; omitting is better than storing zeros. */
  it('omits dimensions a source does not have', async () => {
    const el = fakeVideo({ onSrc: v => { v.duration = 5; v.emit('loadedmetadata'); } });
    const out = await measureMedia(blob, { createElement: () => el });
    expect(out.widthPx).toBeUndefined();
    expect(out.heightPx).toBeUndefined();
  });
});

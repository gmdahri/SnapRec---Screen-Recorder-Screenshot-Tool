import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWaveform, __clearWaveformCache } from '../useWaveform';

const decode = vi.fn();
const close = vi.fn(() => Promise.resolve());

class FakeAudioContext {
  decodeAudioData = decode;
  close = close;
}

const audible = {
  duration: 30,
  numberOfChannels: 1,
  getChannelData: () => Float32Array.from({ length: 2000 }, (_, i) => Math.sin(i / 4) * 0.4),
};

beforeEach(() => {
  __clearWaveformCache();
  decode.mockReset().mockResolvedValue(audible);
  close.mockClear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })));
});
afterEach(() => vi.unstubAllGlobals());

describe('extracting a clip’s waveform', () => {
  it('decodes once and returns bars', async () => {
    const { result } = renderHook(() => useWaveform('https://r2/clip.webm', 32));
    await waitFor(() => expect(result.current.peaks.length).toBe(32));
    expect(Math.max(...result.current.peaks)).toBeCloseTo(1, 5);
  });

  /** Decoding is the expensive part and the audio behind a URL does not change,
   * so switching tools must not pay for it again. */
  it('does not decode the same clip twice', async () => {
    const first = renderHook(() => useWaveform('https://r2/same.webm', 16));
    await waitFor(() => expect(first.result.current.peaks.length).toBe(16));
    expect(decode).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useWaveform('https://r2/same.webm', 16));
    await waitFor(() => expect(second.result.current.peaks.length).toBe(16));
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('releases the audio context it opened', async () => {
    const { result } = renderHook(() => useWaveform('https://r2/clip.webm', 8));
    await waitFor(() => expect(result.current.peaks.length).toBe(8));
    expect(close).toHaveBeenCalled();
  });

  it('has nothing to draw before a clip is chosen', () => {
    const { result } = renderHook(() => useWaveform(null));
    expect(result.current.peaks).toEqual([]);
  });
});

describe('when the audio cannot be read', () => {
  /** An expired presigned URL is the likely cause in this product; the lane
   * must degrade rather than take the editor down with it. */
  it('leaves the lane empty when the file cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 403 })));
    const { result } = renderHook(() => useWaveform('https://r2/expired.webm'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.peaks).toEqual([]);
  });

  it('leaves the lane empty when the browser will not decode the codec', async () => {
    decode.mockRejectedValue(new Error('unsupported'));
    const { result } = renderHook(() => useWaveform('https://r2/odd.webm'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.peaks).toEqual([]);
  });

  it('does not retry a clip it already failed to decode', async () => {
    decode.mockRejectedValue(new Error('unsupported'));
    const first = renderHook(() => useWaveform('https://r2/bad.webm'));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    renderHook(() => useWaveform('https://r2/bad.webm'));
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
  });
});

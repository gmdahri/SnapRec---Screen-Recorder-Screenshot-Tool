import { describe, expect, it } from 'vitest';
import {
  MAX_DECODE_SEC, computePeaks, normalizePeaks, peaksFromBuffer, type DecodeLike,
} from '../waveform';

const sine = (n: number, amp = 1) =>
  Float32Array.from({ length: n }, (_, i) => Math.sin(i / 5) * amp);

describe('reducing samples to bars', () => {
  it('returns one bar per bucket', () => {
    expect(computePeaks(sine(10_000), 50)).toHaveLength(50);
  });

  it('takes the loudest moment in each bucket, not the average', () => {
    // One spike in an otherwise silent bucket must still show.
    const samples = new Float32Array(100);
    samples[42] = 0.9;
    const peaks = computePeaks(samples, 10);
    expect(peaks[4]).toBeCloseTo(0.9, 5);
  });

  it('reads a negative swing as loud — amplitude is absolute', () => {
    const samples = new Float32Array([0, -0.8, 0]);
    expect(computePeaks(samples, 1)[0]).toBeCloseTo(0.8, 5);
  });

  /** More buckets than samples would leave empty ones, which draw as silence
   * in the middle of audible speech. */
  it('never makes more bars than there are samples', () => {
    expect(computePeaks(sine(20), 400)).toHaveLength(20);
  });

  it('has nothing to draw for an empty track', () => {
    expect(computePeaks(new Float32Array(0), 50)).toEqual([]);
    expect(computePeaks(sine(100), 0)).toEqual([]);
  });
});

describe('scaling the bars for display', () => {
  it('lifts the loudest bar to full height', () => {
    const scaled = normalizePeaks([0.05, 0.02, 0.01]);
    expect(scaled[0]).toBeCloseTo(1, 10);
    expect(scaled[1]).toBeCloseTo(0.4, 10);
    expect(scaled[2]).toBeCloseTo(0.2, 10);
  });

  /** Silence amplified by its own maximum would be division by zero, or worse,
   * a lane of full-height bars over a track with nothing in it. */
  it('leaves silence silent instead of amplifying it into noise', () => {
    expect(normalizePeaks([0, 0, 0])).toEqual([0, 0, 0]);
    expect(normalizePeaks([])).toEqual([]);
  });
});

describe('from a decoded buffer', () => {
  const buffer = (over: Partial<DecodeLike> = {}): DecodeLike => ({
    duration: 60,
    numberOfChannels: 1,
    getChannelData: () => sine(10_000, 0.3),
    ...over,
  });

  it('produces a normalised lane', () => {
    const peaks = peaksFromBuffer(buffer(), 40);
    expect(peaks).toHaveLength(40);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);
  });

  /** A screen recording made with the microphone off decodes to zero channels.
   * An empty lane is the honest result; a fabricated one is not. */
  it('draws nothing for a recording with no audio track', () => {
    expect(peaksFromBuffer(buffer({ numberOfChannels: 0 }))).toEqual([]);
  });

  /** Decoding holds the whole PCM buffer in memory — roughly 10MB a minute.
   * An hour-long recording is ~600MB for a decorative strip. */
  it('refuses to decode a recording long enough to exhaust the tab', () => {
    expect(peaksFromBuffer(buffer({ duration: MAX_DECODE_SEC + 1 }))).toEqual([]);
    expect(peaksFromBuffer(buffer({ duration: MAX_DECODE_SEC - 1 })).length).toBeGreaterThan(0);
  });
});

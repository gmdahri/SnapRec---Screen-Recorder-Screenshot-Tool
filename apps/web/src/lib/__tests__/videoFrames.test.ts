import { describe, expect, it } from 'vitest';
import { MAX_FRAMES, frameCount, framePoints } from '../videoFrames';

describe('how many frames a recording gets', () => {
  /** The rule you asked for: under ten seconds still gets a picture. */
  it('gives a very short clip exactly one', () => {
    expect(frameCount(4)).toBe(1);
    expect(frameCount(9.9)).toBe(1);
  });

  it('scales with length', () => {
    expect(frameCount(42)).toBe(3);
    expect(frameCount(182)).toBe(10);
  });

  /** Each frame is a seek and a decode; past this it is a contact sheet. */
  it('stops at the ceiling for a long recording', () => {
    expect(frameCount(3600)).toBe(MAX_FRAMES);
  });

  it('has none to place without a known length', () => {
    expect(frameCount(0)).toBe(0);
    expect(framePoints(0)).toEqual([]);
  });
});

describe('where the frames sit', () => {
  it('spreads them evenly across the recording', () => {
    const points = framePoints(180);
    expect(points).toHaveLength(9);
    expect(points[0].startSec).toBe(0);
    expect(points[1].startSec).toBeCloseTo(20, 5);
    expect(points[8].startSec).toBeCloseTo(160, 5);
  });

  /** The exact boundary is often a cut or a fade, which samples as black. */
  it('samples just inside each section rather than on its edge', () => {
    const [first] = framePoints(180);
    expect(first.sampleSec).toBeGreaterThan(first.startSec);
    expect(first.sampleSec).toBeLessThanOrEqual(first.startSec + 0.5);
  });

  it('never samples past the end of the recording', () => {
    for (const p of framePoints(4)) {
      expect(p.sampleSec).toBeLessThan(4);
    }
  });

  it('gives a short clip one frame at the start', () => {
    const points = framePoints(6);
    expect(points).toHaveLength(1);
    expect(points[0].startSec).toBe(0);
  });
});

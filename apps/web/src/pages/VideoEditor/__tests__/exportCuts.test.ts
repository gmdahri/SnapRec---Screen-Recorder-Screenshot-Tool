import { describe, expect, it } from 'vitest';
import { normalizeCuts, outputDurationSec } from '../cuts';

/** P7 E3.4 — the arithmetic the export depends on.
 *
 * The recorder itself needs a real <video> and MediaRecorder, so it is not
 * exercised here. What is pinned is the part that silently corrupts an edit if
 * it is wrong: how long the baked clip should be, and what must happen to the
 * cut list once the footage is baked. */

describe('what the baked clip should measure', () => {
  const cuts = normalizeCuts([
    { id: 'a', startSec: 30, endSec: 40 },
    { id: 'b', startSec: 90, endSec: 95 },
  ], 180);

  it('is the trim less the cuts inside it', () => {
    // 0:18–1:59 is 101s; 15s of cuts fall inside it.
    expect(outputDurationSec(18, 119, cuts)).toBe(86);
  });

  it('ignores a cut the trim already excludes', () => {
    // Trim starts after the first cut, so only the second counts.
    expect(outputDurationSec(50, 119, cuts)).toBe(64);
  });

  it('counts only the overlapping part of a straddling cut', () => {
    // Trim 35–119 is 84s. The first cut contributes only its 35–40 overlap,
    // the second its full 5s, leaving 74.
    expect(outputDurationSec(35, 119, cuts)).toBe(74);
  });

  it('is just the trim when nothing is cut', () => {
    expect(outputDurationSec(18, 119, [])).toBe(101);
  });
});

describe('why the cut list must be cleared after baking', () => {
  /** The baked clip starts at zero and already has the footage removed. Reusing
   * the old source-time cuts against it would remove a second, unrelated
   * stretch on every Apply. This asserts the sizes differ enough that the bug
   * would be obvious rather than subtle. */
  it('source-time cuts point at different footage in the baked clip', () => {
    const cuts = normalizeCuts([{ id: 'a', startSec: 90, endSec: 95 }], 180);
    const bakedLength = outputDurationSec(18, 119, cuts);       // 96s clip
    // Re-applied to the baked clip, the same range now removes real footage.
    const wronglyReapplied = outputDurationSec(0, bakedLength, cuts);
    expect(wronglyReapplied).toBeLessThan(bakedLength);
    expect(bakedLength - wronglyReapplied).toBe(5);
  });
});

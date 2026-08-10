import { describe, expect, it } from 'vitest';
import {
  cutAt, cutSecondsWithin, isFullyCut, nextPlayableSec, normalizeCuts, outputDurationSec,
  type Cut,
} from '../cuts';

const cut = (id: string, startSec: number, endSec: number): Cut => ({ id, startSec, endSec });

describe('normalising a cut list', () => {
  it('sorts by where they start', () => {
    const out = normalizeCuts([cut('b', 40, 45), cut('a', 10, 12)], 100);
    expect(out.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('merges cuts that overlap', () => {
    const out = normalizeCuts([cut('a', 10, 20), cut('b', 15, 30)], 100);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startSec: 10, endSec: 30 });
  });

  /** Two cuts a millisecond apart leave nothing playable between them and
   * render as two unclickable chips. */
  it('merges cuts closer together than a frame', () => {
    const out = normalizeCuts([cut('a', 10, 20), cut('b', 20.01, 30)], 100);
    expect(out).toHaveLength(1);
  });

  it('keeps cuts with real footage between them apart', () => {
    expect(normalizeCuts([cut('a', 10, 20), cut('b', 25, 30)], 100)).toHaveLength(2);
  });

  /** Keeping the earlier id means anything referencing the original cut is
   * not silently pointed at a newly invented one. */
  it('keeps the earlier id when merging', () => {
    expect(normalizeCuts([cut('first', 10, 20), cut('second', 12, 30)], 100)[0].id).toBe('first');
  });

  it('clamps a cut that runs past the end of the clip', () => {
    expect(normalizeCuts([cut('a', 90, 500)], 100)[0].endSec).toBe(100);
  });

  it('drops a cut that removes nothing', () => {
    expect(normalizeCuts([cut('a', 10, 10)], 100)).toEqual([]);
    expect(normalizeCuts([cut('a', 30, 20)], 100)).toEqual([]);
  });

  it('has nothing to normalise against an unknown length', () => {
    expect(normalizeCuts([cut('a', 10, 20)], 0)).toEqual([]);
  });

  /** Remove-silences can propose a great many at once. */
  it('handles a large proposal without collapsing it', () => {
    const many = Array.from({ length: 200 }, (_, i) => cut(`c${i}`, i * 2, i * 2 + 0.5));
    expect(normalizeCuts(many, 500)).toHaveLength(200);
  });
});

describe('how long the output runs', () => {
  const cuts = normalizeCuts([cut('a', 20, 30), cut('b', 60, 70)], 180);

  it('is the trim less what the cuts remove', () => {
    expect(outputDurationSec(0, 180, cuts)).toBe(160);
  });

  /** A cut outside the kept range is already excluded by the trim; counting it
   * again would make the output look shorter than it plays. */
  it('ignores cuts outside the kept range', () => {
    expect(outputDurationSec(100, 180, cuts)).toBe(80);
  });

  it('counts only the part of a cut that falls inside the trim', () => {
    expect(cutSecondsWithin(cuts, 25, 180)).toBe(15);
  });

  it('never reports a negative length', () => {
    expect(outputDurationSec(50, 40, cuts)).toBe(0);
  });

  it('is the whole trim when nothing is cut', () => {
    expect(outputDurationSec(10, 100, [])).toBe(90);
  });
});

describe('playing across a cut', () => {
  const cuts = normalizeCuts([cut('a', 20, 30)], 180);

  it('leaves a moment outside any cut alone', () => {
    expect(nextPlayableSec(15, cuts, 180)).toBe(15);
  });

  it('jumps to the far side when playback enters a cut', () => {
    expect(nextPlayableSec(22, cuts, 180)).toBe(30);
  });

  it('treats the start of a cut as inside it and the end as outside', () => {
    expect(cutAt(20, cuts)).not.toBeNull();
    expect(cutAt(30, cuts)).toBeNull();
  });

  /** The signal to stop, not to seek — otherwise playback would seek past the
   * end of the kept range and sit there. */
  it('says to stop when the cut runs to the end of the kept range', () => {
    expect(nextPlayableSec(22, normalizeCuts([cut('a', 20, 180)], 180), 180)).toBeNull();
  });
});

describe('effects swallowed by a cut', () => {
  const cuts = normalizeCuts([cut('a', 60, 90)], 180);

  it('spots a zoom that sits entirely inside removed footage', () => {
    expect(isFullyCut(65, 80, cuts)).toBe(true);
  });

  it('leaves a zoom that only partly overlaps alone', () => {
    expect(isFullyCut(55, 80, cuts)).toBe(false);
    expect(isFullyCut(80, 120, cuts)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  columnPositions, leadersVisible, pinScreenPosition, renumber, type ShareComment,
} from '../anchors';

const at = (id: string, ms: number, index: number): ShareComment => ({
  id, author: 'A', body: 'b', createdAt: '', index,
  anchor: { kind: 'timecode', ms }, needsReply: false, resolved: false,
});

describe('timecode anchoring (C1)', () => {
  it('places each comment column at its timecode position under the media', () => {
    const cols = columnPositions([at('a', 11_000, 1), at('b', 28_000, 2)], 47_000);
    expect(cols[0].leftPct).toBeCloseTo(23.4, 1);
    expect(cols[1].leftPct).toBeCloseTo(59.6, 1);
  });

  it('never places a column outside the track', () => {
    const cols = columnPositions([at('a', 0, 1), at('b', 47_000, 2)], 47_000);
    expect(cols[0].leftPct).toBe(0);
    expect(cols[1].leftPct).toBe(100);
  });

  it('assigns distinct column indices so overlapping timecodes do not stack', () => {
    const cols = columnPositions(
      [at('a', 10_000, 1), at('b', 10_400, 2), at('c', 40_000, 3)], 47_000);
    expect(cols[0].columnIndex).not.toBe(cols[1].columnIndex);
    expect(cols[2].columnIndex).toBe(0);
  });

  it('survives a zero-duration media without dividing by zero', () => {
    expect(columnPositions([at('a', 0, 1)], 0)[0].leftPct).toBe(0);
  });
});

describe('point anchoring (C2)', () => {
  it('converts a normalised anchor to a pixel position', () => {
    expect(pinScreenPosition({ kind: 'point', x: 0.25, y: 0.5 }, { w: 800, h: 600 }))
      .toEqual({ left: 200, top: 300 });
  });

  it('draws leaders only when the margin can hold them', () => {
    expect(leadersVisible(300)).toBe(true);
    expect(leadersVisible(299)).toBe(false);
    expect(leadersVisible(0)).toBe(false);
  });
});

describe('numbering', () => {
  it('renumbers in document order so numbers survive a deletion', () => {
    const list = [at('a', 5, 1), at('b', 10, 2), at('c', 15, 3)];
    expect(renumber(list.filter(c => c.id !== 'b')).map(c => c.index)).toEqual([1, 2]);
  });

  it('keeps numbers stable for unchanged comments', () => {
    expect(renumber([at('a', 5, 1), at('b', 10, 2)]).map(c => c.index)).toEqual([1, 2]);
  });
});

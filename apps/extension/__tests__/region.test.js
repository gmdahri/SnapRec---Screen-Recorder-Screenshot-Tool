import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clampRect, formatDimensions, magnifierCorner, nudge } from '../content/region.core.js';

const viewport = { w: 1440, h: 900 };

describe('region selection (P1)', () => {
  it('keeps the selection inside the viewport', () => {
    expect(clampRect({ x: -20, y: -10, w: 200, h: 100 }, viewport))
      .toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(clampRect({ x: 1400, y: 880, w: 200, h: 100 }, viewport))
      .toEqual({ x: 1240, y: 800, w: 200, h: 100 });
  });

  it('shrinks a selection larger than the viewport rather than overflowing', () => {
    expect(clampRect({ x: 0, y: 0, w: 2000, h: 1200 }, viewport))
      .toEqual({ x: 0, y: 0, w: 1440, h: 900 });
  });

  it('nudges by one pixel with an arrow key', () => {
    expect(nudge({ x: 10, y: 10, w: 100, h: 50 }, 'ArrowRight', false).x).toBe(11);
    expect(nudge({ x: 10, y: 10, w: 100, h: 50 }, 'ArrowUp', false).y).toBe(9);
  });

  it('nudges by ten with shift held', () => {
    expect(nudge({ x: 10, y: 10, w: 100, h: 50 }, 'ArrowRight', true).x).toBe(20);
  });

  it('ignores a key that is not an arrow', () => {
    const rect = { x: 10, y: 10, w: 100, h: 50 };
    expect(nudge(rect, 'Enter', false)).toEqual(rect);
  });

  it('formats dimensions with a true multiplication sign', () => {
    expect(formatDimensions({ x: 0, y: 0, w: 1180, h: 640 })).toBe('1180 × 640');
  });

  it('follows the corner being dragged', () => {
    const rect = { x: 0, y: 0, w: 100, h: 100 };
    expect(magnifierCorner(rect, { x: 90, y: 90 })).toBe('bottom-right');
    expect(magnifierCorner(rect, { x: 10, y: 10 })).toBe('top-left');
  });

  it('the classic-script copy has not drifted from the tested module', () => {
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecRegion[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../content/region.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../content/region.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});

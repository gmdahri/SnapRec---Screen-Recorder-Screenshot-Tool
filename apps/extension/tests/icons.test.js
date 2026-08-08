import { describe, expect, it } from 'vitest';
import { ICONS, icon } from '../popup/icons.js';

const REQUIRED = [
  'videoCamera', 'camera', 'setting', 'chrome', 'desktop', 'expand',
  'audio', 'sound', 'user', 'right', 'left', 'close', 'check', 'minus',
  'link', 'copy', 'download', 'scissor', 'cloudUpload', 'folder', 'delete',
  'pause', 'play', 'reload', 'warning',
];

describe('inlined icons', () => {
  it('covers every icon the popup uses', () => {
    for (const name of REQUIRED) expect(ICONS).toHaveProperty(name);
  });

  it('renders a self-contained svg with no remote reference', () => {
    const svg = icon('camera', 14);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="14"');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(svg).toContain('currentColor');
  });

  it('marks icons decorative — every control carries its own label', () => {
    expect(icon('camera', 14)).toContain('aria-hidden="true"');
  });

  it('throws on an unknown name rather than rendering an empty box', () => {
    expect(() => icon('nope')).toThrow(/unknown icon: nope/);
  });
});

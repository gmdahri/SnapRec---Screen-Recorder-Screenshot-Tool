import { describe, expect, it } from 'vitest';
import { icons } from '../icons';

describe('icons', () => {
  it('exports every icon the plate surfaces use', () => {
    expect(Object.keys(icons).length).toBeGreaterThanOrEqual(30);
  });

  it.each(Object.entries(icons))('%s resolves to a real iconify icon', (_name, icon) => {
    expect(icon).toBeDefined();
    expect(typeof (icon as { body: string }).body).toBe('string');
    expect((icon as { body: string }).body.length).toBeGreaterThan(0);
  });
});

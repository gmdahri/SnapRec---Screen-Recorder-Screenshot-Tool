import { describe, expect, it } from 'vitest';
import { IMAGE_BINDINGS, TOOLS } from '../tools';
import { VIDEO_BINDINGS } from '../../VideoEditor/bindings';
import { createRegistry } from '../../../lib/shortcuts';

describe('the image editor tool table (I1)', () => {
  it('offers exactly ten tools in the prototype order', () => {
    expect(TOOLS.map(t => t.key)).toEqual([
      'select', 'crop', 'draw', 'arrow', 'line', 'shape', 'text', 'mark', 'blur', 'step',
    ]);
  });

  it('binds each tool to the single key the prototype names', () => {
    expect(Object.fromEntries(TOOLS.map(t => [t.key, t.shortcut]))).toEqual({
      select: 'V', crop: 'C', draw: 'D', arrow: 'A', line: 'L',
      shape: 'R', text: 'T', mark: 'H', blur: 'B', step: 'S',
    });
  });

  it('binds no key twice', () => {
    expect(() => createRegistry(IMAGE_BINDINGS)).not.toThrow();
  });
});

describe('the video editor bindings (V1)', () => {
  it('binds no key twice', () => {
    expect(() => createRegistry(VIDEO_BINDINGS)).not.toThrow();
  });

  it('covers every shortcut the prototype names', () => {
    expect(VIDEO_BINDINGS.map(b => b.key)).toEqual(expect.arrayContaining([
      ' ', 'arrowleft', 'arrowright', ',', '.', 's', 'z', 'i', 'o',
      'mod+z', 'mod+shift+z', 'escape',
    ]));
  });

  it('keeps the two editors in separate scopes, so S can mean two things', () => {
    expect(() => createRegistry([...VIDEO_BINDINGS, ...IMAGE_BINDINGS])).not.toThrow();
  });
});

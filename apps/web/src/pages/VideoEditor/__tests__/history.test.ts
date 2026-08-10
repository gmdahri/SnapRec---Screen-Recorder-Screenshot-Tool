import { describe, expect, it } from 'vitest';
import {
  canRedo, canUndo, createHistory, record, redo, resetHistory, undo,
} from '../history';

const start = () => createHistory({ trim: 0 });

describe('recording states', () => {
  it('starts with nothing to undo', () => {
    const h = start();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('remembers what came before', () => {
    const h = record(start(), { trim: 10 });
    expect(h.present).toEqual({ trim: 10 });
    expect(canUndo(h)).toBe(true);
  });

  /** A drag can fire on every frame; recording an identical state each time
   * would fill the stack with nothing. */
  it('ignores a state identical to the present', () => {
    const h = start();
    expect(record(h, h.present)).toBe(h);
  });
});

describe('stepping back and forward', () => {
  it('returns to the previous state and back again', () => {
    let h = record(record(start(), { trim: 10 }), { trim: 20 });
    h = undo(h);
    expect(h.present).toEqual({ trim: 10 });
    h = redo(h);
    expect(h.present).toEqual({ trim: 20 });
  });

  it('walks all the way back to the beginning', () => {
    let h = record(record(start(), { trim: 10 }), { trim: 20 });
    h = undo(undo(h));
    expect(h.present).toEqual({ trim: 0 });
    expect(canUndo(h)).toBe(false);
  });

  it('does nothing at either end', () => {
    const h = start();
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  /** Once you act from a rewound point, the branch you had gone down no longer
   * follows from where you are. */
  it('drops the redo branch once you act from a rewound point', () => {
    let h = record(record(start(), { trim: 10 }), { trim: 20 });
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = record(h, { trim: 99 });
    expect(canRedo(h)).toBe(false);
    expect(h.present).toEqual({ trim: 99 });
  });
});

describe('bounding the stack', () => {
  /** A drag produces a snapshot per frame; without a cap a long session holds
   * every intermediate state of every drag. */
  it('keeps only the most recent states', () => {
    let h = createHistory({ n: 0 }, 3);
    for (let n = 1; n <= 10; n += 1) h = record(h, { n });
    expect(h.past).toHaveLength(3);
    expect(h.past[0]).toEqual({ n: 7 });
    expect(h.present).toEqual({ n: 10 });
  });

  it('still steps back through what it kept', () => {
    let h = createHistory({ n: 0 }, 2);
    for (let n = 1; n <= 5; n += 1) h = record(h, { n });
    h = undo(undo(h));
    expect(h.present).toEqual({ n: 3 });
    expect(canUndo(h)).toBe(false);
  });
});

describe('forgetting', () => {
  /** After publishing, the states behind the present describe footage viewers
   * can no longer be returned to. */
  it('clears both directions', () => {
    let h = record(record(start(), { trim: 10 }), { trim: 20 });
    h = undo(h);
    h = resetHistory(h);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toEqual({ trim: 10 });
  });

  it('can be given a fresh present, as when a project loads', () => {
    const h = resetHistory(record(start(), { trim: 10 }), { trim: 77 });
    expect(h.present).toEqual({ trim: 77 });
    expect(canUndo(h)).toBe(false);
  });
});

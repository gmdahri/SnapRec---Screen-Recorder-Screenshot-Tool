import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTypewriterCycle } from '../useTypewriterCycle';

const PHRASES = ['Keep SnapRec free', 'Support us'];

const TYPE_MS = 45;
const ERASE_MS = 25;
const HOLD_MS = 1400;

/** Advance fake timers inside act() so React flushes the resulting state. */
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Elapsed time from a phrase's typing being scheduled to the tick that hands
 * over to the next phrase.
 *
 * A phrase of length L takes L typing ticks to fill, then one more no-op tick
 * that notices it is full and starts the hold — hence `L + 1`. Erasing is not
 * symmetric: L erase ticks bring it back to empty, and the handover tick is
 * itself the next tick after that, so erasing contributes only `L`. */
const cycle = (len: number) => TYPE_MS * (len + 1) + HOLD_MS + ERASE_MS * len;

describe('useTypewriterCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts empty and types the first phrase one character at a time', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('K');

    advance(TYPE_MS);
    expect(result.current).toBe('Ke');

    advance(TYPE_MS * 3);
    expect(result.current).toBe('Keep ');
  });

  it('reaches the full first phrase and holds it', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(TYPE_MS * PHRASES[0].length);
    expect(result.current).toBe('Keep SnapRec free');

    // Through the no-op tick that starts the hold, and most of the hold itself.
    advance(TYPE_MS + HOLD_MS - 1);
    expect(result.current).toBe('Keep SnapRec free');
  });

  it('erases the first phrase after the hold, faster than it typed', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    // Typing ticks, the tick that starts the hold, then the hold.
    advance(TYPE_MS * (PHRASES[0].length + 1) + HOLD_MS);
    expect(result.current).toBe('Keep SnapRec fre');

    advance(ERASE_MS);
    expect(result.current).toBe('Keep SnapRec fr');
  });

  it('types the second phrase once the first is fully erased', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(cycle(PHRASES[0].length));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('S');

    advance(TYPE_MS * (PHRASES[1].length - 1));
    expect(result.current).toBe('Support us');
  });

  it('loops back to the first phrase after the last one erases', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(cycle(PHRASES[0].length) + cycle(PHRASES[1].length));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('K');
  });

  it('stops its timers on unmount', () => {
    const { unmount } = renderHook(() => useTypewriterCycle(PHRASES));
    advance(TYPE_MS * 3);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('when the viewer asks for less motion', () => {
    it('shows the short phrase statically and never starts a timer', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue(
        { matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList,
      );

      const { result } = renderHook(() => useTypewriterCycle(PHRASES));
      expect(result.current).toBe('Support us');
      expect(vi.getTimerCount()).toBe(0);

      advance(TYPE_MS * 40);
      expect(result.current).toBe('Support us');
    });
  });
});

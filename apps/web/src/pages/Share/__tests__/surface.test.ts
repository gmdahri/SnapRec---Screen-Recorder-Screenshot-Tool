import { describe, expect, it } from 'vitest';
import { chooseViewerSurface } from '../surface';

describe('which chrome /v renders', () => {
  it('offers to generate a link for a capture still on the device', () => {
    expect(chooseViewerSurface({ isFresh: true, hasRecording: false, kind: 'video' }))
      .toBe('fresh');
  });

  it('shows the viewing surface for a recording opened from a link', () => {
    expect(chooseViewerSurface({ isFresh: false, hasRecording: true, kind: 'video' }))
      .toBe('shared');
  });

  /** Generating a link navigates to /v/{id} with the blob from the capture still
   * in memory. Treating that as "not really shared" showed the pre-redesign
   * layout on the first view of every new share, and only a reload — which drops
   * the blob — revealed the real page. */
  it('shows the viewing surface even while the captured file is still in memory', () => {
    expect(chooseViewerSurface({
      isFresh: false, hasRecording: true, kind: 'video', hasLocalBlob: true,
    })).toBe('shared');
  });

  it('makes no distinction the local blob could account for', () => {
    for (const isFresh of [true, false]) {
      for (const hasRecording of [true, false]) {
        const withBlob = chooseViewerSurface({ isFresh, hasRecording, kind: 'video', hasLocalBlob: true });
        const without = chooseViewerSurface({ isFresh, hasRecording, kind: 'video', hasLocalBlob: false });
        expect(withBlob).toBe(without);
      }
    }
  });

  /** The redesign covers video. A screenshot has its own surface and is not it. */
  it('leaves a fresh screenshot on the old layout', () => {
    expect(chooseViewerSurface({ isFresh: true, hasRecording: false, kind: 'screenshot' }))
      .toBe('legacy');
  });

  it('falls back when there is nothing to show', () => {
    expect(chooseViewerSurface({ isFresh: false, hasRecording: false, kind: null }))
      .toBe('legacy');
    expect(chooseViewerSurface({ isFresh: true, hasRecording: false, kind: null }))
      .toBe('legacy');
  });
});

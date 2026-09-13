import { describe, expect, it } from 'vitest';
import { DEFAULT_DELAY, VALID_DELAYS, nextDelay, delayLabel } from '../popup/captureDelay.core.js';

/** The timer that makes menus and hover states capturable at all.
 *
 * Without it an open dropdown cannot be screenshotted: clicking the extension
 * closes the menu, and the capture records the page without it. The delay is
 * the whole feature, so the cycle has to be predictable and the label has to
 * say what will happen rather than what is set. */

describe('cycling the delay', () => {
  it('starts at no delay', () => {
    expect(DEFAULT_DELAY).toBe(0);
  });

  it('offers only delays the capture path honours', () => {
    expect(VALID_DELAYS).toEqual([0, 3, 5]);
  });

  it('advances through the offered values', () => {
    expect(nextDelay(0)).toBe(3);
    expect(nextDelay(3)).toBe(5);
  });

  it('wraps back to none rather than dead-ending', () => {
    expect(nextDelay(5)).toBe(0);
  });

  it('treats an unknown stored value as none', () => {
    // A value written by an older or newer build must not leave the chip
    // showing a delay the capture path will not honour.
    expect(nextDelay(11)).toBe(3);
    expect(delayLabel(11)).toBe('No delay');
  });
});

describe('what the chip says', () => {
  it('names the absence of a delay in words', () => {
    expect(delayLabel(0)).toBe('No delay');
  });

  it('names the wait, not the setting', () => {
    expect(delayLabel(3)).toBe('3s delay');
    expect(delayLabel(5)).toBe('5s delay');
  });
});

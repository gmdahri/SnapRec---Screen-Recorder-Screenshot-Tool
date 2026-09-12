import { GUEST_TTL_MS, expiresAtForUpload } from '../expiry';

/** The rule that bounds the cost of anonymous use.
 *
 * An unclaimed guest recording is deleted an hour after its upload finishes.
 * Measured from completion rather than from when recording started, so a
 * fifty-minute recording still gets its full hour rather than ten minutes. */

const now = new Date('2026-09-13T12:00:00.000Z');

describe('expiresAtForUpload', () => {
  it('gives a guest recording one hour', () => {
    expect(expiresAtForUpload(false, now)?.toISOString()).toBe('2026-09-13T13:00:00.000Z');
  });

  it('gives a signed-in recording no expiry at all', () => {
    expect(expiresAtForUpload(true, now)).toBeNull();
  });

  it('measures from the moment it is called, which is upload completion', () => {
    const later = new Date('2026-09-13T12:50:00.000Z');
    expect(expiresAtForUpload(false, later)?.toISOString()).toBe('2026-09-13T13:50:00.000Z');
  });

  it('uses a one-hour window', () => {
    expect(GUEST_TTL_MS).toBe(60 * 60 * 1000);
  });
});

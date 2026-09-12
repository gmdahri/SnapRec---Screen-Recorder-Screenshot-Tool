import { describe, expect, it } from 'vitest';
import { describeExpiry } from '../lib/expiryCountdown';

/** The only warning a guest gets before their recording is deleted.
 *
 * A bare timer is not enough when the consequence is permanent and the remedy
 * is one click, so this produces words. The recording cannot be shared or
 * downloaded until the user signs in, and signing in claims it — so this text
 * is the whole of the guest's notice. */

const now = new Date('2026-09-13T12:00:00.000Z');

describe('describeExpiry', () => {
  it('says nothing for a claimed recording', () => {
    expect(describeExpiry(null, now)).toBeNull();
    expect(describeExpiry(undefined, now)).toBeNull();
  });

  it('counts down in whole minutes', () => {
    expect(describeExpiry('2026-09-13T12:42:00.000Z', now))
      .toEqual({ expired: false, text: 'This recording deletes in 42 minutes unless you sign in' });
  });

  it('uses the singular at one minute', () => {
    expect(describeExpiry('2026-09-13T12:01:00.000Z', now)!.text)
      .toBe('This recording deletes in 1 minute unless you sign in');
  });

  it('says less than a minute rather than rounding to zero', () => {
    expect(describeExpiry('2026-09-13T12:00:30.000Z', now)!.text)
      .toBe('This recording deletes in less than a minute unless you sign in');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(describeExpiry('2026-09-13T11:59:00.000Z', now))
      .toEqual({ expired: true, text: 'This recording has expired' });
  });

  it('ignores a malformed date rather than showing nonsense', () => {
    expect(describeExpiry('not-a-date', now)).toBeNull();
  });
});

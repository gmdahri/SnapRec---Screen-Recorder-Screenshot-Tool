import { sweepConfigWarning } from '../sweep-config';

/** The misconfiguration that hides itself.
 *
 * The sweep endpoint answers 404 when SWEEP_SECRET is unset — deliberately, so
 * it does not advertise its own existence. But that means a Cloud Scheduler job
 * wired against a service missing the variable fails silently forever: the
 * scheduler records failures nobody reads, guest recordings never expire, and
 * storage grows with nothing anywhere saying why. One line at boot is what
 * turns that into something you can see. */

describe('sweepConfigWarning', () => {
  it('says nothing when the secret is configured', () => {
    expect(sweepConfigWarning({ SWEEP_SECRET: 'abc123' })).toBeNull();
  });

  it('warns when the variable is missing entirely', () => {
    expect(sweepConfigWarning({})).toMatch(/SWEEP_SECRET/);
  });

  it('warns when it is set but empty, which reads as configured', () => {
    expect(sweepConfigWarning({ SWEEP_SECRET: '' })).toMatch(/SWEEP_SECRET/);
    expect(sweepConfigWarning({ SWEEP_SECRET: '   ' })).toMatch(/SWEEP_SECRET/);
  });

  it('names the consequence, not just the variable', () => {
    // "SWEEP_SECRET is not set" tells you nothing about what breaks.
    expect(sweepConfigWarning({})).toMatch(/never expire|will not expire/i);
  });
});

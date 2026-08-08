import { describe, expect, it } from 'vitest';
import { buildAuthRedirect, decodeReturnTo, encodeReturnTo } from '../returnTo';

describe('returnTo', () => {
  it('round-trips a same-origin path', () => {
    expect(decodeReturnTo(encodeReturnTo('/v/abc123?t=28'))).toBe('/v/abc123?t=28');
  });

  it('rejects an absolute URL to another origin', () => {
    expect(decodeReturnTo(encodeReturnTo('https://evil.example/steal'))).toBe('/home');
  });

  it('rejects a protocol-relative URL', () => {
    expect(decodeReturnTo(encodeReturnTo('//evil.example/steal'))).toBe('/home');
  });

  it('rejects a javascript: URL', () => {
    expect(decodeReturnTo(encodeReturnTo('javascript:alert(1)'))).toBe('/home');
  });

  it('rejects a backslash-smuggled origin', () => {
    expect(decodeReturnTo(encodeReturnTo('/\\evil.example'))).toBe('/home');
  });

  it('rejects a tab or newline smuggled into the scheme', () => {
    expect(decodeReturnTo(encodeReturnTo('/\tjavascript:alert(1)'))).toBe('/home');
    expect(decodeReturnTo(encodeReturnTo('/\nhttps://evil.example'))).toBe('/home');
  });

  it('rejects a control character even with no colon present', () => {
    // Isolates the control-character guard: the cases above would also be
    // caught by the colon check, so on their own they prove nothing about it.
    // Browsers strip these before parsing, so the string the guard sees and
    // the string the browser navigates to would otherwise differ.
    expect(decodeReturnTo(encodeReturnTo('/library\t/evil'))).toBe('/home');
    expect(decodeReturnTo(encodeReturnTo('/library\u007F'))).toBe('/home');
  });

  it('falls back to /home when nothing was passed', () => {
    expect(decodeReturnTo(null)).toBe('/home');
    expect(decodeReturnTo('')).toBe('/home');
  });

  it('survives a malformed encoding rather than throwing', () => {
    expect(decodeReturnTo('%')).toBe('/home');
  });

  it('carries the destination through the auth redirect', () => {
    expect(buildAuthRedirect('https://www.snaprecorder.org', '/v/abc'))
      .toBe('https://www.snaprecorder.org/auth/callback?returnTo=%2Fv%2Fabc');
  });
});

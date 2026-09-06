import { describe, expect, it } from 'vitest';
import { COMPARISON, COMPARISON_CHECKED, DEMO_STEPS, FAQS, MOBILE_COMPARISON } from '../copy';

describe('landing copy', () => {
  it('has exactly three demo steps', () => {
    expect(DEMO_STEPS.map(s => s.label)).toEqual(['Capture', 'Refine', 'Share']);
  });

  it('carries only the verified comparison rows', () => {
    expect(COMPARISON).toHaveLength(3);
  });

  it('dates the competitor claims, so a stale table is visible', () => {
    expect(COMPARISON_CHECKED).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  });

  it('uses the verified Screencastify recording duration', () => {
    expect(COMPARISON.find(r => r.row === 'Recording length')?.cast).toBe('30 minutes per video');
  });

  it('never leaves a competitor cell empty — an empty cell reads as zero', () => {
    for (const row of COMPARISON) {
      expect(row.loom.trim()).not.toBe('');
      expect(row.cast.trim()).not.toBe('');
    }
  });

  it('drops to four rows and two competitors on mobile', () => {
    expect(MOBILE_COMPARISON).toHaveLength(4);
    expect(MOBILE_COMPARISON.every(r => !('cast' in r))).toBe(true);
  });

  it('answers the six questions people ask first', () => {
    expect(FAQS).toHaveLength(6);
    expect(FAQS[0].q).toBe('Do I need an account?');
  });

  it('says recording works without an account', () => {
    expect(FAQS[0].a).toMatch(/without signing in/);
  });
});

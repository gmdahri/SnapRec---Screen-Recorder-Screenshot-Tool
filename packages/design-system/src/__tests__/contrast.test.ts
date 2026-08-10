// @vitest-environment node
// Pure file I/O — jsdom would rewrite import.meta.url to an http:// URL,
// which fileURLToPath rejects.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = fileURLToPath(new URL('../tokens.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

function tokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--sr-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const T = tokens();

/** Every pair here carries text and must clear WCAG AA (4.5:1). */
const TEXT_PAIRS: Array<[string, string]> = [
  ['--sr-text-primary-on-light', '--sr-surface-paper'],
  ['--sr-text-secondary-on-light', '--sr-surface-paper'],
  ['--sr-text-muted-on-light', '--sr-surface-paper'],
  ['--sr-text-faint-on-light', '--sr-surface-paper'],
  ['--sr-text-primary-on-light', '--sr-surface-panel-light'],
  ['--sr-text-faint-on-light', '--sr-surface-panel-light'],
  ['--sr-text-primary-on-dark', '--sr-surface-carbon'],
  ['--sr-text-secondary-on-dark', '--sr-surface-carbon'],
  ['--sr-text-muted-on-dark', '--sr-surface-carbon'],
  ['--sr-text-faint-on-dark', '--sr-surface-carbon'],
  ['--sr-cyan-on-light', '--sr-surface-paper'],
  ['--sr-cyan-fg', '--sr-cyan'],
  ['--sr-coral-text-fg', '--sr-coral-text'],
];

describe('token contrast', () => {
  it('parses tokens from tokens.css', () => {
    expect(Object.keys(T).length).toBeGreaterThan(20);
  });

  it.each(TEXT_PAIRS)('%s on %s clears WCAG AA', (fg, bg) => {
    expect(T[fg], `${fg} missing from tokens.css`).toBeDefined();
    expect(T[bg], `${bg} missing from tokens.css`).toBeDefined();
    expect(contrast(T[fg], T[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the faint-on-light token distinct from faint-on-dark', () => {
    // #8D989B reads at 2.86:1 on paper — legible only on carbon.
    expect(T['--sr-text-faint-on-light']).not.toBe(T['--sr-text-faint-on-dark']);
  });
});

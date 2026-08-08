import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const parse = (path) => {
  const css = readFileSync(resolve(__dirname, path), 'utf8');
  const out = {};
  for (const m of css.matchAll(/(--sr-[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
};

const SOURCE = '../../../packages/design-system/src/tokens.css';
const EXTENSION = '../styles/design-system.css';

/** The extension has no build step, so it cannot import the design system —
 * the tokens are a hand-copied duplicate. Drift between the two is a real bug,
 * so it is a test rather than a convention. */
describe('extension tokens', () => {
  it('carries every token the design system defines', () => {
    const source = parse(SOURCE);
    const ext = parse(EXTENSION);
    const missing = Object.keys(source).filter((k) => !(k in ext));
    expect(missing).toEqual([]);
  });

  it('carries the same value for every token — no drift', () => {
    const source = parse(SOURCE);
    const ext = parse(EXTENSION);
    const drifted = Object.entries(source)
      .filter(([k, v]) => k in ext && ext[k] !== v)
      .map(([k, v]) => `${k}: ${v} → ${ext[k]}`);
    expect(drifted).toEqual([]);
  });

  it('does not load any remote resource — MV3 CSP blocks it', () => {
    const css = readFileSync(resolve(__dirname, EXTENSION), 'utf8');
    expect(css).not.toMatch(/@import\s+url\(['"]?https?:/);
    expect(css).not.toMatch(/url\(['"]?https?:/);
  });
});

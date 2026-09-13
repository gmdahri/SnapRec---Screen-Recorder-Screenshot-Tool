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

/* The floating preview after a capture was built entirely in hex.
 *
 * Not carelessness: the content script injected content.css alone, never
 * styles/design-system.css, so var(--sr-*) resolved to nothing in the page and
 * literals were the only thing that worked. Injecting the tokens is what makes
 * the plate language available out there; these guard the result. */
describe('the in-page surfaces use the design system', () => {
  const css = readFileSync(resolve(__dirname, '../content/content.css'), 'utf8');

  it('carries no hex literals', () => {
    // Strips comments first: a hex value quoted in prose is not a style.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it('is injected together with the tokens it depends on', () => {
    const inject = readFileSync(
      resolve(__dirname, '../background/utils/contentScriptManager.js'), 'utf8');
    expect(inject).toMatch(/styles\/design-system\.css/);
    // Order matters: the tokens have to be defined before anything reads them.
    expect(inject.indexOf('design-system.css')).toBeLessThan(inject.indexOf('content/content.css'));
  });

  it('ships the fonts those tokens reference to the page', () => {
    // @font-face in design-system.css points at ../fonts/*.woff2. Without the
    // fonts being web-accessible the faces fail silently and the page falls
    // back to system UI — right layout, wrong typeface, no error anywhere.
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8'));
    const resources = manifest.web_accessible_resources[0].resources;
    expect(resources.some((r) => r.startsWith('fonts/'))).toBe(true);
  });
});

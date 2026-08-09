import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolved from this file, not the cwd — vitest is run from both the repo
 * root and the workspace, and a cwd-relative path passes in one and throws in
 * the other. */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The editors must not drift back to the pre-plate palette.
 *
 * This has now regressed twice in the same way: a migration pass swaps the
 * *text* to on-dark tokens but leaves the Tailwind light-palette backgrounds
 * behind. The result is not merely off-brand — `text-primary-on-dark` over
 * `bg-[#f8fafc]` rendered the "Projects" heading white-on-white, invisible.
 *
 * Scoped to the editors rather than the whole app on purpose: the marketing
 * pages still use gradient headings, and sweeping those is a separate call. */
const EDITOR_DIRS = [
  'pages/VideoEditor',
  'pages/Editor',
].map(d => join(SRC, d));

const EDITOR_FILES = [
  'pages/Editor.tsx',
  'components/VideoPlayer.tsx',
  'components/GatedButton.tsx',
].map(f => join(SRC, f));

/** Tailwind palette ramps. The plate defines its own greys and accents in
 * tokens.css; anything from these families is by definition not from it. */
const RAMP =
  /\b(?:hover:|focus:|active:|group-hover:|disabled:|from-|via-|to-)?(?:bg|text|border|ring|shadow|accent|fill|stroke)-(?:violet|purple|indigo|slate|amber|yellow|red|rose|orange|emerald|green|blue|sky|teal|fuchsia|pink|gray|zinc|neutral|stone)-\d{2,3}\b/g;

/** `primary` maps to --sr-cyan-on-light, the light-surface cyan. On a carbon
 * editor it reads as a muddy teal, so the editors use --sr-cyan directly. */
const PRIMARY = /(?<![-\w])(?:bg|text|border|ring|shadow|accent)-primary(?![-\w])/g;

/** Any hex or rgb() written inline instead of read from a token. */
const RAW_COLOUR = /(?:#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*,)/g;

function tsxFilesIn(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== '__tests__') walk(full);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const files = [...EDITOR_DIRS.flatMap(tsxFilesIn), ...EDITOR_FILES]
  .map(f => [f.slice(SRC.length + 1), f] as const);

describe('editor palette', () => {
  it('covers every editor file', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)('%s uses no Tailwind palette ramp', (_name, file) => {
    const hits = readFileSync(file, 'utf8').match(RAMP) ?? [];
    expect(hits).toEqual([]);
  });

  it.each(files)('%s uses --sr-cyan rather than the `primary` alias', (_name, file) => {
    const hits = readFileSync(file, 'utf8').match(PRIMARY) ?? [];
    expect(hits).toEqual([]);
  });

  it.each(files)('%s writes no raw colour literal', (_name, file) => {
    // Glows are the one exception: a box-shadow colour cannot take a bare
    // `var()` alpha, so they carry the cyan channels inline. Pinned by value
    // so a *different* raw colour still fails.
    const CYAN_GLOW = /rgba\(6,\s*166,\s*192,/g;
    const source = readFileSync(file, 'utf8').replace(CYAN_GLOW, '');
    const hits = source.match(RAW_COLOUR) ?? [];
    expect(hits).toEqual([]);
  });
});

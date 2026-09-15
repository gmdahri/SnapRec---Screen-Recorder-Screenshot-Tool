import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const BG = readFileSync(resolve(__dirname, '../background/background.js'), 'utf8');

/** Every web URL the extension opens has to survive a cached redirect.
 *
 * Before the _redirects fix, Cloudflare Pages answered 308 Permanent Redirect
 * to / for /v, /editor, /library and the rest. Browsers cache a 308
 * indefinitely — that is what "permanent" means — so every browser that opened
 * one during that window still redirects locally without asking the server,
 * and deploying the fix does not clear it.
 *
 * Redirect caches key on the full URL, so a query string sidesteps the stale
 * entry. The first pass at this covered /v only, which fixed recordings and
 * left screenshots — which open /editor — still landing on the marketing page.
 * This is what stops the next one being missed. */
describe('web URLs the extension opens', () => {
  const opened = [...BG.matchAll(/\$\{CONFIG\.WEB_BASE_URL\}([^`"']*)/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith('/version.json'));

  it('finds the URLs at all, so this suite cannot pass vacuously', () => {
    expect(opened.length).toBeGreaterThanOrEqual(3);
  });

  it('carries a cache-buster on every one', () => {
    const missing = opened.filter((u) => !u.includes('fresh=true'));
    expect(missing).toEqual([]);
  });
});

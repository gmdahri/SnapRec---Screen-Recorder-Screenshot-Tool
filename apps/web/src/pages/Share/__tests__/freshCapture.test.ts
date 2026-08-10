import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const VIEW = readFileSync(join(SRC, 'pages/ShareView.tsx'), 'utf8');

/** The page the extension opens the moment a recording stops.
 *
 * ShareView renders two different surfaces: a share link, which has been on
 * the plate since ShareShell, and this one — the fresh capture, which still
 * owns upload, claiming and the local blob and so was deliberately left on
 * the old markup. It is on the plate now, and only its presentation changed:
 * every handler and condition is untouched. */
describe('the page shown after recording', () => {
  it('no longer wears the pre-plate layout', () => {
    expect(VIEW).not.toMatch(/MainLayout/);
    expect(VIEW).toMatch(/FreshCaptureChrome/);
  });

  it('does not sell the extension to someone who just used it', () => {
    // Both install prompts are behind !isFresh. On a capture you just made,
    // "Add to Chrome" is being pitched to the one person who provably has it.
    const store = VIEW.indexOf('chromewebstore.google.com');
    expect(store).toBeGreaterThan(-1);
    expect(VIEW.lastIndexOf('{!isFresh && (', store)).toBeGreaterThan(-1);
    const cta = VIEW.indexOf('<AddToChromeButton size="lg" />');
    expect(cta).toBeGreaterThan(-1);
    expect(VIEW.lastIndexOf('{!isFresh && (', cta)).toBeGreaterThan(-1);
  });

  it('offers the share action once, not twice', () => {
    // The header owns the verb; the private notice states the fact. The same
    // button twice within 40px reads as two different things.
    expect(VIEW.match(/onClick=\{handleUploadToCloud\}/g) ?? []).toHaveLength(1);
  });

  it('states private as a state, not as a warning', () => {
    // Amber said something had gone wrong when nothing had — a capture is
    // private until you decide otherwise.
    expect(VIEW).not.toMatch(/amber-/);
    expect(VIEW).toMatch(/PRIVATE</);
  });

  it('keeps the upload and claim flow untouched', () => {
    // The one flow where a styling change could lose someone's recording.
    for (const symbol of ['handleUploadToCloud', 'handleSaveClick', 'localVideoBlob', 'claimMutation']) {
      expect(VIEW).toMatch(new RegExp(symbol));
    }
  });
});

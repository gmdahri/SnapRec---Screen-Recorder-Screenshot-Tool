import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The rating prompt.
 *
 * Gate: at least RATING_THRESHOLD completed recordings, never shown before, and
 * analytics not opted out. Any one of those failing means no banner.
 */

function stubChrome({ store = {}, id = 'lgafjgnifbjeafallnkkfpljgbilfajg' } = {}) {
    globalThis.chrome = {
        runtime: { id, lastError: undefined },
        storage: {
            local: {
                get: async (k) => {
                    const keys = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
                    const out = {};
                    for (const key of keys) if (key in store) out[key] = store[key];
                    return out;
                },
                set: async (obj) => { Object.assign(store, obj); },
            },
        },
    };
    return store;
}

const load = () => import('../popup/ratingPrompt.js');

describe('rating prompt eligibility', () => {
    let store;
    beforeEach(() => { store = stubChrome(); });

    it('does not show before the threshold', async () => {
        const { shouldShowRatingPrompt, RATING_THRESHOLD } = await load();
        for (let n = 0; n < RATING_THRESHOLD; n++) {
            store.completedRecordingsCount = n;
            await expect(shouldShowRatingPrompt(), `count=${n}`).resolves.toBe(false);
        }
    });

    it('shows once the threshold is reached', async () => {
        const { shouldShowRatingPrompt, RATING_THRESHOLD } = await load();
        store.completedRecordingsCount = RATING_THRESHOLD;
        await expect(shouldShowRatingPrompt()).resolves.toBe(true);
    });

    /* The brief said "after the 2nd recording AND on every new recording", but
     * also "only show it once". Those cannot both hold. Once-only wins — it is
     * stated twice and matches "dismisses permanently, don't nag" — so the
     * threshold is a floor, not an equality: a user who somehow passes 2 without
     * seeing it still gets one chance later. */
    it('still shows above the threshold if it was never shown', async () => {
        const { shouldShowRatingPrompt } = await load();
        for (const n of [3, 7, 50]) {
            store.completedRecordingsCount = n;
            await expect(shouldShowRatingPrompt(), `count=${n}`).resolves.toBe(true);
        }
    });

    it('never shows again once it has been shown', async () => {
        const { shouldShowRatingPrompt } = await load();
        store.completedRecordingsCount = 99;
        store.ratingPromptShown = true;
        await expect(shouldShowRatingPrompt()).resolves.toBe(false);
    });

    it('never shows when analytics is opted out', async () => {
        const { shouldShowRatingPrompt } = await load();
        store.completedRecordingsCount = 99;
        store.analyticsOptOut = true;
        await expect(shouldShowRatingPrompt()).resolves.toBe(false);
    });

    it('treats a missing count as zero rather than throwing', async () => {
        const { shouldShowRatingPrompt } = await load();
        await expect(shouldShowRatingPrompt()).resolves.toBe(false);
    });

    it('does not show when storage is unavailable', async () => {
        stubChrome();
        globalThis.chrome.storage.local.get = async () => { throw new Error('unavailable'); };
        const { shouldShowRatingPrompt } = await load();
        await expect(shouldShowRatingPrompt()).resolves.toBe(false);
    });
});

describe('dismissing the prompt', () => {
    let store;
    beforeEach(() => { store = stubChrome(); });

    it('marking shown makes it permanently ineligible', async () => {
        const { shouldShowRatingPrompt, markRatingPromptShown } = await load();
        store.completedRecordingsCount = 5;
        await expect(shouldShowRatingPrompt()).resolves.toBe(true);

        await markRatingPromptShown();
        expect(store.ratingPromptShown).toBe(true);
        await expect(shouldShowRatingPrompt()).resolves.toBe(false);
    });

    it('stays dismissed as the count keeps rising', async () => {
        const { shouldShowRatingPrompt, markRatingPromptShown } = await load();
        store.completedRecordingsCount = 2;
        await markRatingPromptShown();
        for (const n of [3, 10, 100]) {
            store.completedRecordingsCount = n;
            await expect(shouldShowRatingPrompt(), `count=${n}`).resolves.toBe(false);
        }
    });

    it('never throws when storage rejects the write', async () => {
        stubChrome();
        globalThis.chrome.storage.local.set = async () => { throw new Error('unavailable'); };
        const { markRatingPromptShown } = await load();
        await expect(markRatingPromptShown()).resolves.toBeUndefined();
    });
});

describe('the review URL', () => {
    beforeEach(() => { stubChrome(); });

    it('is built from the live extension id, not a hardcoded one', async () => {
        const { reviewUrl } = await load();
        expect(reviewUrl()).toBe(
            'https://chromewebstore.google.com/detail/lgafjgnifbjeafallnkkfpljgbilfajg/reviews');
    });

    it('follows the id wherever the extension is loaded', async () => {
        stubChrome({ id: 'unpackeddevidaaaaaaaaaaaaaaaaaaa' });
        const { reviewUrl } = await load();
        expect(reviewUrl()).toContain('unpackeddevidaaaaaaaaaaaaaaaaaaa');
    });
});

describe('wiring', () => {
    const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

    it('the counter is incremented at the single completion funnel', () => {
        const bg = read('background/background.js');
        // handleRecordingComplete is reached by both the in-page stop and
        // Chrome's native "Stop sharing", so it is the only correct place.
        const fn = bg.slice(bg.indexOf('async function handleRecordingComplete'));
        expect(fn).toContain('completedRecordingsCount');
    });

    it('only the complete view renders the banner', () => {
        const render = read('popup/render.js');

        // The markup lives in one helper, and viewComplete is its only caller.
        const helpers = (render.match(/^function ratingPrompt\(/gm) || []).length;
        expect(helpers, 'ratingPrompt() should be defined once').toBe(1);

        const callers = [...render.matchAll(/function (view[A-Za-z]+)\([\s\S]*?\n}/g)]
            .filter(([body]) => body.includes('ratingPrompt()'))
            .map(([, name]) => name);
        expect(callers).toEqual(['viewComplete']);

        // And it is gated, so it cannot appear before the gate has resolved.
        expect(render).toContain('state.showRatingPrompt ? ratingPrompt()');
    });

    it('both buttons dismiss permanently', () => {
        const popup = read('popup/popup.js');
        expect(popup).toContain("case 'RATE_CLICKED'");
        expect(popup).toContain("case 'RATING_DISMISSED'");
        expect((popup.match(/markRatingPromptShown\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it('tracks all three PostHog events', () => {
        const popup = read('popup/popup.js');
        for (const e of ['rating_prompt_shown', 'rating_prompt_accepted', 'rating_prompt_dismissed']) {
            expect(popup, e).toContain(e);
        }
    });
});

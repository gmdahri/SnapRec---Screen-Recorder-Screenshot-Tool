import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The rating prompt.
 *
 * Asked at most three times — at the 3rd, 8th and 15th completed recording.
 * "Rate" retires it for good; "Maybe later" leaves the later showings intact.
 * Analytics opt-out suppresses it entirely, and every read fails closed.
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

/** The modal is drawn, which spends one showing — what paint() does. */
async function showOnce(mod, store) {
    const before = await mod.ratingPromptState();
    if (before.show) await mod.recordRatingPromptShowing();
    return before;
}

describe('the three showings', () => {
    let store;
    beforeEach(() => { store = stubChrome(); });

    it('says nothing before the first threshold', async () => {
        const { ratingPromptState, RATING_THRESHOLDS } = await load();
        for (let n = 0; n < RATING_THRESHOLDS[0]; n++) {
            store.completedRecordingsCount = n;
            await expect(ratingPromptState(), `count=${n}`)
                .resolves.toEqual({ show: false, showing: 0 });
        }
    });

    it('appears at the 3rd, 8th and 15th recording, and never again', async () => {
        const mod = await load();
        const seenAt = [];

        for (let n = 1; n <= 40; n++) {
            store.completedRecordingsCount = n;
            const { show, showing } = await mod.ratingPromptState();
            if (show) {
                seenAt.push([n, showing]);
                await mod.recordRatingPromptShowing();
            }
        }

        expect(seenAt).toEqual([[3, 1], [8, 2], [15, 3]]);
    });

    it('reports which showing it is, for the PostHog property', async () => {
        const mod = await load();
        store.completedRecordingsCount = 3;
        expect((await mod.ratingPromptState()).showing).toBe(1);
        await mod.recordRatingPromptShowing();

        store.completedRecordingsCount = 8;
        expect((await mod.ratingPromptState()).showing).toBe(2);
        await mod.recordRatingPromptShowing();

        store.completedRecordingsCount = 15;
        expect((await mod.ratingPromptState()).showing).toBe(3);
    });

    it('is retired after the third showing whatever the answer was', async () => {
        const mod = await load();
        for (const n of [3, 8, 15]) {
            store.completedRecordingsCount = n;
            expect((await mod.ratingPromptState()).show, `count=${n}`).toBe(true);
            await mod.recordRatingPromptShowing();
        }
        expect(store.ratingPromptShowCount).toBe(3);

        for (const n of [16, 30, 500]) {
            store.completedRecordingsCount = n;
            await expect(mod.ratingPromptState(), `count=${n}`)
                .resolves.toEqual({ show: false, showing: 0 });
        }
    });

    /* The threshold is a floor, not an equality: a showing missed at its exact
     * count — popup closed, storage write lost — must still be reachable. */
    it('still shows a missed showing later', async () => {
        const { ratingPromptState } = await load();
        store.completedRecordingsCount = 11;
        await expect(ratingPromptState()).resolves.toEqual({ show: true, showing: 1 });
    });

    /* This prompt shipped once already, so most installs are past every
     * threshold. Without a gap they would get all three asks on three
     * consecutive completions, which is the nagging the thresholds prevent. */
    it('keeps the designed spacing for an install that arrives late', async () => {
        const mod = await load();
        store.completedRecordingsCount = 20;
        expect((await mod.ratingPromptState()).showing).toBe(1);
        await mod.recordRatingPromptShowing();

        // Showing 2 is 5 recordings after showing 1, not immediately.
        for (const n of [21, 24]) {
            store.completedRecordingsCount = n;
            expect((await mod.ratingPromptState()).show, `count=${n}`).toBe(false);
        }
        store.completedRecordingsCount = 25;
        expect((await mod.ratingPromptState()).showing).toBe(2);
        await mod.recordRatingPromptShowing();

        // And showing 3 is 7 after that.
        store.completedRecordingsCount = 31;
        expect((await mod.ratingPromptState()).show).toBe(false);
        store.completedRecordingsCount = 32;
        expect((await mod.ratingPromptState()).showing).toBe(3);
    });
});

describe('answering the prompt', () => {
    let store;
    beforeEach(() => { store = stubChrome(); });

    it('never asks again once the user has rated', async () => {
        const mod = await load();
        store.completedRecordingsCount = 3;
        await showOnce(mod, store);
        await mod.markRatingPromptRated();
        expect(store.ratingPromptRated).toBe(true);

        for (const n of [8, 15, 99]) {
            store.completedRecordingsCount = n;
            await expect(mod.ratingPromptState(), `count=${n}`)
                .resolves.toEqual({ show: false, showing: 0 });
        }
    });

    /* The difference from the old one-shot banner: "Maybe later" writes nothing,
     * so the next threshold arrives on its own. */
    it('asks again at the next threshold after "Maybe later"', async () => {
        const mod = await load();
        store.completedRecordingsCount = 3;
        await showOnce(mod, store);            // shown, then dismissed — no write

        store.completedRecordingsCount = 8;
        await expect(mod.ratingPromptState()).resolves.toEqual({ show: true, showing: 2 });
    });

    it('spends a showing on being drawn, not on being answered', async () => {
        // A user who closes the popup without answering has still been asked.
        const mod = await load();
        store.completedRecordingsCount = 3;
        await mod.recordRatingPromptShowing();
        expect(store.ratingPromptShowCount).toBe(1);
        expect(store.ratingPromptLastShownAt).toBe(3);

        store.completedRecordingsCount = 4;
        await expect(mod.ratingPromptState()).resolves.toEqual({ show: false, showing: 0 });
    });

    it('counts the legacy one-shot flag as the first showing', async () => {
        // Installs carrying ratingPromptShown were asked once by the old banner.
        // It recorded "was asked", not "rated", so it maps to one showing spent.
        const mod = await load();
        store.ratingPromptShown = true;
        store.completedRecordingsCount = 3;
        await expect(mod.ratingPromptState()).resolves.toEqual({ show: false, showing: 0 });

        store.completedRecordingsCount = 8;
        await expect(mod.ratingPromptState()).resolves.toEqual({ show: true, showing: 2 });
    });

    it('never throws when storage rejects a write', async () => {
        stubChrome();
        globalThis.chrome.storage.local.set = async () => { throw new Error('unavailable'); };
        const { markRatingPromptRated, recordRatingPromptShowing } = await load();
        await expect(markRatingPromptRated()).resolves.toBeUndefined();
        await expect(recordRatingPromptShowing()).resolves.toBeUndefined();
    });
});

describe('when not to ask at all', () => {
    let store;
    beforeEach(() => { store = stubChrome(); });

    it('never shows when analytics is opted out', async () => {
        const { ratingPromptState } = await load();
        store.completedRecordingsCount = 99;
        store.analyticsOptOut = true;
        await expect(ratingPromptState()).resolves.toEqual({ show: false, showing: 0 });
    });

    it('treats a missing count as zero rather than throwing', async () => {
        const { ratingPromptState } = await load();
        await expect(ratingPromptState()).resolves.toEqual({ show: false, showing: 0 });
    });

    it('does not show when storage is unavailable', async () => {
        stubChrome();
        globalThis.chrome.storage.local.get = async () => { throw new Error('unavailable'); };
        const { ratingPromptState } = await load();
        await expect(ratingPromptState()).resolves.toEqual({ show: false, showing: 0 });
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

    it('only the complete view renders the modal', () => {
        const render = read('popup/render.js');

        const helpers = (render.match(/^function ratingPrompt\(/gm) || []).length;
        expect(helpers, 'ratingPrompt() should be defined once').toBe(1);

        const callers = [...render.matchAll(/function (view[A-Za-z]+)\([\s\S]*?\n}/g)]
            .filter(([body]) => body.includes('ratingPrompt()'))
            .map(([, name]) => name);
        expect(callers).toEqual(['viewComplete']);

        expect(render).toContain('state.showRatingPrompt ? ratingPrompt()');
    });

    it('is a centred modal, not the banner it used to be', () => {
        const render = read('popup/render.js');
        const css = read('popup/popup.css');

        expect(render).toContain('role="dialog"');
        expect(render).toContain('aria-modal="true"');
        // Focus lands on the heading, so Enter cannot open the store by
        // accident on a view whose own primary action is "Upload and get link".
        expect(render).toMatch(/sr-rating-title[^>]*data-focus-target/);

        expect(css).toMatch(/\.sr-rating-scrim\s*\{[^}]*position:\s*fixed/s);
        expect(css).toMatch(/\.sr-rating-scrim\s*\{[^}]*align-items:\s*center/s);
        expect(css).toMatch(/\.sr-rating-scrim\s*\{[^}]*justify-content:\s*center/s);
    });

    it('carries the copy that says why it is asking', () => {
        const render = read('popup/render.js');
        expect(render).toContain(
            'SnapRec is free and built by one person. A quick review helps other people find it and keeps development going.');
        expect(render).toContain('⭐ Rate on Chrome Store');
        expect(render).toContain('Maybe later');
    });

    it('retires the prompt on Rate only, never on Maybe later', () => {
        const popup = read('popup/popup.js');
        expect(popup).toContain("case 'RATE_CLICKED'");
        expect(popup).toContain("case 'RATING_DISMISSED'");

        // The one permanent write belongs to RATE_CLICKED alone.
        expect((popup.match(/markRatingPromptRated\(\)/g) || []).length).toBe(1);
        const dismissed = popup.slice(popup.indexOf("case 'RATING_DISMISSED'"));
        expect(dismissed.slice(0, dismissed.indexOf('break;'))).not.toContain('markRatingPromptRated');
    });

    it('reports which showing every event belongs to', () => {
        const popup = read('popup/popup.js');
        for (const e of ['rating_prompt_shown', 'rating_prompt_accepted', 'rating_prompt_dismissed']) {
            expect(popup, e).toContain(e);
        }
        expect((popup.match(/which_showing/g) || []).length).toBe(3);
    });

    it('spends the showing where it is drawn, so a closed popup still counts', () => {
        const popup = read('popup/popup.js');
        const paint = popup.slice(popup.indexOf('function paint('));
        expect(paint.slice(0, paint.indexOf('\n}'))).toContain('recordRatingPromptShowing()');
    });
});

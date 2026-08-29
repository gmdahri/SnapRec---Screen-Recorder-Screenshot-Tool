import { describe, expect, it, vi } from 'vitest';
import { resolveInstallSource, startIdentityBridge } from '../lib/extensionIdentity';

/** The handshake that makes the activation funnel possible.
 *
 * These tests exist because the failure they guard against is silent: if the
 * identity never reaches the extension, every event still sends, PostHog still
 * accepts them, and the funnel still reads zero at the install step — with
 * nothing anywhere reporting a fault.
 */

function fakeStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => { map.set(k, v); },
        map,
    };
}

const loc = (search: string) => ({ search, href: `https://www.snaprecorder.org/${search}` });

describe('resolveInstallSource', () => {
    it('prefers the campaign over the referrer', () => {
        const source = resolveInstallSource(
            loc('?utm_source=google&utm_medium=cpc'),
            'https://www.google.com/',
            fakeStorage(),
        );
        expect(source).toBe('google/cpc');
    });

    it('falls back to the referring host', () => {
        expect(resolveInstallSource(loc(''), 'https://news.ycombinator.com/item?id=1', fakeStorage()))
            .toBe('news.ycombinator.com');
    });

    it('reports no referrer as direct', () => {
        expect(resolveInstallSource(loc(''), '', fakeStorage())).toBe('direct');
    });

    /* Our own pages are not an acquisition source. Without this every visitor
     * who read one more page before installing would be attributed to
     * snaprecorder.org and the real source would be lost. */
    it('does not treat our own site as a source', () => {
        expect(resolveInstallSource(loc(''), 'https://www.snaprecorder.org/blog/', fakeStorage()))
            .toBe('direct');
    });

    /* First touch wins: the campaign parameters are gone from the URL long
     * before the visitor gets round to installing. */
    it('remembers the first source across later pages', () => {
        const storage = fakeStorage();
        resolveInstallSource(loc('?utm_source=producthunt'), '', storage);

        const later = resolveInstallSource(loc(''), 'https://www.snaprecorder.org/', storage);
        expect(later).toBe('producthunt');
    });

    it('still resolves when storage throws', () => {
        const hostile = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
        };
        expect(resolveInstallSource(loc('?utm_source=x'), '', hostile)).toBe('x');
    });

    it('survives a malformed referrer', () => {
        expect(resolveInstallSource(loc(''), 'not-a-url', fakeStorage())).toBe('direct');
    });
});

describe('startIdentityBridge', () => {
    const immediate = ((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout;

    it('sends the identity and the source to the extension', async () => {
        const send = vi.fn().mockResolvedValue(true);

        startIdentityBridge({
            getDistinctId: () => 'web-abc',
            getSource: () => 'google/cpc',
            send,
            setTimeoutFn: immediate,
            addVisibilityListener: () => () => {},
        });
        await Promise.resolve();

        expect(send).toHaveBeenCalledWith('web-abc', 'google/cpc');
    });

    /* The extension is installed mid-session, so the first attempt normally
     * finds nothing listening. Giving up after one try was never going to
     * work. */
    it('retries while the extension is not there yet', async () => {
        const send = vi.fn().mockResolvedValue(false);

        startIdentityBridge({
            getDistinctId: () => 'web-abc',
            getSource: () => 'direct',
            send,
            setTimeoutFn: immediate,
            addVisibilityListener: () => () => {},
        });
        await new Promise(r => setTimeout(r, 0));

        expect(send.mock.calls.length).toBeGreaterThan(1);
    });

    it('stops once the extension accepts it', async () => {
        const send = vi.fn().mockResolvedValue(true);

        startIdentityBridge({
            getDistinctId: () => 'web-abc',
            getSource: () => 'direct',
            send,
            setTimeoutFn: immediate,
            addVisibilityListener: () => () => {},
        });
        await new Promise(r => setTimeout(r, 0));

        expect(send).toHaveBeenCalledTimes(1);
    });

    it('does not send before PostHog has an id', async () => {
        const send = vi.fn().mockResolvedValue(true);

        startIdentityBridge({
            getDistinctId: () => null,
            getSource: () => 'direct',
            send,
            setTimeoutFn: immediate,
            addVisibilityListener: () => () => {},
        });
        await new Promise(r => setTimeout(r, 0));

        expect(send).not.toHaveBeenCalled();
    });

    /* Coming back to the tab is usually the install finishing in the Web Store
     * tab — the single best moment to try again. */
    it('tries again when the visitor returns to the tab', async () => {
        const send = vi.fn().mockResolvedValue(false);
        let onVisible = () => {};

        startIdentityBridge({
            getDistinctId: () => 'web-abc',
            getSource: () => 'direct',
            send,
            setTimeoutFn: (() => 0) as unknown as typeof setTimeout,   // no scheduled attempts
            addVisibilityListener: (fn) => { onVisible = fn; return () => {}; },
        });

        expect(send).not.toHaveBeenCalled();
        onVisible();
        await new Promise(r => setTimeout(r, 0));

        expect(send).toHaveBeenCalledWith('web-abc', 'direct');
    });

    it('teardown stops any further sends', async () => {
        const send = vi.fn().mockResolvedValue(false);
        let onVisible = () => {};

        const stop = startIdentityBridge({
            getDistinctId: () => 'web-abc',
            getSource: () => 'direct',
            send,
            setTimeoutFn: (() => 0) as unknown as typeof setTimeout,
            addVisibilityListener: (fn) => { onVisible = fn; return () => {}; },
        });

        stop();
        onVisible();
        await new Promise(r => setTimeout(r, 0));

        expect(send).not.toHaveBeenCalled();
    });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** chrome.runtime.setUninstallURL.
 *
 * background.js is a service-worker script with top-level chrome.* calls, so it
 * cannot be imported. These assert the properties that actually matter, against
 * the source: registered on every onInstalled reason, built from CONFIG rather
 * than hardcoded, and guarded so it cannot take the context menu down with it.
 */
const bg = readFileSync(resolve(__dirname, '../background/background.js'), 'utf8');
const onInstalled = bg.slice(
    bg.indexOf('chrome.runtime.onInstalled.addListener'),
    bg.indexOf('chrome.contextMenus.onClicked'));

describe('uninstall URL', () => {
    it('is registered inside onInstalled', () => {
        expect(onInstalled).toContain('setUninstallURL');
    });

    /* The browser stores the URL rather than reading it at uninstall time, so an
     * install that never updates and an update that changes the URL both have to
     * register it. Gating on reason === 'install' would leave every existing
     * user without a survey. */
    it('is not gated on the install reason', () => {
        const call = onInstalled.indexOf('setUninstallURL');
        const installGate = onInstalled.indexOf("reason === 'install'");
        const gateBlockEnd = onInstalled.indexOf('}', onInstalled.indexOf('extension_installed'));
        expect(call, 'must sit outside the install-only block')
            .toBeGreaterThan(gateBlockEnd);
        expect(installGate).toBeGreaterThan(-1); // the analytics gate is still there
    });

    it('points at the survey page on the configured web origin', () => {
        expect(onInstalled).toContain('${CONFIG.WEB_BASE_URL}/uninstall-survey');
    });

    /* CONFIG.WEB_BASE_URL is production, and swaps to localhost for local dev —
     * a hardcoded literal would send developers to the live site. */
    it('does not hardcode the production origin', () => {
        const call = onInstalled.indexOf('chrome.runtime.setUninstallURL(');
        expect(onInstalled.slice(call, call + 200)).not.toContain('https://www.snaprecorder.org');
    });

    it('cannot break the rest of onInstalled', () => {
        const call = onInstalled.indexOf('chrome.runtime.setUninstallURL(');
        expect(call, 'the invocation, not the comment above it').toBeGreaterThan(-1);
        // Wrapped in try/catch: setUninstallURL throws on a malformed URL.
        const guardStart = onInstalled.lastIndexOf('try {', call);
        expect(guardStart, 'must be inside a try block').toBeGreaterThan(-1);
        expect(onInstalled.slice(guardStart, call)).not.toContain('}');
        // The context menu is registered after it and must still be reached.
        expect(onInstalled.indexOf('chrome.contextMenus.create')).toBeGreaterThan(call);
    });

    it('feature-detects before calling', () => {
        expect(onInstalled).toContain('if (chrome.runtime.setUninstallURL)');
    });

    it('reads lastError so the console stays clean on rejection', () => {
        const call = onInstalled.indexOf('chrome.runtime.setUninstallURL(');
        expect(onInstalled.slice(call, call + 400)).toContain('chrome.runtime.lastError');
    });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Regression guards for the reported bug: "it just keeps trying to download
 * forever and won't." Each of these is a defect that shipped. */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('no download path can silently do nothing', () => {
    /* Library's bulk action was `onSelect: () => showNotification('Preparing
     * your download')` and nothing else — a promise of a file that never came. */
    it('Library actually downloads instead of only showing a toast', () => {
        const lib = read('src/pages/Library.tsx');
        expect(lib).not.toContain("showNotification('Preparing your download', 'info')");
        expect(lib).toContain('downloadSelected');
        expect(lib).toContain('downloadFile(');
    });

    /* ShareView was `if (downloadUrl) { ...click... }` with no else. */
    it('ShareView routes through the helper rather than a bare anchor click', () => {
        const view = read('src/pages/ShareView.tsx');
        expect(view).toContain('download.start(');
        // The old inline anchor-click download is gone.
        expect(view).not.toMatch(/a\.href = downloadUrl \+ '\?download=true'/);
    });

    it('ShareView renders an error with a retry', () => {
        const view = read('src/pages/ShareView.tsx');
        expect(view).toContain("download.state.status === 'error'");
        expect(view).toContain('download.retry()');
        expect(view).toContain('role="alert"');
    });

    /* The infinite spinner: polling stopped only on success. */
    it('ShareView stops polling after a bounded number of attempts', () => {
        const view = read('src/pages/ShareView.tsx');
        expect(view).toContain('MAX_PROCESSING_POLLS');
        expect(view).toContain('setProcessingTimedOut(true)');
    });

    /* chrome.downloads reports failure via lastError and an undefined id, and
     * neither surfaces unless you pass a callback. */
    it('the extension checks whether chrome.downloads actually started', () => {
        const bg = read('../extension/background/background.js');
        const call = bg.indexOf('chrome.downloads.download(');
        expect(call).toBeGreaterThan(-1);
        const after = bg.slice(call, call + 900);
        expect(after).toContain('chrome.runtime.lastError');
        expect(after).toContain('downloadId === undefined');
    });
});

describe('download telemetry', () => {
    it('every surface reports started, completed and failed', () => {
        const sources = ['src/hooks/useDownload.ts', 'src/pages/Library.tsx']
            .map(read).join('\n');
        for (const e of ['recording_download_started', 'recording_download_completed', 'recording_download_failed']) {
            expect(sources, e).toContain(e);
        }
        const bg = read('../extension/background/background.js');
        expect(bg).toContain('recording_download_failed');
    });

    it('the three events are declared in the typed map', () => {
        const map = read('src/lib/analytics.ts');
        for (const e of ['recording_download_started', 'recording_download_completed', 'recording_download_failed']) {
            expect(map, e).toContain(`${e}:`);
        }
    });

    it('failures always carry a reason', () => {
        // Fields are semicolon-separated, so match within the braces.
        expect(read('src/lib/analytics.ts')).toMatch(/recording_download_failed: \{[^}]*error_reason: string/);
    });
});

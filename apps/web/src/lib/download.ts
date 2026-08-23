/** Downloading a file, with failures you can actually see.
 *
 * The bug this exists to fix: every download path either did nothing at all or
 * span forever. The share page's handler was `if (downloadUrl) { ...click... }`
 * with no else, so a missing URL was a silent no-op. The library's bulk action
 * showed "Preparing your download" and never downloaded anything. Neither had a
 * timeout, an error state, or a retry.
 *
 * WHY A PROBE REQUEST: clicking an `<a download>` tells you nothing. There is no
 * success event, no error event, and no way to distinguish "saved" from "404" or
 * "the network is gone". So this first issues a GET and waits only for the
 * response HEADERS, which is enough to know the URL is reachable and the server
 * is willing. The body is then cancelled and the real download handed to the
 * browser via an anchor, so a 4K recording still streams to disk instead of
 * being buffered into a tab's memory.
 *
 * The probe costs one round trip and a few hundred bytes. That is the price of
 * being able to say "this failed, here is why, try again" instead of spinning.
 *
 * A HEAD request would be cheaper but does not work here: R2 presigned URLs are
 * signed per method, so a GET-signed URL rejects HEAD with a 403.
 */

/** How long to wait for the server to respond before calling it a failure. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

export type DownloadFailure =
    | 'no_url'        // nothing to download — the recording has no file yet
    | 'timeout'       // no response headers within DOWNLOAD_TIMEOUT_MS
    | 'not_found'     // 404/410 — the object is gone or the link expired
    | 'forbidden'     // 401/403 — presigned URL expired, or not ours to read
    | 'server_error'  // 5xx
    | 'network'       // offline, DNS, CORS, connection reset
    | 'blocked';      // the browser refused the anchor click

export interface DownloadResult {
    ok: boolean;
    error?: DownloadFailure;
    /** HTTP status when there was one. Useful for triage in analytics. */
    status?: number;
}

/** Map a response status onto a reason a human could act on. */
function failureFor(status: number): DownloadFailure {
    if (status === 404 || status === 410) return 'not_found';
    if (status === 401 || status === 403) return 'forbidden';
    if (status >= 500) return 'server_error';
    return 'network';
}

export interface DownloadOptions {
    /** Injected in tests. Defaults to window.fetch. */
    fetchImpl?: typeof fetch;
    /** Injected in tests. Performs the actual browser download. */
    saveAs?: (url: string, filename?: string) => void;
    timeoutMs?: number;
}

/** Trigger the browser's own download of `url`.
 *
 * Kept separate so tests never touch the DOM, and so the anchor lifetime is in
 * one place: the element must be in the document for the click to be honoured
 * in Firefox, and removing it synchronously after is safe. */
function defaultSaveAs(url: string, filename?: string): void {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/** Verify the file is fetchable, then hand the download to the browser.
 *
 * Never throws. Callers get a result they can render. */
export async function downloadFile(
    url: string | null | undefined,
    filename?: string,
    options: DownloadOptions = {},
): Promise<DownloadResult> {
    // The share page used to fall through this case silently, which is how a
    // click could do nothing at all.
    if (!url || url.includes('undefined')) return { ok: false, error: 'no_url' };

    const doFetch = options.fetchImpl ?? globalThis.fetch;
    const save = options.saveAs ?? defaultSaveAs;
    const timeoutMs = options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await doFetch(url, { method: 'GET', signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        // AbortError is our own timeout firing; anything else is the network.
        const aborted = (err as Error)?.name === 'AbortError' || controller.signal.aborted;
        return { ok: false, error: aborted ? 'timeout' : 'network' };
    }
    clearTimeout(timer);

    if (!response.ok) {
        // Release the connection — nobody is reading this body.
        try { await response.body?.cancel(); } catch { /* already closed */ }
        return { ok: false, error: failureFor(response.status), status: response.status };
    }

    /* Headers are in and the server said yes. Cancel the stream and let the
     * browser download it properly: reading it here would buffer the whole file
     * in the tab, which for a 4K recording is hundreds of megabytes. */
    try { await response.body?.cancel(); } catch { /* already closed */ }

    try {
        save(url, filename);
    } catch {
        return { ok: false, error: 'blocked' };
    }

    return { ok: true, status: response.status };
}

/** A short, non-technical explanation for each failure. */
export function downloadErrorMessage(error: DownloadFailure): string {
    switch (error) {
        case 'no_url':
            return 'This recording is still processing, so there is nothing to download yet.';
        case 'timeout':
            return 'The download did not start in time. Your connection may be slow or the file may still be uploading.';
        case 'not_found':
            return 'This file is no longer available.';
        case 'forbidden':
            return 'This download link has expired. Refresh the page and try again.';
        case 'server_error':
            return 'The server had a problem preparing this download.';
        case 'blocked':
            return 'Your browser blocked the download. Check for a blocked-popup notice.';
        case 'network':
        default:
            return 'Could not reach the server. Check your connection and try again.';
    }
}

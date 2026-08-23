import { useCallback, useRef, useState } from 'react';
import {
    downloadFile, downloadErrorMessage,
    type DownloadFailure,
} from '../lib/download';
import { capture } from '../lib/analytics';

/** Download state for a button that has to be able to fail.
 *
 * Every download surface previously had two states — "clicked" and nothing —
 * which is why a failure looked identical to a download that was still
 * preparing. This has four, and the terminal ones are visible:
 *
 *   idle → preparing → done
 *                    → error   (with a message and a retry)
 *
 * `preparing` is bounded by the timeout inside downloadFile, so it cannot be
 * the last state a user sees.
 */
export type DownloadState =
    | { status: 'idle' }
    | { status: 'preparing' }
    | { status: 'done' }
    | { status: 'error'; reason: DownloadFailure; message: string };

export interface UseDownloadOptions {
    /** Where this download was triggered from, e.g. 'share_page'. */
    surface: string;
    captureType?: string;
}

export function useDownload({ surface, captureType }: UseDownloadOptions) {
    const [state, setState] = useState<DownloadState>({ status: 'idle' });
    /** Guards against a double-click starting two downloads and two event pairs. */
    const inFlight = useRef(false);
    /** Remembered so the retry button does not need the arguments again. */
    const lastArgs = useRef<{ url: string | null | undefined; filename?: string } | null>(null);

    const start = useCallback(async (url: string | null | undefined, filename?: string) => {
        if (inFlight.current) return;
        inFlight.current = true;
        lastArgs.current = { url, filename };

        setState({ status: 'preparing' });
        capture('recording_download_started', { surface, capture_type: captureType });

        const startedAt = Date.now();
        const result = await downloadFile(url, filename);

        if (result.ok) {
            setState({ status: 'done' });
            capture('recording_download_completed', {
                surface, capture_type: captureType, ms: Date.now() - startedAt,
            });
        } else {
            const reason = result.error ?? 'network';
            setState({ status: 'error', reason, message: downloadErrorMessage(reason) });
            capture('recording_download_failed', {
                surface, error_reason: reason, status: result.status,
            });
        }

        inFlight.current = false;
    }, [surface, captureType]);

    /** Re-run the last attempt. No-op if there has not been one. */
    const retry = useCallback(() => {
        const args = lastArgs.current;
        if (args) void start(args.url, args.filename);
    }, [start]);

    const reset = useCallback(() => setState({ status: 'idle' }), []);

    return { state, start, retry, reset, isBusy: state.status === 'preparing' };
}

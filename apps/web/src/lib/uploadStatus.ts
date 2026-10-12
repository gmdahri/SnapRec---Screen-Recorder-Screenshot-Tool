/** What the share page says about an upload finishing after Stop.
 *
 * The extension opens the share page as soon as the recording stops and keeps
 * uploading in the background, reporting progress through the handoff frame.
 * This turns those reports into one line of status, and decides when the
 * upload counts as slow: after SLOW_AFTER_MS of uploading, if less than
 * SLOW_BELOW_BPS moved over that window. A stalled upload is not shown as slow
 * for ever — the extension gives up after a minute without progress and says
 * so, which arrives here as 'failed'. */

import type { UploadState } from './handoffMessage';

export const SLOW_AFTER_MS = 15_000;
/** Bits per second. Below this, a recording of normal quality is uploading
 * slower than it was recorded. */
export const SLOW_BELOW_BPS = 1_000_000;

export interface UploadReport {
    state: UploadState;
    uploadedBytes?: number;
    totalBytes?: number;
    reason?: string;
}

export interface UploadSample { at: number; uploadedBytes: number }

export interface UploadView {
    phase: 'finishing' | 'registered' | 'failed';
    slow: boolean;
    /** 0–100 while the size is known; null otherwise. */
    percent: number | null;
    label: string;
    detail?: string;
}

const mb = (bytes: number) => {
    const v = bytes / (1024 * 1024);
    return v < 10 ? v.toFixed(1) : String(Math.round(v));
};

const FAILURE_DETAIL: Record<string, string> = {
    stalled: 'The connection stopped moving for a minute.',
    retries_exhausted: 'The connection kept failing.',
    part_failed: 'The connection kept failing.',
    complete_failed: 'The server could not finish the file.',
    session_expired: 'Your session expired. Sign in, then generate a link.',
    extension_silent: 'SnapRec stopped reporting on the upload.',
};

/** True when the trailing SLOW_AFTER_MS window moved too little. */
export function isSlow(samples: UploadSample[], now: number): boolean {
    if (samples.length === 0) return false;
    const windowStart = now - SLOW_AFTER_MS;
    if (samples[0].at > windowStart) return false;              // not uploading long enough to judge
    let base = samples[0];
    for (const s of samples) { if (s.at <= windowStart) base = s; else break; }
    const latest = samples[samples.length - 1];
    const movedBits = (latest.uploadedBytes - base.uploadedBytes) * 8;
    return movedBits / (SLOW_AFTER_MS / 1000) < SLOW_BELOW_BPS;
}

export function describeUpload(report: UploadReport, samples: UploadSample[], now: number): UploadView {
    const { state, uploadedBytes, totalBytes, reason } = report;
    const known = typeof uploadedBytes === 'number' && typeof totalBytes === 'number' && totalBytes > 0;
    const percent = known ? Math.min(100, Math.floor((uploadedBytes! / totalBytes!) * 100)) : null;

    if (state === 'registered') {
        return { phase: 'registered', slow: false, percent: 100, label: 'Your link is ready.' };
    }
    if (state === 'failed') {
        return {
            phase: 'failed', slow: false, percent,
            label: 'Couldn’t finish uploading.',
            detail: `${FAILURE_DETAIL[reason ?? ''] ?? 'Something went wrong on the way to the server.'} `
                + 'Your recording is still on this device: download it, or generate a link to try again.',
        };
    }
    if (state === 'uploading') {
        const amount = known ? `${mb(uploadedBytes!)} of ${mb(totalBytes!)} MB` : null;
        const slow = isSlow(samples, now);
        return slow
            ? {
                phase: 'finishing', slow, percent,
                label: amount ? `Uploading slowly — ${amount}` : 'Uploading slowly',
                detail: 'Keep this tab open. Your recording is safe on this device, and you can watch or download it now.',
            }
            : { phase: 'finishing', slow, percent, label: amount ? `Finishing your recording — uploading ${amount}` : 'Finishing your recording' };
    }
    return { phase: 'finishing', slow: false, percent, label: 'Finishing your recording — almost done' };
}

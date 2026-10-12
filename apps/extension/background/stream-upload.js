/** The streaming multipart upload, and its recovery.
 *
 * Owned by the offscreen document, because that is the context that lives
 * exactly as long as the recording: it holds the media tracks, the
 * MediaRecorder and the bytes. The upload used to be orchestrated from the
 * service worker, which Chrome terminates after 30 seconds without an event —
 * and a low-motion recording sends none — so the worker came back with its
 * in-memory upload state gone, the multipart upload was never completed, and
 * the share page had no server row to show.
 *
 * The upload's bookkeeping is also persisted to IndexedDB after every part.
 * Not for the worker's benefit — it no longer needs any of this while
 * recording — but so that a recording interrupted by something worse (the
 * offscreen document crashing, the browser quitting) can be finalized from the
 * parts already on R2 the next time the worker starts.
 *
 * The dividing line is Stop. Once a recording is stopped the user has the
 * whole capture locally — the share page receives it — so its persisted record
 * is marked stopped at Stop (recovery aborts such an upload rather than
 * completing it) and removed before completion is attempted. Recovery only ever finalizes recordings that never reached Stop, which
 * are exactly the ones where the parts on R2 are all the user has. That rule
 * is what keeps a recording from being registered twice.
 *
 * IndexedDB rather than chrome.storage.session because an offscreen document
 * gets chrome.runtime and no other extension API. It is the same database the
 * handoff already parks captures in.
 *
 * Loaded as a classic script by both the offscreen document and, through
 * importScripts, the service worker. Wrapped so its helpers do not land in the
 * worker's shared global scope. */
(() => {
    /** One key per upload. A single shared key let a new recording overwrite
     * the record of an earlier one still waiting to be recovered. */
    const KEY_PREFIX = 'upload:';
    /** Attempts per part, and for completion, once the recording has stopped
     * and nothing else will retry. */
    const FINAL_ATTEMPTS = 4;
    const MAX_RETRY_MS = 30_000;
    /** Non-final part failures reported per streak. Offline, a part fails on
     * every retry for as long as the network is gone; the first few say so. */
    const REPORTED_RETRIES = 3;
    /** After Stop the share page already has the recording and shows the
     * upload's progress, so a slow upload is allowed to finish. What ends it
     * is a stall: no bytes moving for this long. */
    const STALL_LIMIT_MS = 60_000;
    /** Failed attempts allowed across the whole drain after Stop, so a dead
     * connection that fails fast cannot keep the upload open on retries. */
    const FINISH_RETRY_CAP = 10;
    const STALL_CHECK_MS = 1_000;
    const API_TIMEOUT_MS = 30_000;
    /** Generous: a 5 MB part on a 0.5 Mbit/s uplink takes 80 seconds. */
    const PART_TIMEOUT_MS = 180_000;
    /** A progress write that has not landed by now is not waited on. Writes
     * still apply in order — IndexedDB runs transactions on a store in the
     * order they were created — so a late one cannot overwrite a newer one. */
    const STORE_TIMEOUT_MS = 5_000;
    /** R2 aborts incomplete multipart uploads one day after initiation (the
     * bucket's "Default Multipart Abort Rule"). Past this, there is nothing
     * left to complete. */
    const GONE_AFTER_MS = 26 * 60 * 60 * 1000;

    const backoffMs = (failures) => Math.min(1000 * 2 ** (failures - 1), MAX_RETRY_MS);
    const reasonOf = (e) => String(e?.message ?? e).slice(0, 120);
    const mb = (bytes) => Math.round((bytes / (1024 * 1024)) * 100) / 100;

    function withTimeout(promise, ms, what, setTimer, clearTimer) {
        let timer;
        return Promise.race([
            promise,
            new Promise((_, reject) => { timer = setTimer(() => reject(new Error(`${what} timed out`)), ms); }),
        ]).finally(() => clearTimer(timer));
    }

    function idbUploadStore(idb, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
        const open = () => new Promise((resolve, reject) => {
            const request = idb.open('SnapRecDB', 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = () => reject(request.error ?? new Error('open failed'));
            // Another connection holding an older version. Not waited out.
            request.onblocked = () => reject(new Error('open blocked'));
        });
        const run = (mode, op) => withTimeout((async () => {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['recordings'], mode);
                const request = op(tx.objectStore('recordings'));
                tx.oncomplete = () => { db.close(); resolve(request?.result); };
                tx.onerror = () => { db.close(); reject(tx.error ?? new Error('transaction failed')); };
                tx.onabort = () => { db.close(); reject(tx.error ?? new Error('transaction aborted')); };
            });
        })(), STORE_TIMEOUT_MS, 'upload store', setTimer, clearTimer);

        return {
            list: async () => {
                const keys = await run('readonly', (s) => s.getAllKeys());
                const ours = (keys ?? []).filter((k) => typeof k === 'string' && k.startsWith(KEY_PREFIX));
                const records = [];
                for (const key of ours) records.push(await run('readonly', (s) => s.get(key)));
                return records;
            },
            write: (record) => run('readwrite', (s) => s.put(record, KEY_PREFIX + record.uploadId)),
            remove: (uploadId) => run('readwrite', (s) => s.delete(KEY_PREFIX + uploadId)),
        };
    }

    function apiPoster(apiBase, fetchFn) {
        return async (path, body) => {
            const res = await fetchFn(`${apiBase}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(API_TIMEOUT_MS),
            });
            if (!res.ok) {
                const err = new Error(`${path.split('/').pop()} failed: HTTP ${res.status}`);
                err.status = res.status;
                throw err;
            }
            return res.json();
        };
    }

    const completionPayload = (parts) => [...parts]
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));

    /** The uploader the offscreen document drives.
     *
     * push() takes each MediaRecorder chunk; a part goes up as soon as a full
     * one has accumulated. finish() drains everything that is left — the
     * pending retry AND the buffer behind it — and completes. */
    /** A part upload over fetch: done or failed, with no progress in between.
     * The offscreen document passes one built on XMLHttpRequest, which
     * reports bytes as they leave — what the stall limit needs on a slow
     * uplink, where one 5 MB part can take over a minute. */
    const fetchPut = (fetchFn) => async (url, blob, { signal } = {}) => {
        const res = await fetchFn(url, { method: 'PUT', body: blob, signal });
        return { ok: res.ok, status: res.status, etag: res.headers.get('ETag') };
    };

    function createStreamUploader({
        apiBase, fetch: fetchFn, store, track, partSliceLength, partMinBytes,
        now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout,
        putPart = fetchPut(fetchFn),
        /** Called with { state, uploadedBytes, totalBytes, reason? } once the
         * recording has stopped: 'uploading', 'completing', 'done', 'failed'. */
        onProgress = () => {},
    }) {
        const post = apiPoster(apiBase, fetchFn);
        let record = null;        // what is persisted: enough to finalize without us
        let accepting = false;
        let buffer = [];
        let buffered = 0;
        let pending = null;       // { blob, partNumber } — sliced, not yet on R2
        let pumping = null;
        let failures = 0;
        let retryTimer = null;
        let beginning = null;
        let saveFailures = 0;
        /** Set by finish(). A regular drain in progress stops after its current
         * part and hands over to the final one, which has the limits below;
         * without it the final drain queued behind a drain with none. */
        let finishing = false;
        let lastProgressAt = 0;
        let inFlightBytes = 0;
        let inFlight = null;      // AbortController of the request under way
        let stalled = false;
        /** Part 1 as it went up, and the part on its way now: at Stop the
         * recording's header is patched (webm-cues.js), and part 1 may need
         * sending again with it. */
        let firstPartSent = null;
        let uploadingPart = null;

        /** Never fatal, never blocking: the live upload does not depend on
         * its own persistence. A failure only costs recoverability. */
        const save = () => withTimeout(
            store.write({ ...record, parts: [...record.parts] }),
            STORE_TIMEOUT_MS, 'progress write', setTimer, clearTimer,
        ).catch((e) => {
            saveFailures++;
            console.warn('[SnapRec] Could not persist upload progress:', reasonOf(e));
        });

        const forget = (uploadId) => withTimeout(
            store.remove(uploadId), STORE_TIMEOUT_MS, 'progress removal', setTimer, clearTimer,
        ).catch(() => { saveFailures++; });

        function reset() {
            accepting = false;
            buffer = []; buffered = 0; pending = null; failures = 0;
            finishing = false; stalled = false; inFlightBytes = 0;
            if (retryTimer) { clearTimer(retryTimer); retryTimer = null; }
        }

        let idleTicks = 0;
        const moved = () => { lastProgressAt = now(); idleTicks = 0; };

        function begin(options) {
            beginning = openUpload(options);
            return beginning;
        }

        async function openUpload({ contentType = 'video/webm' } = {}) {
            reset();
            record = null;
            saveFailures = 0;
            accepting = true;  // chunks that arrive before the API answers are kept
            const fileName = `video-${crypto.randomUUID()}-${now()}.webm`;
            try {
                const { uploadId } = await post('/recordings/upload/begin', { fileName, contentType });
                record = {
                    fileName, uploadId, contentType, parts: [], nextPart: 1,
                    bytes: 0, startedAt: now(), lastPartAt: null,
                };
                await save();
                track('upload_started', {});
                if (buffered >= partMinBytes) void pump(false);
                return true;
            } catch (e) {
                // Not fatal: the recording continues, and the share page can
                // still upload the local capture on demand.
                reset();
                track('upload_failed', { error_reason: 'begin_failed', detail: reasonOf(e) });
                return false;
            }
        }

        function push(blob) {
            if (!accepting || !blob?.size) return;
            buffer.push(blob);
            buffered += blob.size;
            // While a failed part waits out its backoff, new chunks only
            // accumulate. Pumping on each one retried every second, offline.
            if (record && !retryTimer && buffered >= partMinBytes) void pump(false);
        }

        /** The failed part again if there is one, so a retry never leaves a
         * hole in the numbering or drops its bytes. Otherwise a new slice of
         * exactly the length R2 demands. */
        function takePart(isFinal) {
            if (pending) return pending;
            /* A backlog at Stop goes up in ordinary parts, not as one trailing
             * part of hundreds of megabytes: a failure then re-sends 5 MB, not
             * all of it. Only the remainder is the short trailing part. */
            const take = isFinal && buffered > partMinBytes
                ? partSliceLength(buffered, false)
                : partSliceLength(buffered, isFinal);
            if (take <= 0) return null;
            const all = new Blob(buffer);
            const rest = all.slice(take);
            buffer = rest.size > 0 ? [rest] : [];
            buffered = rest.size;
            pending = { blob: all.slice(0, take), partNumber: record.nextPart++ };
            return pending;
        }

        async function uploadPart(part) {
            const { uploadUrl } = await post('/recordings/upload/part', {
                fileName: record.fileName, uploadId: record.uploadId, partNumber: part.partNumber,
            });
            const controller = new AbortController();
            const timer = setTimer(() => controller.abort(new Error('part PUT timed out')), PART_TIMEOUT_MS);
            inFlight = controller;
            inFlightBytes = 0;
            const sent = part.blob;
            uploadingPart = part;
            let res;
            try {
                res = await putPart(uploadUrl, sent, {
                    signal: controller.signal,
                    onProgress: (loaded) => {
                        if (loaded > inFlightBytes) { inFlightBytes = loaded; moved(); report('uploading'); }
                    },
                });
            } finally {
                clearTimer(timer);
                inFlight = null;
                inFlightBytes = 0;
                uploadingPart = null;
            }
            if (!res.ok) throw new Error(`part PUT failed: HTTP ${res.status}`);
            // Quoted by R2, and handed back to CompleteMultipartUpload as received.
            const etag = res.etag;
            if (!etag) throw new Error('R2 returned no ETag');
            if (!record) return; // aborted while the part was in flight
            moved();
            if (part.partNumber === 1) firstPartSent = sent;

            record.parts = record.parts.filter((p) => p.partNumber !== part.partNumber);
            record.parts.push({ partNumber: part.partNumber, etag, bytes: part.blob.size });
            record.bytes += part.blob.size;
            record.lastPartAt = now();
            pending = null;
            failures = 0;
            report('uploading');
            await save();
        }

        let totalBytes = 0;
        function report(state, reason) {
            if (!finishing) return;
            const uploadedBytes = (record?.bytes ?? 0) + inFlightBytes;
            onProgress({ state, uploadedBytes, totalBytes, ...(reason ? { reason } : {}) });
        }

        function scheduleRetry() {
            if (retryTimer || !accepting) return;
            retryTimer = setTimer(() => { retryTimer = null; void pump(false); }, backoffMs(failures));
        }

        /** Serialised: parts are sliced from one buffer. A final drain requested
         * while a part is in flight runs straight after it. */
        let finishFailures = 0;
        function pump(isFinal) {
            if (pumping) return isFinal ? pumping.then(() => pump(true)) : pumping;
            pumping = (async () => {
                try {
                    while (record && !stalled) {
                        // Stop arrived: the final drain takes over from here.
                        if (!isFinal && finishing) return;
                        const part = takePart(isFinal);
                        if (!part) return;
                        try {
                            await uploadPart(part);
                        } catch (e) {
                            failures++;
                            if (isFinal) finishFailures++;
                            if (isFinal || failures <= REPORTED_RETRIES) {
                                track('upload_part_failed', {
                                    part_number: part.partNumber, attempt: failures,
                                    final: isFinal, error_reason: reasonOf(e),
                                });
                            }
                            if (isFinal && failures < FINAL_ATTEMPTS && finishFailures < FINISH_RETRY_CAP && !stalled) {
                                await new Promise((r) => setTimer(r, backoffMs(failures)));
                                continue;
                            }
                            if (!isFinal && !finishing) scheduleRetry();
                            return;
                        }
                    }
                } finally {
                    pumping = null;
                }
            })();
            return pumping;
        }

        /** Returns { fileUrl, durationSec }, or null when there is no complete
         * upload to register — in which case the share page's local copy is
         * the recording, and it can upload that itself. */
        /** Puts the patched header into part 1 if part 1 has not gone up yet:
         * in the slice waiting to go, or at the front of the buffer. */
        function patchUnsentHeader(header) {
            if (record.parts.some((p) => p.partNumber === 1)) return;   // sent: fixed after the drain
            if (pending && pending.partNumber === 1) {
                if (uploadingPart === pending) return;                   // on its way: fixed after the drain
                pending.blob = new Blob([header, pending.blob.slice(header.length)]);
                return;
            }
            if (record.nextPart === 1 && buffered >= header.length) {
                const all = new Blob(buffer);
                buffer = [new Blob([header, all.slice(header.length)])];
            }
        }

        /** One PUT of `blob` as part 1, with retries. Resolves the ETag or null. */
        async function putFirstPart(target, blob) {
            for (let attempt = 1; attempt <= FINAL_ATTEMPTS; attempt++) {
                try {
                    const { uploadUrl } = await post('/recordings/upload/part', {
                        fileName: target.fileName, uploadId: target.uploadId, partNumber: 1,
                    });
                    const controller = new AbortController();
                    const timer = setTimer(() => controller.abort(new Error('part PUT timed out')), PART_TIMEOUT_MS);
                    let res;
                    try { res = await putPart(uploadUrl, blob, { signal: controller.signal }); } finally { clearTimer(timer); }
                    if (!res.ok || !res.etag) throw new Error(`part PUT failed: HTTP ${res.status}`);
                    return res.etag;
                } catch (e) {
                    if (attempt < FINAL_ATTEMPTS) await new Promise((r) => setTimer(r, backoffMs(attempt)));
                }
            }
            return null;
        }

        /** Part 1 went up before the header could be patched: send it again
         * with the patched header — the same length, so R2's equal-size rule
         * holds. If that keeps failing the recording is completed without the
         * index, never lost: the original part 1 is put back under a known
         * ETag first, in case a failed attempt did reach R2. */
        async function applyHeaderToSentPart(target, header) {
            if (!firstPartSent) return;
            const head = new Uint8Array(await firstPartSent.slice(0, header.length).arrayBuffer());
            if (head.length === header.length && head.every((v, i) => v === header[i])) return;
            const setEtag = (etag) => { target.parts = target.parts.map((p) => (p.partNumber === 1 ? { ...p, etag } : p)); };
            const patched = await putFirstPart(target, new Blob([header, firstPartSent.slice(header.length)]));
            if (patched) { setEtag(patched); return; }
            const restored = await putFirstPart(target, firstPartSent);
            if (restored) setEtag(restored);
            track('upload_index_skipped', { error_reason: restored ? 'reupload_failed' : 'reupload_and_restore_failed' });
        }

        async function finish({ header = null, trailer = null } = {}) {
            // A recording stopped within moments of starting can get here
            // before the upload has even opened.
            if (beginning) await beginning;
            accepting = false;
            if (retryTimer) { clearTimer(retryTimer); retryTimer = null; }
            if (!record) return null;
            // Stopped: recovery must not complete what is left of this upload
            // if the document dies during the drain below (see the header).
            record.stopped = true;
            await save();
            // The index goes at the very end; the header fix-up into part 1.
            if (trailer?.length) { buffer.push(new Blob([trailer])); buffered += trailer.length; }
            if (header?.length) patchUnsentHeader(header);
            failures = 0;
            finishFailures = 0;
            finishing = true;
            stalled = false;
            totalBytes = record.bytes + buffered + (pending?.blob.size ?? 0);
            moved();
            report('uploading');
            /* The stall limit: no bytes moving for STALL_LIMIT_MS ends the
             * drain, and the request under way is cancelled so it cannot hang
             * on. A slow upload that keeps moving is never cut off. */
            let watchdog = null;
            /* Counted two ways: by the clock, and by this check's own ticks.
             * Ticks can only run late, never early, so they cannot report a
             * stall that has not happened; the clock covers a throttled timer. */
            const watch = () => {
                watchdog = setTimer(() => {
                    idleTicks++;
                    if (now() - lastProgressAt >= STALL_LIMIT_MS || idleTicks * STALL_CHECK_MS >= STALL_LIMIT_MS) {
                        stalled = true;
                        inFlight?.abort(new Error('upload stalled'));
                        return;
                    }
                    watch();
                }, STALL_CHECK_MS);
            };
            watch();
            try {
                await pump(true);
            } finally {
                clearTimer(watchdog);
            }

            if (pending || buffered > 0 || record.parts.length === 0) {
                // Completing now would publish a recording with its end cut
                // off. Abandoned, not truncated.
                const nothingToSend = !pending && buffered === 0 && record.parts.length === 0;
                const reason = nothingToSend ? 'empty'
                    : stalled ? 'stalled'
                        : finishFailures >= FINISH_RETRY_CAP ? 'retries_exhausted' : 'part_failed';
                report('failed', reason);
                await abort(reason);
                return null;
            }

            const finished = record;
            // From here the user's recording is safe locally, so recovery must
            // never pick this upload up: see the header.
            await forget(finished.uploadId);
            if (header?.length) await applyHeaderToSentPart(finished, header);
            // The length is measured from when the upload opened: storage's
            // recordingStartTime has already been cleared by the time anything
            // downstream asks.
            const durationSec = Math.max(1, Math.round((now() - finished.startedAt) / 1000));
            report('completing');
            for (let attempt = 1; ; attempt++) {
                try {
                    const { fileUrl } = await post('/recordings/upload/complete', {
                        fileName: finished.fileName, uploadId: finished.uploadId,
                        parts: completionPayload(finished.parts),
                    });
                    report('done');
                    record = null;
                    finishing = false;
                    track('upload_completed', {
                        parts: finished.parts.length, file_size_mb: mb(finished.bytes),
                        duration_seconds: durationSec, recovered: false,
                        progress_save_failures: saveFailures,
                    });
                    return { fileUrl, durationSec };
                } catch (e) {
                    if (attempt >= FINAL_ATTEMPTS) {
                        report('failed', 'complete_failed');
                        await abort('complete_failed');
                        return null;
                    }
                    await new Promise((r) => setTimer(r, backoffMs(attempt)));
                }
            }
        }

        async function abort(reason = 'aborted') {
            reset();
            if (!record) return;
            const dropped = record;
            record = null;
            await forget(dropped.uploadId);
            try {
                await post('/recordings/upload/abort', { fileName: dropped.fileName, uploadId: dropped.uploadId });
            } catch { /* the bucket's 1-day multipart rule is the backstop */ }
            track('upload_failed', { error_reason: reason, progress_save_failures: saveFailures });
        }

        const status = () => ({ uploadId: record?.uploadId ?? null });

        return { begin, push, finish, abort, status };
    }

    const isRecoverable = (r) => r && typeof r.uploadId === 'string' && typeof r.fileName === 'string'
        && Array.isArray(r.parts) && r.parts.every((p) => Number.isInteger(p?.partNumber) && typeof p?.etag === 'string')
        && Number.isFinite(r.startedAt);

    /** Finalizes uploads whose recording never reached Stop.
     *
     * Run by the service worker each time it starts. `liveUploadId` is what the
     * offscreen document says it is uploading: undefined when it could not be
     * asked (touch nothing; try on the next start), null when there is no
     * upload in progress.
     *
     * A recording whose document died is completed from the parts already on
     * R2 — every part ends on a chunk boundary, so the file plays up to where
     * it stopped — and registered as a guest recording, which is what makes it
     * claimable. Each step is recorded before it is taken, so a worker killed
     * mid-recovery resumes rather than repeats: `completing` lets a retry
     * recognise an upload it already completed, and `recoveryId` makes a
     * repeated registration the same row rather than a second one. */
    async function recoverInterruptedUploads({
        store, apiBase, fetch: fetchFn, liveUploadId, register, track, now = () => Date.now(),
    }) {
        if (liveUploadId === undefined) return ['unknown'];
        // One id, or every upload the document still owns (a recording that
        // is finishing after Stop while the next one records).
        const live = new Set([liveUploadId].flat().filter(Boolean));
        const records = await store.list().catch(() => []);
        const post = apiPoster(apiBase, fetchFn);
        const objectExists = async (fileName) => {
            try {
                const res = await fetchFn(`${apiBase}/recordings/status/${encodeURIComponent(fileName)}`, {
                    signal: AbortSignal.timeout(API_TIMEOUT_MS),
                });
                return res.ok && (await res.json()).ready === true;
            } catch { return false; }
        };

        const outcomes = [];
        for (const record of records) {
            if (!isRecoverable(record)) {
                if (record?.uploadId) await store.remove(record.uploadId).catch(() => {});
                track('upload_failed', { error_reason: 'recovery_invalid_record', recovered: true });
                outcomes.push('invalid');
                continue;
            }
            if (live.has(record.uploadId)) { outcomes.push('live'); continue; }
            outcomes.push(await recoverOne(record));
        }
        return outcomes;

        async function recoverOne(record) {
            /* Stopped, then interrupted while its last parts were going up.
             * The user has the whole recording locally, and part 1 may carry
             * the patched header — a Duration for the full length and a seek
             * index past the last part that made it. Completing it would
             * publish a cut-off file that claims to be whole. */
            if (record.stopped === true) {
                await store.remove(record.uploadId).catch(() => {});
                await post('/recordings/upload/abort', { fileName: record.fileName, uploadId: record.uploadId }).catch(() => {});
                track('upload_failed', { error_reason: 'interrupted_after_stop', recovered: true });
                return 'abandoned';
            }
            if (record.parts.length === 0) {
                await store.remove(record.uploadId).catch(() => {});
                await post('/recordings/upload/abort', { fileName: record.fileName, uploadId: record.uploadId }).catch(() => {});
                track('upload_failed', { error_reason: 'interrupted_before_first_part', recovered: true });
                return 'aborted';
            }

            const durationSec = Math.max(1, Math.round(((record.lastPartAt ?? now()) - record.startedAt) / 1000));
            const wasCompleting = record.completing === true;
            const step = { ...record, completing: true, recoveryId: record.recoveryId ?? crypto.randomUUID() };
            await store.write(step).catch(() => {});

            let fileUrl = record.completedFileUrl ?? null;
            if (!fileUrl) {
                try {
                    ({ fileUrl } = await post('/recordings/upload/complete', {
                        fileName: record.fileName, uploadId: record.uploadId,
                        parts: completionPayload(record.parts),
                    }));
                } catch (e) {
                    // R2 answers NoSuchUpload for an upload that is already
                    // complete or already gone, which the API passes on as a
                    // 500. Only an earlier attempt of this recovery can have
                    // completed it — Stop forgets its record first — so only
                    // then does an existing object mean "done, register it".
                    if (wasCompleting && await objectExists(record.fileName)) {
                        fileUrl = record.fileName;
                    } else if (now() - record.startedAt > GONE_AFTER_MS) {
                        await store.remove(record.uploadId).catch(() => {});
                        track('upload_failed', { error_reason: 'recovery_upload_gone', recovered: true });
                        return 'gone';
                    } else {
                        track('upload_failed', { error_reason: 'recovery_complete_failed', detail: reasonOf(e), recovered: true });
                        return 'retry';
                    }
                }
                await store.write({ ...step, completedFileUrl: fileUrl }).catch(() => {});
            }

            /* 'created' and 'exists' (the server handing back a row an earlier
             * attempt made) are both success. So is 'conflict': the id is
             * recovery's own random one, written down before the first
             * attempt, so the row that holds it is the one an earlier attempt
             * registered — and the server now refuses it to us because its
             * owner changed, which is what claiming does. Registering again
             * under a new id would be exactly the duplicate this avoids. */
            const registration = await register(step.recoveryId, fileUrl, durationSec);
            if (registration === 'unauthorized') {
                // Kept, not registered as a guest: the next start tries again,
                // after the user has signed in.
                track('upload_failed', { error_reason: 'recovery_session_expired', recovered: true });
                return 'retry';
            }
            if (registration !== 'created' && registration !== 'exists' && registration !== 'conflict') {
                track('upload_failed', { error_reason: 'recovery_register_failed', recovered: true });
                return 'retry';
            }
            await store.remove(record.uploadId).catch(() => {});
            track('upload_completed', {
                parts: record.parts.length, file_size_mb: mb(record.bytes ?? 0),
                duration_seconds: durationSec, recovered: true, registration,
            });
            return 'finalized';
        }
    }

    globalThis.SnapRecStreamUpload = { createStreamUploader, recoverInterruptedUploads, idbUploadStore };
})();

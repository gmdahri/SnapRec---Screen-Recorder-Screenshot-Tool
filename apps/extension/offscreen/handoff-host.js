/** The offscreen document's side of a finished recording.
 *
 * Stop no longer waits for the upload: the share tab opens at once, and from
 * then on this holds each stopped recording until three things are settled —
 * the page has it, its upload has finished or failed, and its background
 * IndexedDB copy is written or has failed — and then says it is idle.
 *
 * The page gets the recording from the courier frame (handoff/handoff.js),
 * which asks for it here over a BroadcastChannel. Both are extension-origin
 * documents, and a Blob crosses a BroadcastChannel and then postMessage by
 * reference: measured in Chrome with a 3 GB recording, the hand-off added
 * about 5 MB to any process and nothing on disk. So the page no longer waits
 * for a multi-gigabyte IndexedDB write before it can play the recording; that
 * write still happens, in the background, as the fallback for a frame that
 * cannot reach this document.
 *
 * Classic script, loaded by offscreen.html before offscreen.js. */
(() => {
    const CHANNEL = 'snaprec-handoff';
    /** A recording nobody has taken this long after Stop is not waited for
     * any more: the worker that would have said "the tab closed" may itself
     * have been stopped, and this document must not hold gigabytes for ever.
     * Its upload and IndexedDB copy still finish. */
    const DELIVERY_GRACE_MS = 10 * 60 * 1000;
    /** How often an unsettled upload says it is still going. The page gives
     * up on silence after several of these (ShareView's EXTENSION_SILENT_MS). */
    const KEEP_ALIVE_MS = 10 * 1000;

    /** `channel` is a BroadcastChannel (or a stand-in with postMessage and
     * onmessage). Everything that touches the outside is passed in, so the
     * whole lifecycle runs under test. */
    function createHandoffHost({
        channel, onIdle = () => {}, log = () => {},
        deliveryGraceMs = DELIVERY_GRACE_MS, keepAliveMs = KEEP_ALIVE_MS, setTimer = setTimeout,
    }) {
        const sessions = new Map();   // recording id -> session

        const send = (message) => { try { channel.postMessage(message); } catch (e) { log('channel post failed', e?.message); } };

        function maybeIdle() {
            for (const [id, s] of sessions) {
                if ((s.delivered || s.handoffGaveUp) && s.uploadSettled && s.parkSettled) sessions.delete(id);
            }
            if (sessions.size === 0) onIdle();
        }

        channel.onmessage = (event) => {
            const m = event.data;
            const s = m && typeof m.id === 'string' ? sessions.get(m.id) : null;
            // Only the recording asked for, by its own id. A frame that does
            // not know the id gets nothing.
            if (!s) return;
            if (m.type === 'want') {
                send({ type: 'recording', id: m.id, blob: s.blob, metadataStr: s.metadataStr });
                if (s.lastProgress) send({ type: 'progress', id: m.id, ...s.lastProgress });
                if (s.saved !== undefined) send({ type: 'saved', id: m.id, ok: s.saved });
            } else if (m.type === 'delivered') {
                s.delivered = true;
                maybeIdle();
            }
        };

        /** Starts the background work for one stopped recording.
         *  - persist(): the IndexedDB copy; resolves or rejects.
         *  - finish(onProgress): the upload; resolves { fileUrl, durationSec } or null.
         *  - register(result): resolves the registration outcome. */
        function start({ id, blob, metadataStr, persist, finish, register }) {
            const s = {
                blob, metadataStr, delivered: false, handoffGaveUp: false,
                uploadSettled: false, parkSettled: false, lastProgress: null, saved: undefined,
            };
            sessions.set(id, s);
            setTimer(() => {
                if (!sessions.has(id) || s.delivered) return;
                log('not delivered in time; no longer holding it for a page', id);
                s.handoffGaveUp = true;
                maybeIdle();
            }, deliveryGraceMs);
            const progress = (p) => {
                s.lastProgress = p;
                send({ type: 'progress', id, ...p });
            };
            /* Until the upload settles, the last report again every few
             * seconds: re-sending part 1 or retrying completion can go minutes
             * without new progress, and the page takes silence to mean the
             * document is gone. */
            const keepAlive = () => setTimer(() => {
                if (s.uploadSettled) return;
                send({ type: 'progress', id, ...(s.lastProgress ?? { state: 'uploading' }) });
                keepAlive();
            }, keepAliveMs);
            keepAlive();

            Promise.resolve().then(persist).then(
                () => { s.saved = true; },
                (e) => { s.saved = false; log('background save failed', e?.message); },
            ).finally(() => {
                send({ type: 'saved', id, ok: s.saved });
                s.parkSettled = true;
                maybeIdle();
            });

            Promise.resolve().then(() => finish(progress)).then(async (result) => {
                if (!result) {
                    // Nothing to register: the upload failed (its own progress
                    // already said why) or never opened.
                    if (!s.lastProgress || s.lastProgress.state !== 'failed') progress({ state: 'failed', reason: 'no_upload' });
                    return;
                }
                progress({ state: 'registering', uploadedBytes: s.lastProgress?.uploadedBytes, totalBytes: s.lastProgress?.totalBytes });
                const outcome = await register(result).catch(() => 'failed');
                if (outcome === 'created' || outcome === 'exists') {
                    progress({ state: 'registered', recordingId: id });
                } else {
                    progress({ state: 'failed', reason: outcome === 'unauthorized' ? 'session_expired' : 'register_failed' });
                }
            }).catch((e) => {
                progress({ state: 'failed', reason: 'finish_error' });
                log('finish failed', e?.message);
            }).finally(() => {
                s.uploadSettled = true;
                maybeIdle();
            });
        }

        /** The worker saved the recording to disk after the page never took
         * it: nothing is waiting on delivery any more. */
        function handoffSettled(id) {
            const s = sessions.get(id);
            if (!s) return;
            s.handoffGaveUp = true;
            maybeIdle();
        }

        const busy = () => sessions.size > 0;
        const recordingFor = (id) => sessions.get(id)?.blob ?? null;

        return { start, handoffSettled, busy, recordingFor };
    }

    globalThis.SnapRecHandoffHost = { CHANNEL, createHandoffHost };
})();

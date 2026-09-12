/** Carries a finished capture across the origin boundary, by reference.
 *
 * The share page is https://www.snaprecorder.org and the capture is parked in
 * chrome-extension:// IndexedDB, which that page cannot read. This document is
 * same-origin with the offscreen document that parked it and is embedded as a
 * hidden frame in the share page, so it can read the blob and hand it upward.
 *
 * A Blob crosses postMessage BY REFERENCE — the bytes are not copied. That is
 * the entire point. The previous design marshalled the capture through
 * chrome.runtime and chrome.scripting in 512 KB chunks, each one an array of
 * 524,288 boxed numbers serialised twice, which took minutes for an hour-long
 * recording and was killed by a 60-second timer long before it finished.
 *
 * Posts to an exact origin, never '*': this frame is embedded in a page and
 * the capture is the user's private screen recording. */

const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
/* Defaults to video so the recording handoff, which sends no kind, behaves
 * exactly as before. */
const kind = params.get('kind') === 'image' ? 'image' : 'video';
const KEYS = kind === 'image'
    ? { blob: 'latest_image_blob', meta: 'latest_image_meta', type: 'SNAPREC_EDIT_IMAGE' }
    : { blob: 'latest_video_blob', meta: 'latest_metadata', type: 'SNAPREC_VIDEO_DATA' };

function readParked() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnapRecDB', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings');
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                reject(new Error('no store'));
                return;
            }
            const store = db.transaction(['recordings'], 'readonly').objectStore('recordings');
            const blobReq = store.get(KEYS.blob);
            blobReq.onsuccess = () => {
                const metaReq = store.get(KEYS.meta);
                metaReq.onsuccess = () => resolve({
                    blob: blobReq.result instanceof Blob ? blobReq.result : null,
                    metadataStr: metaReq.result ?? null,
                });
                metaReq.onerror = () => resolve({ blob: blobReq.result ?? null, metadataStr: null });
            };
            blobReq.onerror = () => reject(new Error('read failed'));
        };

        request.onerror = () => reject(new Error('open failed'));
    });
}

/** Delivers until the page confirms, because the page may not be listening yet.
 *
 * The courier is injected as soon as the tab reports "complete", which is
 * before React has mounted and attached its message listener. A single
 * postMessage lands in that gap and is lost — the editor sat on "Waiting for
 * an image from the extension" while the capture was sitting right here.
 *
 * Re-posting is nearly free: a Blob crosses postMessage by reference, so this
 * re-sends a handle, not 700 MB. Stops on the first ack, or after ten seconds,
 * whichever comes first. */
let acknowledged = false;
window.addEventListener('message', (event) => {
    if (event.data?.type === 'SNAPREC_HANDOFF_ACK' && event.data.id === id) {
        acknowledged = true;
        console.log('[Handoff] Page acknowledged the capture');
    }
});

const RETRY_MS = 250;
const MAX_ATTEMPTS = 40;

(async () => {
    try {
        const { blob, metadataStr } = await readParked();
        if (!blob) throw new Error('nothing parked');

        for (let attempt = 0; attempt < MAX_ATTEMPTS && !acknowledged; attempt++) {
            parent.postMessage(
                { type: KEYS.type, blob, id, metadataStr },
                CONFIG.WEB_BASE_URL,
            );
            if (attempt === 0) console.log('[Handoff] Delivered capture, size:', blob.size);
            await new Promise((r) => setTimeout(r, RETRY_MS));
        }
        if (!acknowledged) {
            // Nobody is holding this capture. Tell the service worker so it can
            // fall back to the browser's Downloads folder — the only remaining
            // place to put it.
            console.warn('[Handoff] No acknowledgement after',
                (MAX_ATTEMPTS * RETRY_MS) / 1000, 'seconds; falling back to disk');
            chrome.runtime.sendMessage({ action: 'handoffFailed', kind, id });
        }
    } catch (error) {
        console.error('[Handoff] Could not deliver capture:', error.message);
    }
})();

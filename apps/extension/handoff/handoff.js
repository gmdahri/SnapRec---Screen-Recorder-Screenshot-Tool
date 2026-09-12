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
            const blobReq = store.get('latest_video_blob');
            blobReq.onsuccess = () => {
                const metaReq = store.get('latest_metadata');
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

(async () => {
    try {
        const { blob, metadataStr } = await readParked();
        if (!blob) throw new Error('nothing parked');
        parent.postMessage(
            { type: 'SNAPREC_VIDEO_DATA', blob, id, metadataStr },
            CONFIG.WEB_BASE_URL,
        );
        console.log('[Handoff] Delivered capture, size:', blob.size);
    } catch (error) {
        console.error('[Handoff] Could not deliver capture:', error.message);
    }
})();

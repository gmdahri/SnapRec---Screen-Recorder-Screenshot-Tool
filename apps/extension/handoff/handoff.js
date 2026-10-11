/** Carries a finished capture across the origin boundary, by reference.
 *
 * The share page is https://www.snaprecorder.org and the capture lives in the
 * extension's origin, which that page cannot read. This document is
 * extension-origin and is embedded as a hidden frame in the share page, so it
 * can fetch the capture and hand it upward.
 *
 * A Blob crosses postMessage BY REFERENCE — the bytes are not copied. That is
 * the entire point. The previous design marshalled the capture through
 * chrome.runtime and chrome.scripting in 512 KB chunks, each one an array of
 * 524,288 boxed numbers serialised twice, which took minutes for an hour-long
 * recording and was killed by a 60-second timer long before it finished.
 *
 * A recording comes from the offscreen document over a BroadcastChannel (see
 * offscreen/handoff-host.js): nothing has to be written to IndexedDB before
 * the page can play it. The IndexedDB copy is the fallback, for when that
 * document is gone. Screenshots still come from IndexedDB.
 *
 * Who it talks to:
 *  - only a parent page on the SnapRec web origins (snaprecorder.org and its
 *    www. counterpart, from CONFIG.WEB_BASE_URL). Embedded anywhere else it
 *    does nothing at all;
 *  - always posting to that exact origin, never '*': the capture is the
 *    user's private screen recording;
 *  - acknowledgements only from that parent window and origin. */

const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
/* Defaults to video so the recording handoff, which sends no kind, behaves
 * exactly as before. */
const kind = params.get('kind') === 'image' ? 'image' : 'video';
const KEYS = kind === 'image'
    ? { blob: 'latest_image_blob', meta: 'latest_image_meta', id: 'latest_image_id', type: 'SNAPREC_EDIT_IMAGE' }
    : { blob: 'latest_video_blob', meta: 'latest_metadata', id: 'latest_id', type: 'SNAPREC_VIDEO_DATA' };

const CHANNEL = 'snaprec-handoff';
/** How long the page has to acknowledge, counted from the first delivery —
 * once the capture is in hand. Fetching it can be slow on a slow machine;
 * that time is not counted, and the page hears "still coming" meanwhile. */
const HANDOFF_TIMEOUT_MS = Number(CONFIG.HANDOFF_TIMEOUT_MS) > 0 ? Number(CONFIG.HANDOFF_TIMEOUT_MS) : 15_000;
/** How long to wait for the offscreen document before reading IndexedDB. */
const HOST_WAIT_MS = 2_000;
const RETRY_MS = 250;
const HEARTBEAT_MS = 1_000;

/** The web origins this frame may hand a capture to. */
function allowedPageOrigins(webBase) {
    const origins = new Set();
    try {
        const u = new URL(webBase);
        origins.add(u.origin);
        const host = u.hostname;
        const isName = host.includes('.') && !/^[\d.]+$/.test(host);
        if (isName) {
            const twin = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
            origins.add(`${u.protocol}//${twin}${u.port ? `:${u.port}` : ''}`);
        }
    } catch { /* no usable base URL: nothing is allowed */ }
    return origins;
}

const pageOrigin = location.ancestorOrigins?.[0] ?? null;
const allowed = Boolean(pageOrigin) && allowedPageOrigins(CONFIG.WEB_BASE_URL).has(pageOrigin);
const toPage = (message) => parent.postMessage(message, pageOrigin);

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
            const idReq = store.get(KEYS.id);
            blobReq.onsuccess = () => {
                const metaReq = store.get(KEYS.meta);
                metaReq.onsuccess = () => resolve({
                    blob: blobReq.result instanceof Blob ? blobReq.result : null,
                    parkedId: idReq.result ?? null,
                    metadataStr: metaReq.result ?? null,
                });
                metaReq.onerror = () => resolve({ blob: blobReq.result ?? null, parkedId: idReq.result ?? null, metadataStr: null });
            };
            blobReq.onerror = () => reject(new Error('read failed'));
        };

        request.onerror = () => reject(new Error('open failed'));
    });
}

/** The recording from the offscreen document, or null if it does not answer.
 * Progress and the background save's result are passed on to the page as they
 * arrive, for as long as this frame lives. */
function fromHost(channel) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), HOST_WAIT_MS);
        channel.onmessage = (event) => {
            const m = event.data;
            if (!m || m.id !== id) return;
            if (m.type === 'recording') {
                clearTimeout(timer);
                resolve({ blob: m.blob, metadataStr: m.metadataStr ?? null });
            } else if (m.type === 'progress') {
                const { type: _t, ...progress } = m;
                toPage({ type: 'SNAPREC_UPLOAD_PROGRESS', ...progress });
            } else if (m.type === 'saved') {
                toPage({ type: 'SNAPREC_LOCAL_SAVE', id, ok: Boolean(m.ok) });
            }
        };
        channel.postMessage({ type: 'want', id });
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
 * re-sends a handle, not 700 MB. */
let acknowledged = false;
window.addEventListener('message', (event) => {
    // Only the page this frame was put in, on an allowed origin.
    if (!allowed || event.source !== parent || event.origin !== pageOrigin) return;
    if (event.data?.type === 'SNAPREC_HANDOFF_ACK' && event.data.id === id) {
        acknowledged = true;
        console.log('[Handoff] Page acknowledged the capture');
    }
});

(async () => {
    if (!allowed) {
        console.error('[Handoff] Not on a SnapRec page; delivering nothing');
        return;
    }
    let channel = null;
    let heartbeat = null;
    try {
        if (kind === 'video') {
            // "Still coming", so a page on a slow machine does not give up
            // while the capture is being fetched.
            toPage({ type: 'SNAPREC_HANDOFF_PENDING', id });
            heartbeat = setInterval(() => toPage({ type: 'SNAPREC_HANDOFF_PENDING', id }), HEARTBEAT_MS);
        }

        let capture = null;
        if (kind === 'video' && typeof BroadcastChannel === 'function') {
            channel = new BroadcastChannel(CHANNEL);
            capture = await fromHost(channel);
        }
        if (!capture) {
            const { blob, parkedId, metadataStr } = await readParked();
            if (!blob) throw new Error('nothing parked');
            /* Only the capture this frame was sent for. One slot holds the latest
             * capture: if this one was never parked (its save failed) or a newer
             * one has replaced it, the slot holds someone else's recording —
             * never delivered in its place, and not reported as a failed
             * handoff either, which would save that other recording to disk. */
            if (id && parkedId !== id) {
                console.error('[Handoff] The parked capture belongs to another recording; not delivering it');
                return;
            }
            capture = { blob, metadataStr };
        }

        const attempts = Math.ceil(HANDOFF_TIMEOUT_MS / RETRY_MS);
        for (let attempt = 0; attempt < attempts && !acknowledged; attempt++) {
            toPage({ type: KEYS.type, blob: capture.blob, id, metadataStr: capture.metadataStr });
            if (attempt === 0) console.log('[Handoff] Delivered capture, size:', capture.blob.size);
            await new Promise((r) => setTimeout(r, RETRY_MS));
        }
        clearInterval(heartbeat);
        heartbeat = null;
        if (acknowledged) {
            channel?.postMessage({ type: 'delivered', id });
        } else {
            console.warn('[Handoff] No acknowledgement after', HANDOFF_TIMEOUT_MS / 1000, 'seconds; falling back to disk');
            channel?.postMessage({ type: 'gave_up', id });
            chrome.runtime.sendMessage({ action: 'handoffFailed', kind, id });
        }
        // The channel stays open: upload progress keeps reaching the page.
    } catch (error) {
        console.error('[Handoff] Could not deliver capture:', error.message);
    } finally {
        if (heartbeat) clearInterval(heartbeat);
    }
})();

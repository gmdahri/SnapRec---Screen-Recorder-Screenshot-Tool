/** The gate every capture passes through on its way into the share view.
 *
 * The share view used to accept a SNAPREC_VIDEO_DATA message from any origin,
 * so any cross-origin frame on the page could hand the user a video. It now
 * accepts two senders and no others: SnapRec's own handoff iframe, and the
 * page itself.
 *
 * "SnapRec's own" means the extension's id, not any chrome-extension:// origin:
 * the Chrome Web Store id, VITE_EXTENSION_ID, and any extra ids listed in
 * VITE_EXTENSION_IDS (comma-separated, for a build tested against an unpacked
 * copy). A development build accepts any extension, because an unpacked
 * extension's id is different on every machine.
 *
 * The same-origin allowance exists only for extensions at v2.0.6 and earlier,
 * which post from the page's main world through an injected script. Drop it
 * once Chrome Web Store telemetry shows that version is no longer in use — it
 * is the weaker half of this check. */

export type UploadState = 'uploading' | 'completing' | 'registering' | 'registered' | 'failed';

export type HandoffPayload =
    | { kind: 'blob'; blob: Blob; id?: string; metadataStr?: string }
    /** The courier is fetching the capture: it is coming. */
    | { kind: 'pending'; id?: string }
    /** The upload finishing in the background after Stop. */
    | { kind: 'progress'; id?: string; state: UploadState; uploadedBytes?: number; totalBytes?: number; reason?: string }
    /** Whether the extension's own copy of the capture was saved. */
    | { kind: 'localSave'; id?: string; ok: boolean }
    | { kind: 'idb'; id?: string }
    | { kind: 'dataUrl'; dataUrl: string; id?: string }
    | { kind: 'image'; blob: Blob; id?: string }
    | { kind: 'imageDataUrl'; dataUrl: string; id?: string };

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;
/** The Chrome Web Store listing's id. */
export const STORE_EXTENSION_ID = 'lgafjgnifbjeafallnkkfpljgbilfajg';

/** Which chrome-extension:// origins count as SnapRec. null: any (a
 * development build). */
export function trustedExtensionOrigins(
    env: { DEV?: boolean; VITE_EXTENSION_ID?: string; VITE_EXTENSION_IDS?: string } = import.meta.env,
): Set<string> | null {
    if (env.DEV) return null;
    const ids = [STORE_EXTENSION_ID, env.VITE_EXTENSION_ID, ...(env.VITE_EXTENSION_IDS ?? '').split(',')]
        .map((id) => (id ?? '').trim())
        .filter((id) => /^[a-p]{32}$/.test(id));
    return new Set(ids.map((id) => `chrome-extension://${id}`));
}

const UPLOAD_STATES: UploadState[] = ['uploading', 'completing', 'registering', 'registered', 'failed'];
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

export function readHandoffMessage(
    origin: string,
    data: unknown,
    selfOrigin: string,
    trusted: Set<string> | null = trustedExtensionOrigins(),
): HandoffPayload | null {
    const fromExtension = EXTENSION_ORIGIN.test(origin) && (trusted === null || trusted.has(origin));
    if (origin !== selfOrigin && !fromExtension) return null;
    if (typeof data !== 'object' || data === null) return null;

    const msg = data as Record<string, unknown>;
    const id = typeof msg.id === 'string' ? msg.id : undefined;

    // Only the extension's courier sends these; never accepted from the page itself.
    if (fromExtension && msg.type === 'SNAPREC_HANDOFF_PENDING') return { kind: 'pending', id };
    if (fromExtension && msg.type === 'SNAPREC_LOCAL_SAVE') return { kind: 'localSave', id, ok: msg.ok === true };
    if (fromExtension && msg.type === 'SNAPREC_UPLOAD_PROGRESS') {
        const state = msg.state as UploadState;
        if (!UPLOAD_STATES.includes(state)) return null;
        return {
            kind: 'progress', id, state,
            uploadedBytes: count(msg.uploadedBytes), totalBytes: count(msg.totalBytes),
            reason: typeof msg.reason === 'string' ? msg.reason.slice(0, 40) : undefined,
        };
    }

    const isVideo = msg.type === 'SNAPREC_VIDEO_DATA';
    const isImage = msg.type === 'SNAPREC_EDIT_IMAGE';
    if (!isVideo && !isImage) return null;

    if (isImage) {
        if (msg.blob instanceof Blob) return { kind: 'image', blob: msg.blob, id };
        if (typeof msg.dataUrl === 'string' && msg.dataUrl) {
            return { kind: 'imageDataUrl', dataUrl: msg.dataUrl, id };
        }
        return null;
    }

    // Order is deliberate: a Blob is the whole capture in hand, so it wins over
    // a signal that merely says where to go looking for one.
    if (msg.blob instanceof Blob) {
        // Carried through rather than parsed here: the video editor reads it
        // back out of sessionStorage (VideoEditorContext.tsx:391), and a
        // capture must not be refused because its click metadata is malformed.
        const metadataStr = typeof msg.metadataStr === 'string' ? msg.metadataStr : undefined;
        return { kind: 'blob', blob: msg.blob, id, metadataStr };
    }
    if (msg.fromIDB === true) return { kind: 'idb', id };
    if (typeof msg.dataUrl === 'string' && msg.dataUrl) {
        return { kind: 'dataUrl', dataUrl: msg.dataUrl, id };
    }
    return null;
}

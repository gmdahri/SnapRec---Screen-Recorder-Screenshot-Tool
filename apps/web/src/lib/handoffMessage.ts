/** The gate every capture passes through on its way into the share view.
 *
 * The share view used to accept a SNAPREC_VIDEO_DATA message from any origin,
 * so any cross-origin frame on the page could hand the user a video. It now
 * accepts two senders and no others: the extension's own handoff iframe, which
 * is a chrome-extension:// origin, and the page itself.
 *
 * The same-origin allowance exists only for extensions at v2.0.6 and earlier,
 * which post from the page's main world through an injected script. Drop it
 * once Chrome Web Store telemetry shows that version is no longer in use — it
 * is the weaker half of this check. */

export type HandoffPayload =
    | { kind: 'blob'; blob: Blob; id?: string; metadataStr?: string }
    | { kind: 'idb'; id?: string }
    | { kind: 'dataUrl'; dataUrl: string; id?: string };

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export function readHandoffMessage(
    origin: string,
    data: unknown,
    selfOrigin: string,
): HandoffPayload | null {
    if (origin !== selfOrigin && !EXTENSION_ORIGIN.test(origin)) return null;
    if (typeof data !== 'object' || data === null) return null;

    const msg = data as Record<string, unknown>;
    if (msg.type !== 'SNAPREC_VIDEO_DATA') return null;

    const id = typeof msg.id === 'string' ? msg.id : undefined;

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

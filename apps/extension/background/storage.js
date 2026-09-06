
/**
 * Main function to handle upload to Cloudflare R2 via our NestJS backend
 * @param {string} dataUrl - The data URL of the image or video
 * @param {string} filename - Desired filename
 * @param {string} mimeType - MIME type of the content
 */
async function uploadToR2(dataUrl, filename, mimeType) {
    try {
        console.log('Starting R2 upload process...');

        const blob = await (await fetch(dataUrl)).blob();
        const headers = await uploadHeaders();
        // 1. Request presigned URL from our backend
        const response = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload-url`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                fileName: filename,
                contentType: mimeType,
                sizeBytes: blob.size,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to get presigned URL from backend');
        }

        const { uploadUrl, fileUrl } = await response.json();
        console.log('Received presigned URL');

        // 2. Convert Data URL to Blob
        // 3. Upload directly to Cloudflare R2
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType.split(';')[0],
                'If-None-Match': '*',
            },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file to R2');
        }

        console.log('File uploaded to R2 successfully');

        // 4. Save metadata to backend
        const metaResponse = await fetch(`${CONFIG.API_BASE_URL}/recordings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: filename,
                fileUrl,
                type: mimeType.includes('video') ? 'video' : 'screenshot',
            }),
        });

        if (!metaResponse.ok) {
            console.warn('Metadata saving failed, but file is uploaded.');
            throw new Error('Upload saved but registration failed. Your local capture is still available.');
        }

        const recording = await metaResponse.json();
        await rememberGuestCapture(recording.id, headers);
        console.log('Metadata saved to database');

        return {
            success: true,
            id: recording.id,
            shareUrl: `${CONFIG.WEB_BASE_URL}/v/${recording.id}`
        };

    } catch (error) {
        console.error('R2 Upload Error:', error);
        return { success: false, error: error.message };
    }
}

// Export for use in background service worker
if (typeof module !== 'undefined') {
    module.exports = { uploadToR2 };
}


/** A stable id for this install while signed out.
 *
 * Without one the server has no way to tell whose ownerless capture is whose,
 * which is what made every un-owned recording claimable by anyone holding its
 * id. Generated once and kept in chrome.storage.local. */
async function getGuestId() {
    const { snaprecGuestId } = await chrome.storage.local.get('snaprecGuestId');
    if (snaprecGuestId) return snaprecGuestId;

    const id = `guest_${crypto.randomUUID()}`;
    await chrome.storage.local.set({ snaprecGuestId: id });
    return id;
}

/**
 * Upload a queued capture, reporting byte-level progress.
 *
 * Uses XMLHttpRequest rather than fetch because fetch has no upload-progress
 * event, and B2's "62% · 4.3 of 6.9 MB" label depends on one. Do not
 * "modernise" this back to fetch.
 *
 * R2 presigned PUTs do not support ranged resume, so a retry re-sends the
 * whole blob — but the *user-facing* progress resumes from where it stopped,
 * because re-watching a bar crawl from zero is the part that feels broken.
 * Revisit if captures routinely exceed ~100 MB.
 *
 * @param {{id: string, fileName: string, dataUrl: string, mimeType: string}} item
 * @param {(pct: number, bytes: number) => void} onProgress
 * @returns {Promise<string>} the share URL
 */
async function uploadHeaders() {
    const stored = await chrome.storage.local.get('snaprecUploadSecret');
    const secret = stored.snaprecUploadSecret || crypto.randomUUID();
    if (!stored.snaprecUploadSecret) await chrome.storage.local.set({ snaprecUploadSecret: secret });
    return { 'Content-Type': 'application/json', 'X-Snaprec-Guest': secret, ...(await getAuthHeaders()) };
}

async function uploadQueuedCapture(item, onProgress) {
    const blob = await (await fetch(item.dataUrl)).blob();
    const headers = await uploadHeaders();
    const presign = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileName: item.fileName, contentType: item.mimeType, sizeBytes: blob.size }),
    });
    if (!presign.ok) throw new Error('presign');

    const { uploadUrl, fileUrl } = await presign.json();

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', item.mimeType.split(';')[0]);
        xhr.setRequestHeader('If-None-Match', '*');
        xhr.timeout = 300000;
        xhr.addEventListener('timeout', () => reject(new Error('Upload timed out. Retry from your local capture.')));

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100), e.loaded);
            }
        });
        xhr.addEventListener('load', () => (
            xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`))));
        xhr.addEventListener('error', () => reject(new Error('network')));
        xhr.addEventListener('abort', () => reject(new Error('cancelled')));
        xhr.send(blob);
    });

    const meta = await fetch(`${CONFIG.API_BASE_URL}/recordings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            title: item.title ?? item.fileName,
            fileUrl,
            type: item.mimeType.includes('video') ? 'video' : 'screenshot',
            guestId: await getGuestId(),
        }),
    });
    if (!meta.ok) throw new Error('metadata');

    const saved = await meta.json();
    await rememberGuestCapture(saved.id, headers);
    return `${CONFIG.WEB_BASE_URL}/v/${saved.id ?? saved.shortId ?? ''}`;
}

async function rememberGuestCapture(id, headers) {
    if (!id || headers.Authorization) return;
    const stored = await chrome.storage.local.get('snaprecGuestRecordingIds');
    await chrome.storage.local.set({ snaprecGuestRecordingIds: [...new Set([...(stored.snaprecGuestRecordingIds || []), id])] });
}
async function claimExtensionCaptures() {
    const stored = await chrome.storage.local.get(['snaprecGuestRecordingIds', 'snaprecUploadSecret']);
    if (!stored.snaprecGuestRecordingIds?.length || !stored.snaprecUploadSecret) return;
    const response = await fetch(`${CONFIG.API_BASE_URL}/recordings/claim`, {
        method: 'POST', headers: await uploadHeaders(),
        body: JSON.stringify({ recordingIds: stored.snaprecGuestRecordingIds }),
    });
    if (!response.ok) return;
    const { claimed = [] } = await response.json();
    await chrome.storage.local.set({ snaprecGuestRecordingIds: stored.snaprecGuestRecordingIds.filter(id => !claimed.includes(id)) });
}

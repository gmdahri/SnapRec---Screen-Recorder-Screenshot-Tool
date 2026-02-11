// Redundant API_BASE_URL removed, using CONFIG.API_BASE_URL

/**
 * Main function to handle upload to Cloudflare R2 via our NestJS backend
 * @param {string} dataUrl - The data URL of the image or video
 * @param {string} filename - Desired filename
 * @param {string} mimeType - MIME type of the content
 */
async function uploadToR2(dataUrl, filename, mimeType) {
    try {
        console.log(`[SnapRec] uploadToR2: Starting upload for ${filename}, dataUrl length: ${dataUrl?.length || 0}`);

        if (!dataUrl || dataUrl.length < 100) {
            console.error('[SnapRec] uploadToR2: Invalid or too short dataUrl');
            return { success: false, error: 'Invalid data URL' };
        }
        // 1. Request presigned URL from our backend
<<<<<<< HEAD
<<<<<<< HEAD
        const response = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload-url`, {
=======
        const response = await fetch(`${API_BASE_URL}/recordings/upload-url`, {
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
=======
        const urlResponse = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload-url`, {
>>>>>>> 202c2cd (fix: resolve blank image uploads, database entry failure, and editor UI refinements)
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: filename,
                contentType: mimeType,
            }),
        });

        if (!urlResponse.ok) {
            throw new Error('Failed to get presigned URL from backend');
        }

        const { uploadUrl, fileUrl } = await urlResponse.json();
        console.log('Received presigned URL and file URL:', fileUrl);

        // 2. Create database entry IMMEDIATELY
        const { snaprecSession } = await chrome.storage.local.get('snaprecSession');
        const { guestId } = await chrome.storage.local.get('guestId');

        const headers = {
            'Content-Type': 'application/json',
        };
        if (snaprecSession?.accessToken) {
            headers['Authorization'] = `Bearer ${snaprecSession.accessToken}`;
        }

<<<<<<< HEAD
        console.log('File uploaded to R2 successfully');

        // 4. Save metadata to backend
<<<<<<< HEAD
=======
>>>>>>> 202c2cd (fix: resolve blank image uploads, database entry failure, and editor UI refinements)
        const metaResponse = await fetch(`${CONFIG.API_BASE_URL}/recordings`, {
=======
        const metaResponse = await fetch(`${API_BASE_URL}/recordings`, {
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: filename,
                type: 'screenshot',
                fileUrl: fileUrl,
                userId: snaprecSession?.user?.id,
                guestId: !snaprecSession ? (guestId || `guest_${Math.random().toString(36).substring(7)}`) : undefined,
            }),
        });

        if (!metaResponse.ok) {
            throw new Error('Failed to create database entry');
        }

        const recording = await metaResponse.json();
        console.log('Database entry created:', recording.id);

        // 3. Start R2 upload in the background (don't await it)
        (async () => {
            try {
                console.log('[SnapRec] uploadToR2: Fetching blob from dataUrl...');
                const blobResponse = await fetch(dataUrl);
                const blob = await blobResponse.blob();
                console.log(`[SnapRec] uploadToR2: Blob created, size: ${blob.size} bytes, type: ${blob.type}`);

                if (blob.size === 0) {
                    throw new Error('Created blob is empty (0 bytes)');
                }

                console.log('[SnapRec] Starting background upload to R2...');
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': mimeType,
                    },
                    body: blob,
                });

                if (!uploadResponse.ok) {
                    console.error('Background R2 upload failed');
                } else {
                    console.log('Background R2 upload successful');
                }
            } catch (error) {
                console.error('Error in background screenshot upload:', error);
            }
        })();

        // 4. Return immediately with the share URL
        return {
            success: true,
            id: recording.id,
<<<<<<< HEAD
            shareUrl: `${CONFIG.WEB_BASE_URL}/v/${recording.id}`
=======
            shareUrl: `${API_BASE_URL.replace(':3001', ':5173')}/v/${recording.id}`
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
        };

    } catch (error) {
        console.error('R2 fast upload error:', error);
        return { success: false, error: error.message };
    }
}

// Export for use in background service worker
if (typeof module !== 'undefined') {
    module.exports = { uploadToR2 };
}

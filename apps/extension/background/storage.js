const API_BASE_URL = 'http://localhost:3001';

/**
 * Main function to handle upload to Cloudflare R2 via our NestJS backend
 * @param {string} dataUrl - The data URL of the image or video
 * @param {string} filename - Desired filename
 * @param {string} mimeType - MIME type of the content
 */
async function uploadToR2(dataUrl, filename, mimeType) {
    try {
        console.log('Starting R2 upload process...');

        // 1. Request presigned URL from our backend
        const response = await fetch(`${API_BASE_URL}/recordings/upload-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: filename,
                contentType: mimeType,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to get presigned URL from backend');
        }

        const { url } = await response.json();
        console.log('Received presigned URL');

        // 2. Convert Data URL to Blob
        const blob = await (await fetch(dataUrl)).blob();

        // 3. Upload directly to Cloudflare R2
        const uploadResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType,
            },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file to R2');
        }

        console.log('File uploaded to R2 successfully');

        // 4. Save metadata to backend
        const metaResponse = await fetch(`${API_BASE_URL}/recordings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: filename,
                fileName: filename,
                type: mimeType.includes('video') ? 'video' : 'screenshot',
            }),
        });

        if (!metaResponse.ok) {
            console.warn('Metadata saving failed, but file is uploaded.');
            return { success: true, uploaded: true, metaSaved: false, fileName: filename };
        }

        const recording = await metaResponse.json();
        console.log('Metadata saved to database');

        return {
            success: true,
            id: recording.id,
            shareUrl: `${API_BASE_URL.replace(':3001', ':5173')}/v/${recording.id}`
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

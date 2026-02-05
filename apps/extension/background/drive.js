// SnapRec Google Drive API Helper

// Drive API configuration
const DRIVE_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API_URL_METADATA = 'https://www.googleapis.com/drive/v3/files';

// Check if user is signed in
async function isSignedIn() {
    try {
        const token = await getAuthToken(false);
        return !!token;
    } catch (e) {
        return false;
    }
}

// Get auth token (interactive or silent)
function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                console.error('Auth error:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

// Sign out
function signOut() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) {
                // Revoke the token
                fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
                    .then(() => {
                        chrome.identity.removeCachedAuthToken({ token }, () => {
                            resolve(true);
                        });
                    })
                    .catch(() => {
                        chrome.identity.removeCachedAuthToken({ token }, () => {
                            resolve(true);
                        });
                    });
            } else {
                resolve(true);
            }
        });
    });
}

// Upload file to Google Drive
async function uploadToDrive(dataUrl, filename, mimeType = 'image/png') {
    try {
        const token = await getAuthToken(true);

        if (!token) {
            throw new Error('Failed to get auth token');
        }

        // Convert data URL to blob
        const blob = await dataUrlToBlob(dataUrl);

        // Create metadata
        const metadata = {
            name: filename,
            mimeType: mimeType
        };

        // Create multipart form data
        const boundary = '-------SnapRecBoundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        // Build multipart request body
        const metadataString = JSON.stringify(metadata);

        // Read blob as array buffer
        const blobData = await blob.arrayBuffer();

        // Create multipart body
        const body = new Blob([
            delimiter,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            metadataString,
            delimiter,
            `Content-Type: ${mimeType}\r\n`,
            'Content-Transfer-Encoding: base64\r\n\r\n',
            arrayBufferToBase64(blobData),
            closeDelimiter
        ], { type: `multipart/related; boundary=${boundary}` });

        // Upload to Drive
        const response = await fetch(`${DRIVE_API_URL}?uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Drive upload error:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Upload successful:', result);

        // Get shareable link
        const shareLink = `https://drive.google.com/file/d/${result.id}/view`;

        return {
            success: true,
            fileId: result.id,
            fileName: result.name,
            shareLink: shareLink
        };
    } catch (error) {
        console.error('Error uploading to Drive:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Helper: Convert data URL to Blob
function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then(r => r.blob());
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Get user info
async function getUserInfo() {
    try {
        const token = await getAuthToken(false);
        if (!token) return null;

        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.SnapRecDrive = {
        isSignedIn,
        getAuthToken,
        signOut,
        uploadToDrive,
        getUserInfo
    };
}

// SnapRec Video Preview Page

let videoBlob = null;
let videoBlobUrl = null;

async function init() {
    console.log('Video page init starting...');
    try {
        const result = await chrome.storage.local.get('recordedVideo');
        console.log('Got storage result, has recordedVideo:', !!result.recordedVideo);

        if (result.recordedVideo) {
            videoBlobUrl = result.recordedVideo;
            console.log('Video data URL length:', videoBlobUrl.length);
            console.log('Video data type:', videoBlobUrl.substring(0, 50));

            const videoPlayer = document.getElementById('videoPlayer');
            videoPlayer.src = videoBlobUrl;

            // Add event listeners for debugging
            videoPlayer.onloadedmetadata = () => {
                console.log('Video loaded, duration:', videoPlayer.duration);
            };
            videoPlayer.onerror = (e) => {
                console.error('Video error:', e);
                document.getElementById('fileInfo').textContent = 'Error loading video';
            };

            // Convert to blob for download
            try {
                const response = await fetch(videoBlobUrl);
                videoBlob = await response.blob();
                const sizeMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
                document.getElementById('fileInfo').textContent = `Size: ${sizeMB} MB`;
                console.log('Blob created, size:', videoBlob.size);
            } catch (e) {
                console.error('Could not create blob:', e);
            }
        } else {
            console.warn('No recorded video found in storage');
            document.getElementById('fileInfo').textContent = 'No video found';
        }
    } catch (error) {
        console.error('Error loading video:', error);
        document.getElementById('fileInfo').textContent = 'Error: ' + error.message;
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Discard
document.getElementById('discardBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove('recordedVideo');
    window.close();
});

// Download
document.getElementById('downloadBtn').addEventListener('click', async () => {
    try {
        if (!videoBlobUrl) {
            showToast('No video to download');
            return;
        }

        // If we have a blob, create blob URL for download
        // Otherwise convert the data URL to blob first
        let downloadUrl;
        if (videoBlob) {
            downloadUrl = URL.createObjectURL(videoBlob);
        } else if (videoBlobUrl.startsWith('data:')) {
            // Convert data URL to blob
            const response = await fetch(videoBlobUrl);
            const blob = await response.blob();
            downloadUrl = URL.createObjectURL(blob);
        } else {
            downloadUrl = videoBlobUrl;
        }

        const filename = `SnapRec_Video_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

        // Use anchor element for reliable download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('Downloading...');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed: ' + error.message);
    }
});

// Drive Upload
document.getElementById('driveBtn').addEventListener('click', async () => {
    const driveBtn = document.getElementById('driveBtn');
    const originalHTML = driveBtn.innerHTML;

    try {
        driveBtn.disabled = true;
        driveBtn.innerHTML = `
            <svg class="spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="30 70"/>
            </svg>
            Uploading...
        `;

        if (!videoBlob && videoBlobUrl) {
            const response = await fetch(videoBlobUrl);
            videoBlob = await response.blob();
        }

        if (!videoBlob) {
            throw new Error('No video data');
        }

        // Use the data URL we already have
        let dataUrl = videoBlobUrl;

        // If it's not a data URL, convert it
        if (!videoBlobUrl.startsWith('data:')) {
            const reader = new FileReader();
            dataUrl = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(videoBlob);
            });
        }

        const filename = `SnapRec_Video_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'uploadToDrive',
                dataUrl: dataUrl,
                filename: filename,
                mimeType: 'video/webm'
            }, resolve);
        });

        if (result && result.success) {
            showToast('Uploaded to Google Drive!');
            if (result.shareLink) {
                try {
                    await navigator.clipboard.writeText(result.shareLink);
                    showToast('Link copied to clipboard!');
                } catch (e) {
                    console.log('Share link:', result.shareLink);
                }
            }
        } else {
            showToast(result?.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload: ' + error.message);
    } finally {
        driveBtn.disabled = false;
        driveBtn.innerHTML = originalHTML;
    }
});

// Initialize on page load
init();

// SnapRec Background Service Worker

// Single consolidated message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);

    // Handle captureVisibleForFullPage specially - it needs async sendResponse
    if (message.action === 'captureVisibleForFullPage') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            console.log('Captured visible tab for full page, got', dataUrl ? 'data' : 'null');
            sendResponse(dataUrl);
        });
        return true; // Keep message channel open for async response
    }

    // Handle uploadToDrive with async response
    if (message.action === 'uploadToDrive') {
        handleDriveUpload(message.dataUrl, message.filename, message.mimeType)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async
    }

    // Handle getDriveAuthStatus with async response
    if (message.action === 'getDriveAuthStatus') {
        checkDriveAuth()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ signedIn: false }));
        return true;
    }

    // Handle signOutDrive
    if (message.action === 'signOutDrive') {
        handleSignOut()
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
        return true;
    }

    // Handle other messages
    switch (message.action) {
        case 'captureVisible':
            captureVisibleTab();
            break;
        case 'captureFullPage':
            captureFullPage();
            break;
        case 'captureRegion':
            startRegionCapture();
            break;
        case 'processScreenshot':
            processScreenshot(message.dataUrl, message.type);
            break;
        case 'startRecording':
            startRecording(message.options);
            break;
        case 'stopRecording':
            stopRecording();
            break;
        case 'openCapture':
            openCapture(message.capture);
            break;
        case 'saveScreenshot':
            saveScreenshot(message.dataUrl, message.filename);
            break;
        case 'downloadScreenshot':
            downloadScreenshot(message.dataUrl);
            break;
        case 'recordingComplete':
            handleRecordingComplete(message.dataUrl);
            break;
        case 'regionCaptured':
            captureAndCropRegion(message.rect, sender.tab.id);
            break;
    }
    return true;
});

// Drive Upload Handler
async function handleDriveUpload(dataUrl, filename, mimeType = 'image/png') {
    console.log('handleDriveUpload called with filename:', filename);

    try {
        console.log('Requesting auth token...');
        const token = await getAuthToken(true);
        console.log('Got token:', token ? 'yes' : 'no');

        if (!token) {
            throw new Error('Failed to get auth token. Please check OAuth consent screen is published and you are added as a test user.');
        }

        console.log('Converting data URL to blob...');
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        console.log('Blob size:', blob.size);

        // Create metadata
        const metadata = {
            name: filename || `SnapRec_${Date.now()}.png`,
            mimeType: mimeType
        };

        // Create form data for multipart upload
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        console.log('Uploading to Drive...');
        // Upload to Drive
        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: form
            }
        );

        console.log('Upload response status:', uploadResponse.status);

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload error response:', errorText);
            throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const result = await uploadResponse.json();
        console.log('Drive upload successful:', result);

        return {
            success: true,
            fileId: result.id,
            fileName: result.name,
            shareLink: `https://drive.google.com/file/d/${result.id}/view`
        };
    } catch (error) {
        console.error('Drive upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Check Drive Auth Status
async function checkDriveAuth() {
    try {
        const token = await getAuthTokenSilent();
        return { signedIn: !!token };
    } catch (e) {
        return { signedIn: false };
    }
}

// Get auth token (interactive)
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

// Get auth token (silent)
function getAuthTokenSilent() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            resolve(token || null);
        });
    });
}

// Handle Sign Out
async function handleSignOut() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    });
}

// Capture Visible Tab
async function captureVisibleTab() {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        await openEditor(dataUrl);
    } catch (error) {
        console.error('Error capturing visible tab:', error);
    }
}

// Capture Full Page
async function captureFullPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Inject the content script programmatically
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
        });

        // Also inject CSS
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
        });

        // Small delay to ensure script is loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send message to capture full page
        chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' });
    } catch (error) {
        console.error('Error capturing full page:', error);
        // Fallback to visible tab capture
        captureVisibleTab();
    }
}

// Start Region Capture
async function startRegionCapture() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Inject the content script programmatically
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
        });

        // Also inject CSS
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
        });

        // Small delay to ensure script is loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send message to start region selection
        chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' });
    } catch (error) {
        console.error('Error starting region capture:', error);
    }
}

// Process Screenshot
async function processScreenshot(dataUrl, type) {
    try {
        // Check approximate size of dataUrl
        const sizeInBytes = dataUrl.length * 0.75;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        console.log(`Screenshot size: ~${sizeInMB.toFixed(2)}MB, type: ${type}`);

        // Only add to recent captures if small enough (< 0.5MB for thumbnail)
        if (sizeInMB < 0.5) {
            try {
                await addToRecentCaptures({
                    type: 'screenshot',
                    dataUrl: dataUrl,
                    thumbnail: dataUrl,
                    timestamp: Date.now(),
                    captureType: type
                });
            } catch (e) {
                console.warn('Could not save to recent captures:', e);
            }
        } else {
            console.log('Screenshot too large for recent captures storage');
        }

        // Open editor
        await openEditor(dataUrl);
    } catch (error) {
        console.error('Error processing screenshot:', error);
    }
}

// Open Editor
async function openEditor(dataUrl) {
    try {
        // Clear any previous image first
        await chrome.storage.local.remove('editingImage');

        // Try to store in chrome.storage.local
        await chrome.storage.local.set({ editingImage: dataUrl });
        console.log('Image saved to storage successfully');
    } catch (e) {
        console.warn('Storage failed, image too large. Will download instead:', e);
        // If storage fails, download directly
        const filename = `SnapRec_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        });
        return; // Don't open editor if we had to download
    }

    chrome.tabs.create({
        url: chrome.runtime.getURL('editor/editor.html')
    });
}

// Start Recording
async function startRecording(options) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Starting recording with options:', options, 'tab:', tab.id);

        // Inject content script first
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
        });

        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        if (options.source === 'tab') {
            // For tab capture, use desktopCapture with 'tab' media type
            chrome.desktopCapture.chooseDesktopMedia(
                ['tab', 'audio'],
                tab,
                async (streamId) => {
                    console.log('Got streamId for tab:', streamId);
                    if (streamId) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'initRecording',
                            streamId: streamId,
                            options: options
                        });
                    } else {
                        console.error('No streamId returned for tab capture');
                    }
                }
            );
        } else {
            // Use desktopCapture for screen/window
            chrome.desktopCapture.chooseDesktopMedia(
                ['screen', 'window'],
                tab,
                async (streamId) => {
                    if (streamId) {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content/content.js']
                        });

                        await chrome.scripting.insertCSS({
                            target: { tabId: tab.id },
                            files: ['content/content.css']
                        });

                        await new Promise(resolve => setTimeout(resolve, 100));

                        chrome.tabs.sendMessage(tab.id, {
                            action: 'initRecording',
                            streamId: streamId,
                            options: options
                        });
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error starting recording:', error);
    }
}

// Stop Recording
async function stopRecording() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' });
}

// Save Screenshot
async function saveScreenshot(dataUrl, filename) {
    try {
        chrome.downloads.download({
            url: dataUrl,
            filename: filename || `SnapRec_${Date.now()}.png`,
            saveAs: true
        });
    } catch (error) {
        console.error('Error saving screenshot:', error);
    }
}

// Download Screenshot
async function downloadScreenshot(dataUrl) {
    try {
        const filename = `SnapRec_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
        });
    } catch (error) {
        console.error('Error downloading screenshot:', error);
    }
}

// Add to Recent Captures
async function addToRecentCaptures(capture) {
    try {
        const result = await chrome.storage.local.get('recentCaptures');
        let captures = result.recentCaptures || [];

        // Add to beginning
        captures.unshift(capture);

        // Keep only last 20
        captures = captures.slice(0, 20);

        await chrome.storage.local.set({ recentCaptures: captures });
    } catch (error) {
        console.error('Error adding to recent captures:', error);
    }
}

// Open Capture
function openCapture(capture) {
    if (capture.type === 'screenshot') {
        openEditor(capture.dataUrl);
    } else if (capture.type === 'video') {
        chrome.tabs.create({ url: capture.dataUrl });
    }
}

// Capture and crop region
async function captureAndCropRegion(rect, tabId) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

        // Use OffscreenCanvas for cropping in Service Worker
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);

        const dpr = rect.devicePixelRatio || 1;
        const width = Math.round(rect.width * dpr);
        const height = Math.round(rect.height * dpr);
        const x = Math.round(rect.x * dpr);
        const y = Math.round(rect.y * dpr);

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw the specific portion of the captured visible tab onto the canvas
        ctx.drawImage(imageBitmap, x, y, width, height, 0, 0, width, height);

        // Convert canvas to data URL (handling blob conversion in Service Worker)
        const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
        const reader = new FileReader();
        const croppedDataUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(croppedBlob);
        });

        await openEditor(croppedDataUrl);
    } catch (error) {
        console.error('Error capturing region:', error);
        // Fallback to full screenshot if cropping fails
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        await openEditor(dataUrl);
    }
}

async function handleRecordingComplete(dataUrl) {
    try {
        // Store video URL for the preview page
        await chrome.storage.local.set({ recordedVideo: dataUrl });

        // Add to recent captures (without the full video data to save space)
        try {
            await addToRecentCaptures({
                type: 'video',
                dataUrl: '', // Don't store full video in recent captures
                thumbnail: '',
                timestamp: Date.now()
            });
        } catch (e) {
            console.warn('Could not add to recent captures:', e);
        }

        // Open video preview page
        chrome.tabs.create({
            url: chrome.runtime.getURL('video/video.html')
        });
    } catch (error) {
        console.error('Error handling recording:', error);
        // Fallback to direct download
        const filename = `SnapRec_Video_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        });
    }
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'snaprec-capture',
        title: 'Capture with SnapRec',
        contexts: ['page', 'image', 'selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'snaprec-capture') {
        captureVisibleTab();
    }
});

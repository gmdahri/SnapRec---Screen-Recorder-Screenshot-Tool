// SnapRec Background Service Worker
importScripts('config.js');
importScripts('storage.js');
importScripts('utils/tabs.js');
importScripts('utils/messaging.js');
importScripts('utils/contentScriptManager.js');
importScripts('utils/storage.js');

// Single consolidated message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[SnapRec v1.0.5] Background received message:', message.action);

    // Handle ping for service worker wake-up
    if (message.action === 'ping') {
        sendResponse({ pong: true });
        return true;
    }

    // Handle captureVisibleForFullPage specially - it needs async sendResponse
    if (message.action === 'captureVisibleForFullPage') {
        const windowId = sender.tab ? sender.tab.windowId : null;
        chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error('captureVisibleTab error:', chrome.runtime.lastError.message);
                sendResponse(null);
            } else {
                console.log('Captured visible tab for full page, got', dataUrl ? 'data' : 'null');
                sendResponse(dataUrl);
            }
        });
        return true; // Keep message channel open for async response
    }

    // Handle uploadToR2 with async response
    if (message.action === 'uploadToR2' || message.action === 'uploadToDrive') {
        uploadToR2(message.dataUrl, message.filename, message.mimeType)
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

    // Handle other messages (fire-and-forget, no response needed)
    switch (message.action) {
        case 'captureVisible':
            captureVisibleTab();
            return false; // No response needed
        case 'captureFullPage':
            captureFullPage();
            return false; // No response needed
        case 'captureRegion':
            startRegionCapture();
            return false; // No response needed
        case 'processScreenshot':
            processScreenshot(message.dataUrl, message.type);
            return false; // No response needed
        case 'startRecording':
            startRecording(message.options);
            return false; // No response needed
        case 'stopRecording':
            stopRecording();
            return false; // No response needed
        case 'pauseRecording':
            pauseRecording();
            return false; // No response needed
        case 'resumeRecording':
            resumeRecording();
            return false; // No response needed
        case 'openCapture':
            openCapture(message.capture);
            return false; // No response needed
        case 'saveScreenshot':
            saveScreenshot(message.dataUrl, message.filename);
            return false; // No response needed
        case 'downloadScreenshot':
            downloadScreenshot(message.dataUrl);
            return false; // No response needed
        case 'recordingComplete':
            handleRecordingComplete(message.dataUrl);
            return false; // No response needed
        case 'recordingUploaded':
            handleRecordingUploaded(message.recordingId);
            return false; // No response needed
        case 'uploadError':
            handleUploadError(message.error);
            return false; // No response needed
        case 'regionCaptured':
            captureAndCropRegion(message.rect, sender.tab.id);
            return false; // No response needed
        case 'openFullEditor':
            openEditor(message.dataUrl);
            return false; // No response needed
        default:
            // Unknown action - don't keep channel open
            return false;
    }
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
        console.log('Blob size:', blob.size, '(', (blob.size / (1024 * 1024)).toFixed(2), 'MB)');

        if (blob.size > 5 * 1024 * 1024) {
            console.warn('File size exceeds 5MB. Standard multipart upload might fail.');
        }

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
        await showPreview(dataUrl, 'visible');
    } catch (error) {
        console.error('Error capturing visible tab:', error);
        alert('Cannot capture screenshots on this page. Try a normal website instead.');
    }
}

// Capture Full Page
async function captureFullPage() {
    try {
        const tab = await TabUtils.getActiveTab();
        await ContentScriptManager.inject(tab.id);

        // Send message to capture full page
        chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending captureFullPage message:', chrome.runtime.lastError.message);
                // Fallback to visible tab capture if full page message fails
                captureVisibleTab();
            }
        });
    } catch (error) {
        console.error('Error capturing full page:', error);
        // Fallback to visible tab capture
        captureVisibleTab();
    }
}

// Start Region Capture
async function startRegionCapture() {
    try {
        const tab = await TabUtils.getActiveTab();
        if (TabUtils.isRestrictedUrl(tab.url)) {
            console.warn('Cannot capture region on this page');
            return;
        }

        await ContentScriptManager.inject(tab.id);

        try {
            chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError.message);
                    // Retry once after another short delay
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' });
                    }, 500);
                }
            });
        } catch (e) {
            console.error('Failed to send startRegionSelect message:', e);
        }
    } catch (error) {
        console.error('Error starting region capture:', error);
    }
}

// Process Screenshot
async function processScreenshot(dataUrl, type) {
    try {
        console.log(`Processing screenshot, type: ${type}`);
        await showPreview(dataUrl, type);

        // Add to recent captures if small enough
        const sizeInBytes = dataUrl.length * 0.75;
        const sizeInMB = sizeInBytes / (1024 * 1024);
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
        }
    } catch (error) {
        console.error('Error processing screenshot:', error);
        // Final fallback
        await openEditor(dataUrl);
    }
}

// Helper: Show Mini Preview in Content Script
async function showPreview(dataUrl, type) {
    try {
        const tab = await TabUtils.getActiveTab();
        if (TabUtils.isRestrictedUrl(tab.url)) {
            await openEditor(dataUrl);
            return;
        }

        await ContentScriptManager.inject(tab.id);

        // Send message to show mini preview
        chrome.tabs.sendMessage(tab.id, {
            action: 'showMiniPreview',
            dataUrl: dataUrl,
            captureType: type
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending showMiniPreview message:', chrome.runtime.lastError.message);
                // Fallback to direct editor if preview fails
                openEditor(dataUrl);
            }
        });
    } catch (error) {
        console.error('Error showing preview:', error);
        await openEditor(dataUrl);
    }
}

// Open Editor
async function openEditor(dataUrl) {
    try {
        console.log('Redirecting to web editor...');
        await chrome.storage.local.set({ editingImage: dataUrl });

        const editorUrl = `${CONFIG.WEB_BASE_URL}/editor`;
        const tab = await chrome.tabs.create({ url: editorUrl });

        // Wait for tab to load and inject data transfer script
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Transfer data to the page context
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (imageData) => {
                        console.log('Injected script sending postMessage');
                        window.postMessage({
                            type: 'SNAPREC_EDIT_IMAGE',
                            dataUrl: imageData
                        }, '*');
                    },
                    args: [dataUrl]
                });
            }
        });
    } catch (e) {
        console.error('Failed to open web editor:', e);
        const filename = `SnapRec_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        });
    }
}

// Offscreen document management
const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';
let creatingOffscreen = null;

async function hasOffscreenDocument() {
    // Check for any offscreen document (don't match URL since it has cache-busting params)
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return contexts.length > 0;
}

async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log('[SnapRec] Offscreen document already exists, closing it first');
        await closeOffscreenDocument();
    }

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    console.log('[SnapRec] Creating offscreen document...');
    creatingOffscreen = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DISPLAY_MEDIA],
        justification: 'Recording screen/tab video and audio using getDisplayMedia'
    });

    await creatingOffscreen;
    creatingOffscreen = null;
    console.log('[SnapRec] Offscreen document created');
}

async function closeOffscreenDocument() {
    try {
        if (await hasOffscreenDocument()) {
            console.log('[SnapRec] Closing offscreen document');
            await chrome.offscreen.closeDocument();
            console.log('[SnapRec] Offscreen document closed');
        }
    } catch (error) {
        console.warn('[SnapRec] Error closing offscreen document:', error);
    }
}

// Track active recording tab
let recordingTabId = null;

// Start Recording using Offscreen Document
async function startRecording(options) {
    try {
        console.log('[SnapRec] startRecording called with options:', JSON.stringify(options));

        const tab = await TabUtils.getActiveTab();
        if (TabUtils.isRestrictedUrl(tab.url)) {
            console.error('[SnapRec] Cannot inject into restricted page:', tab.url);
            return;
        }

        // Store the recording tab ID for navigation tracking
        recordingTabId = tab.id;

        try {
            // Step 1: Create offscreen document and show screen picker
            await createOffscreenDocument();

            // Start recording in offscreen document - this shows the picker
            console.log('[SnapRec] Showing screen picker...');
            const streamResponse = await chrome.runtime.sendMessage({
                action: 'offscreen_startRecording',
                options: options
            });

            if (!streamResponse?.success) {
                console.error('[SnapRec] Failed to get stream:', streamResponse?.error);
                recordingTabId = null;
                await closeOffscreenDocument();
                return;
            }

            console.log('[SnapRec] Stream acquired, showing countdown...');

            // Step 2: Inject content script for countdown
            await ContentScriptManager.inject(tab.id);
            console.log('[SnapRec] Content script injected for countdown');

            // Show 3-2-1 countdown
            chrome.tabs.sendMessage(tab.id, { action: 'showCountdown' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[SnapRec] Countdown message failed:', chrome.runtime.lastError.message);
                }
            });

            // Wait for countdown to complete (3 seconds for numbers + 0.5s buffer)
            await new Promise(resolve => setTimeout(resolve, 3500));
            console.log('[SnapRec] Countdown complete');

            // Step 3: Start the MediaRecorder
            const recorderResponse = await chrome.runtime.sendMessage({
                action: 'offscreen_startMediaRecorder'
            });

            if (recorderResponse?.success) {
                console.log('[SnapRec] Recording started at:', recorderResponse.startTime);

                // Store recording state in local storage
                await chrome.storage.local.set({
                    isRecording: true,
                    recordingStartTime: recorderResponse.startTime || Date.now(),
                    recordingOptions: options
                });

                // Show recording overlay in the content script
                await injectRecordingOverlay(tab.id);
            } else {
                console.error('[SnapRec] Failed to start MediaRecorder:', recorderResponse?.error);
                recordingTabId = null;
                await closeOffscreenDocument();
            }
        } catch (error) {
            console.error('[SnapRec] Error starting recording:', error);
            recordingTabId = null;
            await closeOffscreenDocument();
        }
    } catch (error) {
        console.error('[SnapRec] Error in startRecording:', error, error.stack);
        recordingTabId = null;
    }
}

// Inject recording overlay into a tab
async function injectRecordingOverlay(tabId) {
    try {
        // Inject content script
        await ContentScriptManager.inject(tabId);
        console.log('[SnapRec] Content script injected');

        // Get recording start time from storage
        const { recordingStartTime } = await chrome.storage.local.get('recordingStartTime');

        // Tell content script to show the recording overlay
        chrome.tabs.sendMessage(tabId, {
            action: 'showRecordingOverlay',
            startTime: recordingStartTime
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[SnapRec] Could not show overlay:', chrome.runtime.lastError.message);
            }
        });
    } catch (error) {
        console.warn('[SnapRec] Failed to inject overlay:', error);
    }
}

// Stop Recording
async function stopRecording() {
    console.log('[SnapRec] stopRecording called manually');

    try {
        // Get recording data from offscreen document
        const response = await chrome.runtime.sendMessage({ action: 'offscreen_stopRecording' });
        console.log('[SnapRec] stopRecording response received:', response ? (response.success ? 'success' : 'failure') : 'null');

        if (response?.success) {
            console.log('[SnapRec] Recording stopped, size:', response.size);
            await handleRecordingComplete();
            console.log('[SnapRec] handleRecordingComplete finished');
        } else {
            console.error('[SnapRec] Failed to stop recording:', response?.error);
            // Even if message fails, try to clean up
            await finalizeCleanup();
        }
    } catch (error) {
        console.error('[SnapRec] Error stopping recording:', error);
        await finalizeCleanup();
    }
}

async function finalizeCleanup() {
    console.log('[SnapRec] Finalizing cleanup');
    recordingTabId = null;
    await closeOffscreenDocument();
    await chrome.storage.local.set({ isRecording: false, recordingStartTime: null });
}

// ... existing code ...

async function handleRecordingComplete() {
    console.log('[SnapRec] handleRecordingComplete called');
    try {
        // Get auth session first
        const { snaprecSession } = await chrome.storage.local.get('snaprecSession');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (snaprecSession?.accessToken) {
            headers['Authorization'] = `Bearer ${snaprecSession.accessToken}`;
            console.log('[SnapRec] Using authenticated session');
        }

        // Get presigned URL first
        console.log('[SnapRec] Requesting presigned URL...');
        const videoFileName = `video_${Date.now()}.webm`;
        const videoUploadRes = await fetch(`${API_BASE_URL}/recordings/upload-url`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ fileName: videoFileName, contentType: 'video/webm' })
        }).then(r => r.json());

        console.log('[SnapRec] Got presigned URL:', !!videoUploadRes?.uploadUrl);

        // Create database entry IMMEDIATELY
        console.log('[SnapRec] Creating database entry...');
        const { guestId } = await chrome.storage.local.get('guestId');

        const recordingRes = await fetch(`${API_BASE_URL}/recordings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: `Video Recording ${new Date().toLocaleString()}`,
                type: 'video',
                fileUrl: videoUploadRes.fileUrl,
                thumbnailUrl: null,
                userId: snaprecSession?.user?.id,
                guestId: !snaprecSession ? guestId : undefined
            })
        }).then(r => r.json());

        console.log('[SnapRec] Recording created:', recordingRes.id);

        // IMMEDIATELY redirect to /v/{id}
        console.log('[SnapRec] Redirecting to share page...');
        const shareUrl = `${CONFIG.WEB_BASE_URL}/v/${recordingRes.id}`;
        await chrome.tabs.create({ url: shareUrl });

        // Start upload in offscreen document without blocking
        console.log('[SnapRec] Triggering upload in offscreen document...');
        chrome.runtime.sendMessage({
            action: 'offscreen_uploadVideo',
            uploadUrl: videoUploadRes.uploadUrl
        }).catch(err => {
            console.error('[SnapRec] Failed to start upload:', err);
        });

        // State cleanup happens in the new listener below
    } catch (error) {
        console.error('[SnapRec] Error handling recording completion:', error);
        await finalizeCleanup();
    }
}

// Separate listener for upload completion from offscreen document
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'offscreen_uploadComplete') {
        console.log('[SnapRec] Upload complete signal received from offscreen');
        finalizeCleanup();
    } else if (message.action === 'offscreen_uploadError') {
        console.error('[SnapRec] Upload error reported by offscreen:', message.error);
        finalizeCleanup();
    }
});


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

// Keyboard shortcuts handler
chrome.commands.onCommand.addListener((command) => {
    console.log('[SnapRec] Command received:', command);

    switch (command) {
        case 'capture-visible':
            captureVisibleTab();
            break;
        case 'capture-fullpage':
            captureFullPage();
            break;
        case 'capture-region':
            startRegionCapture();
            break;
        case 'start-recording':
            startRecording({ source: 'screen', microphone: false, systemAudio: true, webcam: false });
            break;
    }
});

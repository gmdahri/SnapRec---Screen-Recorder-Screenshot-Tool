// SnapRec Background Service Worker
importScripts('config.js');
importScripts('analytics.js');   // must follow config.js — reads CONFIG.POSTHOG
importScripts('queue.js');
importScripts('recording-file.js');
importScripts('fullpage.js');
importScripts('storage.js');
importScripts('utils/tabs.js');
importScripts('utils/messaging.js');
importScripts('utils/contentScriptManager.js');
importScripts('utils/storage.js');
importScripts('auth.js');

/** Retries delivery of the one-shot install event. See onInstalled below. */
const INSTALL_FLUSH_ALARM = 'snaprec-flush-install';

// Single consolidated message listener
let recordingMetadata = []; // Store metadata chunks during recording

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const version = chrome.runtime.getManifest().version;
    console.log(`[SnapRec v${version}] Background received message:`, message.action);

    // Analytics from the popup and content scripts. They deliberately do not
    // own a PostHog client: identity and opt-out live in one place, and a
    // service worker is the only context here that persists across pages.
    if (message.action === 'trackEvent') {
        Analytics.track(message.event, message.properties || {});
        // Fire-and-forget: answer immediately rather than making the caller
        // wait on a network round trip.
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'setAnalyticsOptOut') {
        (message.optOut ? Analytics.optOut() : Analytics.optIn())
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }));
        return true;
    }

    if (message.action === 'getAnalyticsOptOut') {
        Analytics.hasOptedOut()
            .then((optedOut) => sendResponse({ optedOut }))
            .catch(() => sendResponse({ optedOut: true }));
        return true;
    }

    // Handle ping for service worker wake-up
    if (message.action === 'ping') {
        sendResponse({ pong: true });
        return true;
    }

    // Handle update check request from popup
    if (message.action === 'checkForUpdate') {
        checkForUpdate().then(() => sendResponse({ success: true }));
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

    /** The overlay is a DOM element, so it is per-tab, and the toggle has to
     * match the tab in front of the user. The answer comes from that page —
     * never from a stored preference. Silence means no content script, which
     * means no overlay, so silence is `false`: a stored value would light the
     * toggle on a tab showing no camera, and the first click would then read
     * as turning it off. */
    /** What the popup should show on open.
     *
     * It asked for this from the day it was written and nothing ever replied,
     * so reopening during a recording showed `ready` — the one thing the
     * popup's own comment says must never happen. */
    if (message.action === 'getCaptureState') {
        chrome.storage.local.get(['isRecording', 'recordingStartTime'])
            .then(({ isRecording, recordingStartTime }) => sendResponse(
                isRecording
                    ? { view: 'recording', startTime: recordingStartTime ?? null }
                    : null,
            ))
            .catch(() => sendResponse(null));
        return true;
    }

    /** The popup asking what the recorded source looks like right now. */
    if (message.action === 'getSourceFrame') {
        (async () => {
            try {
                if (!(await hasOffscreenDocument())) return sendResponse({ dataUrl: null });
                const reply = await chrome.runtime.sendMessage({
                    action: 'offscreen_grabFrame',
                    maxWidth: message.maxWidth ?? 320,
                });
                sendResponse({ dataUrl: reply?.dataUrl ?? null });
            } catch {
                sendResponse({ dataUrl: null });
            }
        })();
        return true;
    }

    if (message.action === 'getMicMuted') {
        chrome.storage.local.get('micMuted')
            .then(({ micMuted }) => sendResponse({ muted: !!micMuted }))
            .catch(() => sendResponse({ muted: false }));
        return true;
    }

    if (message.action === 'getWebcamPreview') {
        (async () => {
            try {
                const tab = await TabUtils.getActiveTab();
                if (!tab?.id) return sendResponse({ on: false });
                const reply = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'isWebcamPreviewOn' }, (r) => {
                        void chrome.runtime.lastError;
                        resolve(r);
                    });
                });
                sendResponse({ on: reply?.on === true });
            } catch {
                sendResponse({ on: false });
            }
        })();
        return true;
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
        case 'fullPageBegin':
            fullPageBegin(message)
                .then(r => sendResponse({ success: true, ...r }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
        case 'fullPageSection':
            fullPageSection(message, sender.tab?.windowId)
                .then(() => sendResponse({ success: true }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
        case 'fullPageFinish':
            fullPageFinish()
                .then(r => sendResponse({ success: true, ...r }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
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
        case 'setMicMuted':
            setMicMuted(message.muted);
            return false; // No response needed
        case 'setWebcamPreview':
            setWebcamPreview(message.enabled);
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
            // SKIP pre-upload, go straight to editor with local data
            openEditor(message.dataUrl);
            return false; // No response needed
        case 'offscreen_recordingBlobReady':
            console.log('[SnapRec] Recording blob ready in offscreen, size:', message.size);
            // We'll wait for the web tab to request this blob
            return false;
        case 'offscreen_uploadError':
            console.error('[SnapRec] Offscreen encountered upload error:', message.error);
            return false;
        case 'recordMetadataChunks':
            if (message.chunks && Array.isArray(message.chunks)) {
                recordingMetadata.push(...message.chunks);
            }
            return false;
        default:
            // Unknown action - don't keep channel open
            return false;
    }
});

// --- Auto-Update System ---
const UPDATE_CHECK_ALARM = 'snaprec-update-check';
const VERSION_CHECK_URL = `${CONFIG.WEB_BASE_URL}/version.json`;

/**
 * Compares two semver strings. Returns true if remoteVersion > localVersion.
 */
function isNewerVersion(localVersion, remoteVersion) {
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((remote[i] || 0) > (local[i] || 0)) return true;
        if ((remote[i] || 0) < (local[i] || 0)) return false;
    }
    return false;
}

async function checkForUpdate() {
    try {
        const currentVersion = chrome.runtime.getManifest().version;
        const response = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });

        if (!response.ok) {
            console.warn('[SnapRec] Version check request failed:', response.status);
            return;
        }

        // Guard against responses that return HTML (e.g. SPA 404 redirect)
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
            console.warn('[SnapRec] Version check returned unexpected content-type:', contentType);
            return;
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (_) {
            console.warn('[SnapRec] Version check response is not valid JSON — version.json may not be deployed yet.');
            return;
        }

        const latestVersion = data.version;
        if (!latestVersion) {
            console.warn('[SnapRec] Version check response missing "version" field.');
            return;
        }

        console.log(`[SnapRec] Update check: installed=${currentVersion}, latest=${latestVersion}`);

        if (isNewerVersion(currentVersion, latestVersion)) {
            console.log(`[SnapRec] Update available: v${latestVersion}`);

            const { updateVersion: previouslyFlagged } = await chrome.storage.local.get('updateVersion');

            // Store update info for the popup banner
            await chrome.storage.local.set({ updateAvailable: true, updateVersion: latestVersion });

            // Only show a system notification once per discovered version
            if (previouslyFlagged !== latestVersion) {
                chrome.notifications.create('snaprec-update', {
                    type: 'basic',
                    iconUrl: '../icons/icon128.png',
                    title: 'SnapRec Update Available 🎉',
                    message: `Version ${latestVersion} is ready. Open the extension to update.`,
                    priority: 2
                });
            }
        } else {
            await chrome.storage.local.set({ updateAvailable: false, updateVersion: null });
        }
    } catch (e) {
        console.warn('[SnapRec] Update check failed:', e.message);
    }
}


// Check on startup
checkForUpdate();

// Schedule periodic checks
chrome.alarms.create(UPDATE_CHECK_ALARM, {
    periodInMinutes: CONFIG.UPDATE_CHECK_INTERVAL_MINUTES || 30
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_CHECK_ALARM) {
        console.log('[SnapRec] Periodic update check triggered.');
        checkForUpdate();
    }
});

// Clicking the update notification opens the extension popup
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'snaprec-update') {
        chrome.action.openPopup().catch(() => {
            // openPopup() requires a user gesture in some Chrome versions; silently fail
        });
        chrome.notifications.clear('snaprec-update');
    }
});

// Drive Upload Handler
async function handleDriveUpload(dataUrl, filename, mimeType = 'image/png') {
    console.log('handleDriveUpload called with filename:', filename);

    // Analytics: at the top of the attempt, so a cancelled Google consent
    // screen still shows as a started upload — that gap is the interesting one.
    Analytics.track('gdrive_upload_started', { mime_type: mimeType });

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

        // Analytics: only after Drive returned a file id. Every failure path
        // above throws, so this cannot fire for a failed upload.
        Analytics.track('gdrive_upload_completed', {
            mime_type: mimeType,
            file_size_mb: Math.round((blob.size / (1024 * 1024)) * 100) / 100,
        });

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

/** The microphone, from wherever it is asked about.
 *
 * Stored because the popup's switch and the overlay's button are two views of
 * one setting, and the popup is rebuilt from scratch every time it opens. The
 * live track only exists while recording, so muting mid-take is forwarded to
 * the offscreen document as well; before a take, storing it is the whole job.
 * Every tab's overlay is told, so a second one does not contradict the first. */
async function setMicMuted(muted) {
    await chrome.storage.local.set({ micMuted: !!muted });

    if (await hasOffscreenDocument()) {
        chrome.runtime.sendMessage({ action: 'offscreen_setMicMuted', muted: !!muted })
            .catch(() => { /* offscreen closed between the check and the send */ });
    }

    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
        tabs
            .filter(tab => !TabUtils.isRestrictedUrl(tab.url))
            .map(tab => chrome.tabs.sendMessage(tab.id, { action: 'micMutedChanged', muted: !!muted })
                .catch(() => { /* no content script in this tab */ }))
    );
}

/** Live camera preview, independent of recording.
 *
 * Nothing is stored. The overlay lives in the page, so the page is the only
 * honest record of whether it is up — see getWebcamPreview. */
async function setWebcamPreview(enabled) {
    try {
        const tab = await TabUtils.getActiveTab();
        if (!tab?.id) return;
        await ContentScriptManager.inject(tab.id);
        chrome.tabs.sendMessage(
            tab.id,
            { action: enabled ? 'showWebcamPreview' : 'hideWebcamPreview' },
            () => void chrome.runtime.lastError,
        );
    } catch (error) {
        // Restricted pages (chrome://, the Web Store) cannot host the overlay.
        // The toggle still holds, and the recording path applies it later.
        console.warn('[SnapRec] Webcam preview unavailable here:', error?.message);
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

// Capture and Crop Region
async function captureAndCropRegion(rect, tabId) {
    try {
        console.log('Capturing and cropping region:', rect);

        // 1. Capture the visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

        // 2. Ensure offscreen document is open
        await createOffscreenDocument();

        // 3. Send to offscreen for cropping
        const response = await chrome.runtime.sendMessage({
            action: 'offscreen_cropImage',
            dataUrl: dataUrl,
            rect: rect
        });

        if (response && response.success) {
            console.log('Region cropped successfully');
            await processScreenshot(response.dataUrl, 'region');
        } else {
            console.error('Failed to crop region:', response?.error);
            // Fallback to full screenshot if crop fails
            await processScreenshot(dataUrl, 'region');
        }
    } catch (error) {
        console.error('Error in captureAndCropRegion:', error);
    }
}

// Process Screenshot
/** State for the full-page capture in flight.
 *
 * The scale is decided once, at begin, and every section is drawn with it —
 * recomputing per section would make the seams disagree. */
let fullPageState = null;

/** Starts a full-page capture and answers with the scale that will be applied.
 *
 * A page can be larger than the browser will encode: past roughly 115
 * megapixels the canvas silently yields nothing. budgetedScale decides how far
 * to shrink so that never happens, and the content script reports it so a
 * downscaled capture is stated rather than passed off as full resolution. */
async function fullPageBegin({ pageW, pageH, viewportH, dpr }) {
    // Scale and format are decided together: webp is smaller but cannot exceed
    // 16383px, and it crops rather than refusing. See capturePlan.
    const plan = SnapRecFullPage.capturePlan({ pageW, pageH, dpr });
    await createOffscreenDocument();

    const r = await chrome.runtime.sendMessage({
        action: 'offscreen_fpBegin',
        pageW, pageH, dpr, scale: plan.scale, mimeType: plan.mimeType,
    });
    if (!r?.success) throw new Error(r?.error ?? 'could not start full-page capture');

    fullPageState = { dpr, scale: plan.scale, viewportH, sections: 0 };
    return { scale: plan.scale, mimeType: plan.mimeType, width: r.width, height: r.height };
}

/** Captures the current viewport and forwards it straight to the offscreen
 * document. The image never travels back through the content script — that
 * round trip is what used to build a multi-hundred-megabyte string in the page. */
async function fullPageSection({ sourceYCss, drawHCss, destYCss }, windowId) {
    if (!fullPageState) throw new Error('No full-page capture in progress');

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? null, { format: 'png' });
    const r = await chrome.runtime.sendMessage({
        action: 'offscreen_fpSection',
        dataUrl, sourceYCss, drawHCss, destYCss,
        dpr: fullPageState.dpr, scale: fullPageState.scale,
    });
    if (!r?.success) throw new Error(r?.error ?? 'section draw failed');
    fullPageState.sections += 1;
}

/** Finishes the capture: encode, save to disk, park for the editor, and hand
 * the content script a thumbnail for its preview. */
async function fullPageFinish() {
    if (!fullPageState) throw new Error('No full-page capture in progress');
    const { scale, sections } = fullPageState;
    fullPageState = null;

    const done = await chrome.runtime.sendMessage({ action: 'offscreen_fpFinish' });
    if (!done?.success) throw new Error(done?.error ?? 'encoding failed');

    console.log('[SnapRec] Full-page capture:', sections, 'sections,',
        done.size, 'bytes,', done.mimeType, 'scale', scale);
    Analytics.track('screenshot_taken', {
        capture_type: 'fullpage',
        file_size_mb: Math.round((done.size / (1024 * 1024)) * 100) / 100,
    });

    // No disk copy unless the handoff fails — see the 'handoffFailed' handler.
    await deliverImageToEditor();

    return { thumbnail: done.thumbnail, scale, size: done.size };
}

async function processScreenshot(dataUrl, type) {
    try {
        console.log(`Processing screenshot, type: ${type}`);

        const { captureCount = 0 } = await chrome.storage.local.get('captureCount');
        await chrome.storage.local.set({ captureCount: captureCount + 1 });

        // Analytics: every capture mode funnels through here. Size is derived
        // from the data URL, which is base64 — hence the 0.75 factor.
        Analytics.track('screenshot_taken', {
            capture_type: type ?? null,
            file_size_mb: Math.round(((dataUrl.length * 0.75) / (1024 * 1024)) * 100) / 100,
        });

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
async function openEditor(dataUrl, id = null) {
    try {
        console.log('Redirecting to web editor...');
        await chrome.storage.local.set({ editingImage: dataUrl });

        const baseUrl = `${CONFIG.WEB_BASE_URL}/editor`;
        const editorUrl = id ? `${baseUrl}/${id}` : baseUrl;
        const tab = await chrome.tabs.create({ url: editorUrl });

        // Wait for tab to load and inject data transfer script
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Transfer data to the page context
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (imageData) => {
                        console.log('Injected script setting sessionStorage and sending postMessage');
                        // Store in sessionStorage as a robust fallback
                        try {
                            sessionStorage.setItem('snaprec_editing_image', imageData);
                        } catch (e) {
                            console.warn('Failed to save to sessionStorage (likely size limit):', e);
                        }

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

        /* This is the last-resort path: the editor could not be opened, so the
         * file is offered directly. It had no callback, so a failure here was
         * completely silent — the user got no editor AND no file, with nothing
         * logged and nothing shown. chrome.downloads reports failure by setting
         * lastError and returning an undefined id, neither of which surfaces
         * unless you ask. */
        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            const failure = chrome.runtime.lastError?.message
                || (downloadId === undefined ? 'download did not start' : null);
            if (!failure) {
                Analytics.track('recording_download_completed', { surface: 'extension_fallback' });
                return;
            }

            console.error('[SnapRec] Screenshot download failed:', failure);
            Analytics.track('recording_download_failed', {
                surface: 'extension_fallback',
                error_reason: failure,
            });

            // Both routes failed, so say so rather than leaving the capture to
            // vanish without explanation.
            chrome.notifications.create('snaprec-download-failed', {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Could not save your screenshot',
                message: 'The editor and the download both failed. Try capturing again.',
            });
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

/** One offscreen document, reused.
 *
 * This used to close any open document before creating a new one, which made
 * every screenshot a hazard: region capture opens an offscreen document to
 * crop in, so taking one during a recording closed the document holding the
 * recording and destroyed it. There is only ever one, and every caller wants
 * "make sure it exists", not "make me a fresh one".
 *
 * BLOBS is declared alongside the media reasons because full-page capture
 * stitches into a canvas there and encodes the result. */
async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    console.log('[SnapRec] Creating offscreen document...');
    creatingOffscreen = chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [
            chrome.offscreen.Reason.DISPLAY_MEDIA,
            chrome.offscreen.Reason.USER_MEDIA,
            chrome.offscreen.Reason.BLOBS,
        ],
        justification: 'Recording screen/tab video and audio; microphone captured via '
            + 'getUserMedia; stitching and encoding full-page screenshots'
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
        recordingMetadata = []; // Reset metadata for new recording

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
                // Dismissing the picker is a normal thing to do, and the popup
                // has to come back to ready rather than sit on a dead view.
                Analytics.track('recording_cancelled', {
                    stage: 'picker',
                    reason: streamResponse?.error ? 'stream_failed' : 'dismissed',
                });
                notifyPopup({ action: 'startFailed', reason: streamResponse?.error ?? 'cancelled' });
                return;
            }

            console.log('[SnapRec] Stream acquired, showing countdown...');

            // The picker has been answered. Until this point the popup was
            // waiting, not counting down — it used to run its own countdown
            // and then a timer while the picker was still open, which told
            // people they were recording when nothing was.
            notifyPopup({ action: 'sourcePicked' });

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

                // Analytics: not awaited — the recorder is live and the overlay
                // must not wait on a network call. `format` is the container the
                // MediaRecorder actually negotiated; tab_url_domain is the host
                // only, never the path (see Analytics.domainOf).
                Analytics.track('recording_started', {
                    format: recorderResponse.mimeType || 'video/webm',
                    tab_url_domain: Analytics.domainOf(tab.url),
                    source: options?.source ?? null,
                    webcam: Boolean(options?.webcam),
                    microphone: Boolean(options?.microphone),
                    system_audio: Boolean(options?.systemAudio),
                });

                // Store recording state in local storage
                await chrome.storage.local.set({
                    isRecording: true,
                    recordingStartTime: recorderResponse.startTime || Date.now(),
                    recordingOptions: options
                });

                await broadcastRecordingState('recordingStarted');
                notifyPopup({
                    action: 'recordingStarted',
                    startTime: recorderResponse.startTime || Date.now(),
                });

                // Show recording overlay in the content script
                await injectRecordingOverlay(tab.id, options);
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
async function injectRecordingOverlay(tabId, options) {
    try {
        // Inject content script
        await ContentScriptManager.inject(tabId);
        console.log('[SnapRec] Content script injected');

        // Get recording start time from storage
        const { recordingStartTime } = await chrome.storage.local.get('recordingStartTime');

        // Tell content script to show the recording overlay
        chrome.tabs.sendMessage(tabId, {
            action: 'showRecordingOverlay',
            startTime: recordingStartTime,
            webcam: options?.webcam
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

    // IMMEDIATELY broadcast hide overlay to all tabs and update state
    // Don't wait for offscreen response - UI should be instant
    await broadcastHideOverlay();

    try {
        // Check if offscreen document actually exists before messaging it
        if (!(await hasOffscreenDocument())) {
            console.warn('[SnapRec] Offscreen document not found, skipping message');
            await finalizeCleanup();
            return;
        }

        // Get recording data from offscreen document
        const response = await chrome.runtime.sendMessage({ action: 'offscreen_stopRecording' });
        console.log('[SnapRec] stopRecording response received:', response ? (response.success ? 'success' : 'failure') : 'null');

        if (response?.success) {
            console.log('[SnapRec] Recording stopped, size:', response.size);

            // Analytics: duration from the recorder's own start timestamp, so it
            // matches the file rather than counting from whenever the popup
            // noticed. Rounded — sub-second precision is noise here.
            const { recordingStartTime } = await chrome.storage.local.get('recordingStartTime');
            Analytics.track('recording_completed', {
                duration_seconds: recordingStartTime
                    ? Math.max(0, Math.round((Date.now() - recordingStartTime) / 1000))
                    : null,
                file_size_mb: typeof response.size === 'number'
                    ? Math.round((response.size / (1024 * 1024)) * 100) / 100
                    : null,
            });

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

/** Tells every tab's floating button whether a recording is running.
 *
 * fab.js has always listened for recordingStarted/recordingStopped — nothing
 * ever sent them. Its record button therefore stayed on "Start Recording" for
 * the whole take, and pressing it fired a second startRecording instead of
 * stopping the first. */
async function broadcastRecordingState(action) {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
        tabs
            .filter(tab => !TabUtils.isRestrictedUrl(tab.url))
            .map(tab =>
                chrome.tabs.sendMessage(tab.id, { action })
                    .catch(() => { /* no content script in this tab */ })
            )
    );
}

// Broadcast hide overlay to ALL tabs immediately and in parallel
async function broadcastHideOverlay() {
    console.log('[SnapRec] Broadcasting hide overlay to all tabs');
    recordingTabId = null;
    await chrome.storage.local.set({ isRecording: false, recordingStartTime: null });

    const tabs = await chrome.tabs.query({});
    // Fire all messages in parallel - don't wait for individual responses
    await Promise.allSettled(
        tabs
            .filter(tab => !TabUtils.isRestrictedUrl(tab.url))
            .map(tab =>
                chrome.tabs.sendMessage(tab.id, { action: 'hideRecordingOverlay' })
                    .catch(() => { /* ignore tabs without content script */ })
            )
    );
    await broadcastRecordingState('recordingStopped');
    // And the popup, if it happens to be open. Stopping from the in-page bar
    // or Chrome's own "Stop sharing" banner otherwise left it sitting on a
    // running timer for a recording that had already ended.
    notifyPopup({ action: 'recordingStopped' });
}

async function finalizeCleanup() {
    console.log('[SnapRec] Finalizing cleanup');
    await closeOffscreenDocument();
    // Overlay hiding already happened in broadcastHideOverlay
    // Just ensure state is clean
    recordingTabId = null;
    await chrome.storage.local.set({ isRecording: false, recordingStartTime: null });
}

// ... existing code ...

/** Ten minutes. A local disk write of a multi-gigabyte capture is seconds, so
 * this is not a deadline — it is the guard against waiting forever on a
 * download that will never report, which would leave the preview tab unopened. */
const DISK_SAVE_TIMEOUT_MS = 600_000;

/** Writes the capture to disk before anything else is attempted.
 *
 * This is the promise the product used to break. The recording existed as one
 * in-memory Blob in the offscreen document, and the chunked handoff that was
 * meant to rescue it could not finish inside its own kill timer for anything
 * longer than a few minutes — so the timer fired, the document closed, and the
 * only copy went with it. Disk first, then everything else: a failed upload, a
 * closed tab or a dead network now costs a link, not the recording.
 *
 * Awaits settling rather than starting, because the blob: URL belongs to the
 * offscreen document and Chrome is still reading through it. finalizeCleanup
 * must not run until this returns. */
async function saveRecordingToDisk() {
    const info = await chrome.runtime
        .sendMessage({ action: 'offscreen_getBlobUrl' })
        .catch((e) => ({ success: false, error: e.message }));

    const fail = (reason) => {
        console.error('[SnapRec] Could not save recording to disk:', reason);
        Analytics.track('recording_download_failed', {
            surface: 'auto_save',
            error_reason: String(reason),
        });
        chrome.notifications.create('snaprec-autosave-failed', {
            type: 'basic',
            iconUrl: '../icons/icon128.png',
            title: 'Could not save your recording',
            message: 'SnapRec could not write the file to your Downloads folder. '
                + 'Use the preview tab to download it before closing that tab.',
            priority: 2,
        });
        return null;
    };

    if (!info?.success) return fail(info?.error ?? 'no blob');

    const filename = SnapRecFile.recordingFilename(new Date(), info.mimeType);

    const started = await new Promise((resolve) => {
        chrome.downloads.download({ url: info.url, filename, saveAs: false }, (downloadId) => {
            resolve(SnapRecFile.downloadStarted(downloadId, chrome.runtime.lastError?.message));
        });
    });
    if (!started.ok) return fail(started.reason);

    const settled = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve({ ok: false, reason: 'timeout' });
        }, DISK_SAVE_TIMEOUT_MS);

        const onChanged = (delta) => {
            const outcome = SnapRecFile.downloadSettled(delta, started.downloadId);
            if (!outcome) return;
            clearTimeout(timer);
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve(outcome);
        };
        chrome.downloads.onChanged.addListener(onChanged);
    });
    if (!settled.ok) return fail(settled.reason);

    console.log('[SnapRec] Recording saved to disk:', filename, info.size, 'bytes');
    Analytics.track('recording_download_completed', {
        surface: 'auto_save',
        file_size_mb: Math.round((info.size / (1024 * 1024)) * 100) / 100,
    });
    return { filename, bytes: info.size, mimeType: info.mimeType };
}

/** The screenshot's disk copy, on the same terms as a recording's.
 *
 * Shares saveRecordingToDisk's contract: the blob: URL belongs to the offscreen
 * document, so the write is awaited rather than merely started. */
async function saveImageToDisk() {
    const info = await chrome.runtime
        .sendMessage({ action: 'offscreen_getBlobUrl', kind: 'image' })
        .catch((e) => ({ success: false, error: e.message }));
    if (!info?.success) {
        console.error('[SnapRec] No image to save to disk:', info?.error);
        return null;
    }

    const filename = SnapRecFile.recordingFilename(new Date(), info.mimeType);
    const started = await new Promise((resolve) => {
        chrome.downloads.download({ url: info.url, filename, saveAs: false }, (downloadId) => {
            resolve(SnapRecFile.downloadStarted(downloadId, chrome.runtime.lastError?.message));
        });
    });
    if (!started.ok) {
        console.error('[SnapRec] Screenshot download refused:', started.reason);
        return null;
    }

    const settled = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve({ ok: false, reason: 'timeout' });
        }, DISK_SAVE_TIMEOUT_MS);
        const onChanged = (delta) => {
            const outcome = SnapRecFile.downloadSettled(delta, started.downloadId);
            if (!outcome) return;
            clearTimeout(timer);
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve(outcome);
        };
        chrome.downloads.onChanged.addListener(onChanged);
    });
    if (!settled.ok) {
        console.error('[SnapRec] Screenshot download failed:', settled.reason);
        return null;
    }

    console.log('[SnapRec] Screenshot saved to disk:', filename, info.size, 'bytes');
    return { filename, bytes: info.size, mimeType: info.mimeType };
}

/** Parks the image and opens the editor on it.
 *
 * The courier carries the Blob by reference, so this costs the same for a
 * 16,000px page as for a short one. */
async function deliverImageToEditor() {
    const imageId = crypto.randomUUID();
    const parked = await chrome.runtime.sendMessage({
        action: 'offscreen_persistForHandoff', id: imageId, metadataStr: '[]', kind: 'image',
    }).catch((e) => ({ success: false, error: e.message }));

    if (!parked?.success) {
        console.error('[SnapRec] Could not park screenshot:', parked?.error);
        return;
    }

    const tab = await chrome.tabs.create({ url: `${CONFIG.WEB_BASE_URL}/editor` });
    const frameUrl = chrome.runtime.getURL(
        `handoff/handoff.html?kind=image&id=${encodeURIComponent(imageId)}`);

    const listener = async (tabId, info) => {
        if (tabId !== tab.id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (src) => {
                    const frame = document.createElement('iframe');
                    frame.src = src;
                    frame.setAttribute('aria-hidden', 'true');
                    frame.style.cssText =
                        'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
                    document.documentElement.appendChild(frame);
                },
                args: [frameUrl],
            });
        } catch (err) {
            console.error('[SnapRec] Could not inject image handoff frame:', err.message);
        }
    };
    chrome.tabs.onUpdated.addListener(listener);
}

async function handleRecordingComplete() {
    console.log('[SnapRec] handleRecordingComplete called (local-first)');

    // Clear recording state before opening the share tab. When the user stops
    // via Chrome's native "Stop sharing" button, offscreen sends recordingComplete
    // directly and the manual stopRecording → broadcastHideOverlay path is skipped.
    // Without this, tabs.onActivated/onUpdated still see isRecording=true and
    // inject the recording overlay into the freshly-created share tab.
    const { isRecording } = await chrome.storage.local.get('isRecording');
    if (isRecording) {
        await broadcastHideOverlay();
    }

    try {
        const { captureCount = 0 } = await chrome.storage.local.get('captureCount');
        await chrome.storage.local.set({ captureCount: captureCount + 1 });

        /* Recordings only, for the rating prompt's gate. captureCount above is
         * incremented by screenshots too, so it cannot answer "has this person
         * finished a recording yet". This function is the single funnel: both
         * the in-page stop bar and Chrome's native "Stop sharing" reach it. */
        const { completedRecordingsCount = 0 } =
            await chrome.storage.local.get('completedRecordingsCount');
        await chrome.storage.local.set({
            completedRecordingsCount: completedRecordingsCount + 1,
        });

        // Generate a UUID for the recording immediately
        const recordingId = crypto.randomUUID();

        // IMMEDIATELY redirect to /v (generic preview)
        console.log('[SnapRec] Redirecting to share page immediately...');
        const shareUrl = `${CONFIG.WEB_BASE_URL}/v`;
        const tab = await chrome.tabs.create({ url: shareUrl });

        /* No disk copy on the happy path.
         *
         * This used to write every recording to Downloads unconditionally,
         * which was the fastest way to stop captures vanishing but filled the
         * user's folder with files they never asked for. The courier now waits
         * for the page to acknowledge the capture, so a failed handoff is
         * detectable — and the disk write happens then, and only then. See
         * the 'handoffFailed' handler.
         *
         * The capture is not at risk in the meantime: it is parked in
         * extension-origin IndexedDB before finalizeCleanup runs, so closing
         * the offscreen document no longer destroys it. */
        const savedFile = null;

        /* Park the capture, then close the recorder. Once the blob is in
         * extension-origin IndexedDB it no longer depends on the offscreen
         * document staying alive, which removes the race this code used to
         * lose: Chrome reaps an offscreen document once its media tracks stop,
         * and the old chunked transfer took minutes. */
        const parked = await chrome.runtime.sendMessage({
            action: 'offscreen_persistForHandoff',
            id: recordingId,
            metadataStr: JSON.stringify(recordingMetadata),
        }).catch((e) => ({ success: false, error: e.message }));

        if (!parked?.success) {
            console.error('[SnapRec] Could not park capture for handoff:', parked?.error);
        }
        await finalizeCleanup();

        /* The courier is same-origin with the parked blob and can hand it to
         * the page by reference. Injected on tab load rather than immediately:
         * an about:blank tab has no document to append to yet. */
        const frameUrl = chrome.runtime.getURL(
            `handoff/handoff.html?id=${encodeURIComponent(recordingId)}`);

        const listener = async (tabId, info) => {
            if (tabId !== tab.id || info.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(listener);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (src) => {
                        const frame = document.createElement('iframe');
                        frame.src = src;
                        frame.setAttribute('aria-hidden', 'true');
                        frame.style.cssText =
                            'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
                        document.documentElement.appendChild(frame);
                    },
                    args: [frameUrl],
                });
                console.log('[SnapRec] Handoff frame injected');
            } catch (err) {
                console.error('[SnapRec] Could not inject handoff frame:', err.message);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);

        /* The popup's completion view has existed since the plate redesign and
         * has never once been reachable: nothing sent captureFinished. This is
         * the sender. Best-effort — the popup is usually closed, which is fine. */
        notifyPopup({
            action: 'captureFinished',
            capture: {
                id: recordingId,
                bytes: savedFile?.bytes ?? 0,
                mimeType: savedFile?.mimeType ?? 'video/webm',
                filename: savedFile?.filename ?? null,
            },
        });

        // We skip all backend calls here - web app will handle it now.
    } catch (error) {
        console.error('[SnapRec] Error handling recording completion:', error);
        await finalizeCleanup();
    }
}



/** The safety net, armed only when delivery actually failed.
 *
 * handoff/handoff.js re-sends the capture until the page acknowledges it. If
 * nothing acknowledges within its window the capture is in extension storage
 * with no one holding it, and the browser is the only place left to put it.
 * This is the one path that writes to Downloads. */
chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== 'handoffFailed') return;

    const kind = message.kind === 'image' ? 'image' : 'video';
    console.warn('[SnapRec] Handoff was never acknowledged; saving', kind, 'to disk');

    const save = kind === 'image' ? saveImageToDisk() : saveRecordingToDisk();
    save.then((saved) => {
        if (!saved) return;
        chrome.notifications.create('snaprec-handoff-fallback', {
            type: 'basic',
            iconUrl: '../icons/icon128.png',
            title: 'Saved to your Downloads folder',
            message: `SnapRec could not open your capture in the app, so it was `
                + `saved as ${saved.filename.replace(/^.*\//, '')} instead.`,
            priority: 2,
        });
    });
});

// Separate listener for upload completion and audio warnings from offscreen document
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'offscreen_uploadComplete') {
        console.log('[SnapRec] Upload complete signal received from offscreen');
        finalizeCleanup();
    } else if (message.action === 'offscreen_uploadError') {
        console.error('[SnapRec] Upload error reported by offscreen:', message.error);
        finalizeCleanup();
    } else if (message.action === 'offscreen_audioWarning') {
        const hints = {
            mic_permission_denied: 'Microphone permission denied — recording will have no mic audio.',
            mic_unavailable: 'Microphone could not be accessed — recording will have no mic audio.',
            system_audio_unavailable:
                'System audio capture returned no tracks. ' +
                'On macOS this is a browser limitation for full-screen/window recording. ' +
                'On Windows, tick "Share audio" in the screen picker to capture system sound.'
        };
        console.warn('[SnapRec] Audio warning:', hints[message.warning] || message.warning);

        if (message.warning === 'mic_permission_denied' || message.warning === 'mic_unavailable') {
            chrome.notifications.create('snaprec-mic-denied', {
                type: 'basic',
                iconUrl: '../icons/icon128.png',
                title: 'Microphone not recording',
                message: hints[message.warning] + ' Click to open Chrome microphone settings.',
                priority: 2
            });
        }
    }
});

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'snaprec-mic-denied') {
        chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
        chrome.notifications.clear('snaprec-mic-denied');
    }
});


// Context menu
chrome.runtime.onInstalled.addListener((details) => {
    // Analytics: first install only. 'update' and 'chrome_update' fire here too,
    // and counting those as installs would inflate the number on every release.
    //
    // Queued to storage rather than sent from here. This listener returns
    // immediately, and Chrome may stop the worker straight afterwards — a fetch
    // still in flight at that moment would take the one install event this
    // profile will ever produce with it. queueInstall persists it; the flushes
    // below (and INSTALL_FLUSH_ALARM) get it delivered.
    if (details?.reason === 'install') {
        Analytics.queueInstall().then(() => Analytics.flushPendingInstall());
        chrome.alarms.create(INSTALL_FLUSH_ALARM, { delayInMinutes: 1, periodInMinutes: 5 });
    }

    /* The page Chrome opens when SnapRec is removed.
     *
     * Set on every onInstalled reason, not just 'install': the URL is stored by
     * the browser rather than read at uninstall time, so an install that never
     * updates and an update that changes the URL both have to (re)register it.
     * Chrome keeps only the most recent value, so calling it repeatedly is
     * idempotent.
     *
     * Guarded and wrapped: setUninstallURL rejects a malformed or non-HTTPS URL
     * by throwing, and losing the context menu below over a survey link would be
     * a bad trade. */
    if (chrome.runtime.setUninstallURL) {
        try {
            // Trailing slash is load-bearing: the bare path 301s, and a stored
            // uninstall URL that needs a redirect is one more thing that can
            // fail at the only moment this page is ever opened.
            chrome.runtime.setUninstallURL(`${CONFIG.WEB_BASE_URL}/uninstall-survey/`, () => {
                // Reading lastError stops an unchecked-error warning in the
                // service worker console when the URL is rejected.
                void chrome.runtime.lastError;
            });
        } catch (e) {
            console.warn('[SnapRec] Could not set uninstall URL:', e);
        }
    }

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

// Re-inject overlay when switching tabs during recording
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const { isRecording, recordingOptions } = await chrome.storage.local.get(['isRecording', 'recordingOptions']);
        if (isRecording) {
            console.log('[SnapRec] Tab activated during recording, injecting overlay into tab:', activeInfo.tabId);
            await injectRecordingOverlay(activeInfo.tabId, recordingOptions);
        }
    } catch (error) {
        console.warn('[SnapRec] Could not inject overlay on tab activation (likely restricted page):', error.message);
    }
});

// Re-inject overlay when a tab is refreshed or navigates during recording
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        if (changeInfo.status === 'complete' && !TabUtils.isRestrictedUrl(tab.url)) {
            const { isRecording, recordingOptions } = await chrome.storage.local.get(['isRecording', 'recordingOptions']);
            if (isRecording) {
                // Check if already injected to avoid duplicates
                const isAlreadyInjected = await TabUtils.ensureContentScript(tabId);
                console.log('[SnapRec] Tab updated during recording, isAlreadyInjected:', isAlreadyInjected);

                console.log('[SnapRec] Injecting/Updating overlay in tab:', tabId);
                await injectRecordingOverlay(tabId, recordingOptions);
            }
        }
    } catch (error) {
        console.warn('[SnapRec] Could not inject overlay on tab update (likely restricted page):', error.message);
    }
});


/* ==========================================================================
 * Offline upload queue
 *
 * A capture that cannot upload right now is queued, not failed. The promise
 * this keeps is "closing the window does not stop the upload" — which is why
 * the queue lives in the service worker and is persisted, not held in the
 * popup.
 * ======================================================================== */

const QUEUE_KEY = 'snaprecUploadQueue';
const DRAIN_ALARM = 'snaprec-drain-queue';
const RETENTION_MS = 86_400_000; // 24h, for completed items only

async function readQueue() {
  const { [QUEUE_KEY]: q = [] } = await chrome.storage.local.get(QUEUE_KEY);
  return q;
}

async function writeQueue(q) {
  await chrome.storage.local.set({ [QUEUE_KEY]: q });
}

async function queueCapture(item) {
  await writeQueue(SnapRecQueue.enqueue(await readQueue(), item));
  chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0.5 });
}

/** Best-effort notify: the popup is usually closed, and that is fine. */
/** Speaks to the popup, which is a runtime listener rather than a tab.
 *
 * The popup is usually closed and sendMessage then rejects with "Receiving end
 * does not exist" — the normal case here, not an error. */
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function drainQueue() {
  let q = SnapRecQueue.prune(await readQueue(), Date.now(), RETENTION_MS);

  const next = SnapRecQueue.nextPending(q);
  if (!next) {
    await writeQueue(q);
    return;
  }

  if (!navigator.onLine) {
    await writeQueue(q);
    chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 1 });
    return;
  }

  q = SnapRecQueue.markUploading(q, next.id, next.offsetPct);
  await writeQueue(q);

  try {
    const url = await uploadQueuedCapture(next, (pct, bytes) =>
      notifyPopup({ action: 'uploadProgress', id: next.id, pct, bytes }));

    await writeQueue(SnapRecQueue.markDone(await readQueue(), next.id, url));
    notifyPopup({ action: 'linkReady', id: next.id, url });

    // Keep draining while there is work; the short delay yields to other tasks.
    chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0.05 });
  } catch (err) {
    const failed = SnapRecQueue.markFailed(
      await readQueue(), next.id, String(err), next.offsetPct);
    await writeQueue(failed);

    const { attempts } = failed.find((i) => i.id === next.id);
    notifyPopup({
      action: 'uploadFailed', id: next.id, reason: String(err), at: next.offsetPct,
    });
    chrome.alarms.create(DRAIN_ALARM, {
      delayInMinutes: SnapRecQueue.backoffMs(attempts) / 60_000,
    });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DRAIN_ALARM) drainQueue();
});

self.addEventListener('online', () => {
  chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0 });
});


/** Answers the web app's connectivity ping (scene H5).
 *
 * Only origins in manifest.externally_connectable can reach this, and the reply
 * carries the version only — no capture data crosses the boundary. */
chrome.runtime.onMessageExternal.addListener((message, _sender, respond) => {
    if (message?.type === 'PING') {
        respond({ version: chrome.runtime.getManifest().version });
        return false;
    }

    /* The web app handing over its PostHog identity and how the visitor got
     * here. Without it the site's visitor and this install are two unrelated
     * people in PostHog and the activation funnel cannot span them.
     *
     * Nothing is sent back and nothing is read out of the page: this is one
     * anonymous analytics id crossing a boundary that manifest
     * externally_connectable already restricts to snaprecorder.org. */
    if (message?.type === 'SNAPREC_ANALYTICS_IDENTITY') {
        Analytics.linkWebIdentity({
            distinctId: message.distinctId,
            source: message.source,
        })
            // The source is what the queued install event was waiting for.
            .then(() => Analytics.flushPendingInstall())
            .then((sent) => respond({ ok: true, installSent: sent }))
            .catch(() => respond({ ok: false }));
        return true;   // async response
    }

    return false;
});

/* Retry for an install event that could not be sent — an offline first run, a
 * blocked domain, or a worker killed mid-flight. Also the deadline: after the
 * grace window flushPendingInstall stops waiting for the web handshake and
 * sends with install_source 'unknown', because an install counted without its
 * source still beats an install never counted. Clears itself once delivered. */
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== INSTALL_FLUSH_ALARM) return;
    Analytics.flushPendingInstall()
        .then(() => Analytics.hasPendingInstall())
        // "Nothing pending" covers both a delivered event and one dropped
        // because the user opted out; neither wants the alarm to keep running.
        .then((stillPending) => {
            if (!stillPending) chrome.alarms.clear(INSTALL_FLUSH_ALARM);
        });
});

// Cold start: pick up anything a previous worker left undelivered.
Analytics.flushPendingInstall();

// SnapRec Offscreen Recording Script
// This script handles MediaRecorder in a persistent context that survives tab navigations

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let audioContext = null;

// Track ALL original streams so we can stop every hardware capture
let originalDisplayStream = null;
let originalMicStream = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Offscreen] Received message:', message.action);

    // Only handle messages prefixed with 'offscreen_'
    if (!message.action || !message.action.startsWith('offscreen_')) {
        return false; // Not for us, don't keep channel open
    }

    switch (message.action) {
        case 'offscreen_startRecording':
            startRecording(message.options)
                .then((result) => sendResponse({ success: true, streamReady: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response

        case 'offscreen_startMediaRecorder':
            // Actually start recording after countdown
            startMediaRecorder()
                .then((result) => sendResponse({ success: true, startTime: result.startTime, mimeType: result.mimeType }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response

        case 'offscreen_stopRecording':
            stopRecording()
                .then(result => sendResponse({ success: true, size: result.size }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response


        case 'offscreen_grabFrame':
            grabSourceFrame(message.maxWidth)
                .then((dataUrl) => sendResponse({ dataUrl }))
                .catch(() => sendResponse({ dataUrl: null }));
            return true; // Async response

        case 'offscreen_setMicMuted':
            sendResponse({ success: setMicMuted(message.muted) });
            return false;

        case 'offscreen_pauseRecording':
            pauseRecording();
            sendResponse({ success: true });
            return false; // Sync response already sent

        case 'offscreen_resumeRecording':
            resumeRecording();
            sendResponse({ success: true });
            return false; // Sync response already sent

        case 'offscreen_getRecordingState':
            sendResponse({
                isRecording: mediaRecorder !== null && mediaRecorder.state !== 'inactive',
                isPaused: mediaRecorder?.state === 'paused',
                state: mediaRecorder?.state || 'inactive'
            });
            return false; // Sync response already sent

        case 'offscreen_cropImage':
            cropImage(message.dataUrl, message.rect)
                .then(croppedDataUrl => sendResponse({ success: true, dataUrl: croppedDataUrl }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response

        case 'offscreen_getRecordingBlob':
            getRecordingBlobBase64()
                .then(dataUrl => sendResponse({ success: true, dataUrl }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_persistForHandoff':
            persistForHandoff(message.id, message.metadataStr, message.kind)
                .then(result => sendResponse({ success: true, size: result.size, type: result.type }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_getRecordingBlobAsArrayBuffer':
            getRecordingBlobAsArray()
                .then(result => sendResponse({ success: true, blobArray: result.blobArray, mimeType: result.mimeType, size: result.size }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_getBlobInfo':
            if (!currentRecordingBlob) {
                sendResponse({ success: false, error: 'No recording available' });
            } else {
                sendResponse({
                    success: true,
                    size: currentRecordingBlob.size,
                    mimeType: currentRecordingBlob.type || 'video/webm'
                });
            }
            return false;

        /* A handle to the capture that chrome.downloads can read.
         *
         * The URL belongs to THIS document, so the document must outlive the
         * write — see saveRecordingToDisk, which waits for the download to
         * settle rather than merely to start. Not revoked here for the same
         * reason; closing the document releases it. */
        case 'offscreen_getBlobUrl': {
            const blob = message.kind === 'image' ? currentImageBlob : currentRecordingBlob;
            if (!blob) {
                sendResponse({ success: false, error: 'No capture available' });
            } else {
                sendResponse({
                    success: true,
                    url: URL.createObjectURL(blob),
                    size: blob.size,
                    mimeType: blob.type || (message.kind === 'image' ? 'image/webp' : 'video/webm'),
                });
            }
            return false;
        }

        case 'offscreen_fpBegin':
            try {
                const { width, height } = globalThis.SnapRecFullPage.canvasSize(message);
                fpCanvas = new OffscreenCanvas(width, height);
                fpCtx = fpCanvas.getContext('2d');
                // White, not transparent: a page with no background of its own
                // would otherwise encode as black once alpha is flattened.
                fpCtx.fillStyle = '#FFFFFF';
                fpCtx.fillRect(0, 0, width, height);
                currentImageBlob = null;
                console.log('[Offscreen] Full-page canvas', width, 'x', height);
                sendResponse({ success: true, width, height });
            } catch (e) {
                fpCanvas = null; fpCtx = null;
                sendResponse({ success: false, error: e.message });
            }
            return false;

        case 'offscreen_fpSection':
            drawFullPageSection(message)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_fpFinish':
            finishFullPage()
                .then(r => sendResponse({ success: true, ...r }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_getBlobChunk':
            if (!currentRecordingBlob) {
                sendResponse({ success: false, error: 'No recording available' });
                return false;
            }
            currentRecordingBlob.slice(message.offset, message.offset + message.length).arrayBuffer()
                .then(buf => sendResponse({ success: true, chunk: Array.from(new Uint8Array(buf)) }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
    }
});

// Store combined stream for later use
let pendingStream = null;
let pendingVideoTracks = null;

async function startRecording(options) {
    console.log('[Offscreen] Starting recording with options:', options);

    try {
        // Clean up any previous recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            console.log('[Offscreen] Stopping previous recording');
            mediaRecorder.stop();
            cleanup();
        }

        // Use getDisplayMedia in the offscreen document
        // Note: This may show another picker in some cases, but it's the only reliable method
        let displayStream;
        try {
            // Build display media constraints
            // Note: Setting audio: false explicitly can cause issues in some browsers
            // So we only include the audio constraint when it should be enabled
            //
            // The video half comes from resolution.js, which turns the popup's
            // resolution label into width/height maxima. This block used to
            // hardcode `{ cursor: 'always' }`, so the picker never affected the
            // recording. Falls back to uncapped if the helper somehow is not
            // loaded — a recording at the wrong resolution beats no recording.
            const displayMediaConstraints = globalThis.SnapRecResolution
                ? globalThis.SnapRecResolution.displayConstraints(options.resolution)
                : { video: { cursor: 'always' } };

            console.log('[Offscreen] Resolution:', options.resolution ?? '(unset)',
                '-> constraints:', JSON.stringify(displayMediaConstraints.video));

            // Only add audio constraint if system audio is requested
            if (options.systemAudio) {
                displayMediaConstraints.audio = true;
            }

            displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaConstraints);
            originalDisplayStream = displayStream; // Store original reference
            console.log('[Offscreen] Got display stream via getDisplayMedia');
        } catch (displayError) {
            console.error('[Offscreen] getDisplayMedia failed:', displayError);
            throw new Error('Screen capture was cancelled or failed: ' + displayError.message);
        }

        // Get microphone stream if enabled
        let audioTracks = [];
        let micWarning = null;
        if (options.microphone) {
            try {
                console.log('[Offscreen] Requesting microphone access...');
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                originalMicStream = micStream; // Store original reference
                audioTracks = micStream.getAudioTracks();
                console.log('[Offscreen] Microphone tracks acquired:', audioTracks.length);
            } catch (e) {
                console.warn('[Offscreen] Could not get microphone:', e.name, e.message);
                micWarning = e.name === 'NotAllowedError' ? 'mic_permission_denied' : 'mic_unavailable';
                chrome.runtime.sendMessage({ action: 'offscreen_audioWarning', warning: micWarning });
            }
        }

        // Get audio tracks from display stream (system audio)
        const displayAudioTracks = displayStream.getAudioTracks();
        console.log('[Offscreen] Display audio tracks:', displayAudioTracks.length);

        // Warn when system audio was requested but the browser/OS returned no audio tracks.
        // This happens on macOS for full-screen/window captures (OS restriction) and on
        // Windows/Linux when the user did not tick "Share audio" in the screen picker.
        if (options.systemAudio && displayAudioTracks.length === 0) {
            console.warn('[Offscreen] System audio requested but no audio tracks in display stream. ' +
                'On macOS this is expected for full-screen/window capture. On Windows, ensure ' +
                '"Share audio" / "Share system audio" is checked in the screen picker.');
            chrome.runtime.sendMessage({ action: 'offscreen_audioWarning', warning: 'system_audio_unavailable' });
        }

        // Combine streams
        const videoTracks = displayStream.getVideoTracks();
        let combinedStream;

        if (audioTracks.length > 0 && displayAudioTracks.length > 0) {
            // Mix both audio sources using AudioContext
            console.log('[Offscreen] Mixing microphone and system audio');
            audioContext = new AudioContext();
            // Resume in case Chrome's autoplay policy starts the context suspended
            // (offscreen documents have no direct user gesture)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            const destination = audioContext.createMediaStreamDestination();

            const systemAudioSource = audioContext.createMediaStreamSource(
                new MediaStream(displayAudioTracks)
            );
            systemAudioSource.connect(destination);

            const micSource = audioContext.createMediaStreamSource(
                new MediaStream(audioTracks)
            );
            micSource.connect(destination);

            combinedStream = new MediaStream([
                ...videoTracks,
                ...destination.stream.getAudioTracks()
            ]);
        } else if (audioTracks.length > 0) {
            console.log('[Offscreen] Using microphone audio only');
            combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
        } else if (displayAudioTracks.length > 0) {
            console.log('[Offscreen] Using system audio only');
            combinedStream = new MediaStream([...videoTracks, ...displayAudioTracks]);
        } else {
            console.log('[Offscreen] No audio sources');
            combinedStream = new MediaStream(videoTracks);
        }

        // Store stream for later (after countdown)
        pendingStream = combinedStream;
        pendingVideoTracks = videoTracks;
        recordingStream = combinedStream;

        console.log('[Offscreen] Stream ready, waiting for countdown to complete');
        return { streamReady: true };

    } catch (error) {
        console.error('[Offscreen] Error starting recording:', error);
        throw error;
    }
}

// Start the MediaRecorder after countdown completes
async function startMediaRecorder() {
    console.log('[Offscreen] Starting MediaRecorder after countdown');

    if (!pendingStream) {
        throw new Error('No stream available. Please try again.');
    }

    // Create MediaRecorder with fallback mimeTypes
    let recorderOptions = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
        recorderOptions = { mimeType: 'video/webm;codecs=vp8' };
    }
    if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
        recorderOptions = { mimeType: 'video/webm' };
    }

    mediaRecorder = new MediaRecorder(pendingStream, recorderOptions);
    console.log('[Offscreen] MediaRecorder created with mimeType:', recorderOptions.mimeType);

    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
            console.log('[Offscreen] Chunk received, total chunks:', recordedChunks.length);
        }
    };

    mediaRecorder.onerror = (e) => {
        console.error('[Offscreen] MediaRecorder error:', e.error);
    };

    // Handle stream ending (user stops sharing via browser UI)
    if (pendingVideoTracks && pendingVideoTracks[0]) {
        pendingVideoTracks[0].onended = () => {
            console.log('[Offscreen] Video track ended');
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                stopRecording().then(dataUrl => {
                    // Notify background that recording ended
                    chrome.runtime.sendMessage({
                        action: 'recordingComplete',
                        dataUrl: dataUrl
                    });
                });
            }
        };
    }

    // Start recording with timeslice to collect chunks periodically
    mediaRecorder.start(1000);
    const startTime = Date.now();
    console.log('[Offscreen] Recording started at:', startTime);

    // Clear pending state
    pendingStream = null;
    pendingVideoTracks = null;

    // mimeType is reported for analytics `format`. Read from the recorder rather
    // than recorderOptions so it reflects what the browser actually negotiated.
    return { startTime, mimeType: mediaRecorder.mimeType || recorderOptions.mimeType };
}

let currentRecordingBlob = null;

/** The full-page capture being assembled, and its finished Blob.
 *
 * Kept separate from currentRecordingBlob so a screenshot can never overwrite
 * a recording that has not been delivered yet. */
let fpCanvas = null;
let fpCtx = null;
let currentImageBlob = null;

async function stopRecording() {
    console.log('[Offscreen] Stopping recording');

    return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            console.warn('[Offscreen] No active recording to stop');
            reject(new Error('No active recording'));
            return;
        }

        mediaRecorder.onstop = async () => {
            console.log('[Offscreen] Recording stopped, creating blob...');

            try {
                // Stop tracks immediately to remove the "Sharing screen" banner
                cleanupTracks();

                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
                console.log('[Offscreen] Blob created, size:', blob.size);
                currentRecordingBlob = blob;

                // Notify background that we have the blob
                chrome.runtime.sendMessage({
                    action: 'offscreen_recordingBlobReady',
                    size: blob.size,
                    type: blob.type
                });

                resolve({ size: blob.size });
            } catch (error) {
                console.error('[Offscreen] Error creating blob:', error);
                cleanup();
                reject(error);
            }
        };

        mediaRecorder.stop();
    });
}

async function getRecordingBlobBase64() {
    if (!currentRecordingBlob) {
        throw new Error('No recording blob available');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(currentRecordingBlob);
    });
}

/** Parks the capture in extension-origin IndexedDB.
 *
 * This is what unhooks the capture from this document's lifetime. Once the
 * blob is here, the offscreen document can close immediately and Chrome can
 * reap it — which it wants to do the moment the media tracks stop — without
 * taking the recording with it. handoff/handoff.js, same origin, reads it back. */
async function persistForHandoff(id, metadataStr, kind = 'video') {
    const blob = kind === 'image' ? currentImageBlob : currentRecordingBlob;
    if (!blob) throw new Error('No capture available');

    // Images and recordings use separate keys so a screenshot can never
    // overwrite a recording that has not reached the share page yet. There is
    // deliberately no store.clear() here for the same reason.
    const blobKey = kind === 'image' ? 'latest_image_blob' : 'latest_video_blob';
    const idKey = kind === 'image' ? 'latest_image_id' : 'latest_id';
    const metaKey = kind === 'image' ? 'latest_image_meta' : 'latest_metadata';
    const tsKey = kind === 'image' ? 'latest_image_timestamp' : 'latest_video_timestamp';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnapRecDB', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings');
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            store.put(blob, blobKey);
            store.put(id, idKey);
            store.put(metadataStr, metaKey);
            store.put(Date.now(), tsKey);

            transaction.oncomplete = () => {
                console.log('[Offscreen] Capture parked for handoff,', kind, blob.size);
                resolve({ size: blob.size, type: blob.type });
            };
            transaction.onerror = () => reject(new Error('Failed to park capture for handoff'));
        };

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
}

// Return the recording blob as a serializable array of byte values
// This can be passed through chrome.scripting.executeScript args
// and reconstructed as a Blob in the target page's context
async function getRecordingBlobAsArray() {
    if (!currentRecordingBlob) {
        throw new Error('No recording blob available');
    }

    const arrayBuffer = await currentRecordingBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Convert to plain array for serialization through Chrome messaging
    return {
        blobArray: Array.from(uint8Array),
        mimeType: currentRecordingBlob.type || 'video/webm',
        size: currentRecordingBlob.size
    };
}

/** Draws one scrolled section onto the full-page canvas.
 *
 * The section arrives as a data URL because that is what captureVisibleTab
 * returns, but it is a single viewport — around a megabyte — not the whole
 * page, so it crosses IPC comfortably. The whole point of this function's
 * existing here is that the assembled result never does. */
async function drawFullPageSection({ dataUrl, sourceYCss, drawHCss, destYCss, dpr, scale }) {
    if (!fpCtx) throw new Error('No full-page capture in progress');

    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    try {
        // captureVisibleTab returns device pixels, so the image is already
        // dpr-scaled; only the budget scale still has to be applied.
        const srcY = Math.round(sourceYCss * dpr);
        const srcH = Math.round(drawHCss * dpr);
        const dstY = Math.round(destYCss * dpr * scale);
        const dstH = Math.round(drawHCss * dpr * scale);
        const dstW = Math.round(bitmap.width * scale);

        fpCtx.drawImage(bitmap, 0, srcY, bitmap.width, srcH, 0, dstY, dstW, dstH);
    } finally {
        bitmap.close();
    }
}

/** Encodes the assembled canvas and returns a preview-sized copy with it.
 *
 * convertToBlob rather than toDataURL: no base64, so no 33% inflation and no
 * 64 MiB message ceiling. The thumbnail is what the in-page mini preview
 * displays — it used to be handed the full-size image for a card-sized slot. */
async function finishFullPage() {
    if (!fpCanvas) throw new Error('No full-page capture in progress');

    const blob = await fpCanvas.convertToBlob({ type: 'image/webp', quality: 0.92 });
    if (!blob || blob.size === 0) throw new Error('Encoding produced no image');
    currentImageBlob = blob;

    const t = globalThis.SnapRecFullPage.thumbnailSize({
        width: fpCanvas.width, height: fpCanvas.height,
    });
    const thumbCanvas = new OffscreenCanvas(t.width, t.height);
    thumbCanvas.getContext('2d').drawImage(fpCanvas, 0, 0, t.width, t.height);
    const thumbBlob = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
    const thumbnail = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(thumbBlob);
    });

    // Release the big canvas as soon as the bytes are safe.
    fpCanvas = null; fpCtx = null;

    console.log('[Offscreen] Full-page encoded,', blob.size, 'bytes');
    return { size: blob.size, mimeType: blob.type || 'image/webp', thumbnail };
}

async function cropImage(dataUrl, rect) {
    console.log('[Offscreen] Cropping image...', rect);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const dpr = rect.devicePixelRatio || 1;

                // Scale rectangle by device pixel ratio if needed
                // Note: captureVisibleTab results are already scaled by DPR
                const x = rect.x * dpr;
                const y = rect.y * dpr;
                const width = rect.width * dpr;
                const height = rect.height * dpr;

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

                const croppedDataUrl = canvas.toDataURL('image/png');
                console.log('[Offscreen] Image cropped successfully');
                resolve(croppedDataUrl);
            } catch (error) {
                console.error('[Offscreen] Crop error:', error);
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image for cropping'));
        img.src = dataUrl;
    });
}

// Note: Upload logic has been moved to background.js which has access to chrome.storage

/** A still of whatever the user actually chose to share.
 *
 * The popup cannot see this stream — a MediaStream does not cross contexts —
 * and it used to fall back to captureVisibleTab, which shows the tab that
 * happens to be in front rather than the source being recorded. Those are the
 * same thing only when recording the current tab.
 *
 * Frames rather than a stream: cheap enough at one a second, and it needs no
 * new permission. The video element is kept between calls because attaching
 * and playing one per frame costs far more than drawing from it. */
let previewVideo = null;
let previewCanvas = null;

async function grabSourceFrame(maxWidth = 320) {
    if (!originalDisplayStream) return null;
    const [track] = originalDisplayStream.getVideoTracks();
    if (!track || track.readyState !== 'live') return null;

    if (!previewVideo) {
        previewVideo = document.createElement('video');
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        previewVideo.srcObject = new MediaStream([track]);
        try {
            await previewVideo.play();
        } catch {
            previewVideo = null;
            return null;
        }
    }
    // play() resolves before the first frame has decoded, so the very first
    // grab — the one right after the picker is answered, which is the only
    // one the countdown gets — used to find a 0x0 video and return nothing.
    if (!previewVideo.videoWidth || !previewVideo.videoHeight) {
        await new Promise((resolve) => {
            const done = () => { clearTimeout(bail); resolve(); };
            const bail = setTimeout(resolve, 1200);
            previewVideo.addEventListener('loadeddata', done, { once: true });
        });
    }
    // Still nothing: report none rather than a blank canvas, which would read
    // as a black screen being recorded.
    if (!previewVideo.videoWidth || !previewVideo.videoHeight) return null;

    if (!previewCanvas) previewCanvas = document.createElement('canvas');
    const scale = Math.min(1, maxWidth / previewVideo.videoWidth);
    previewCanvas.width = Math.max(1, Math.round(previewVideo.videoWidth * scale));
    previewCanvas.height = Math.max(1, Math.round(previewVideo.videoHeight * scale));
    previewCanvas.getContext('2d').drawImage(
        previewVideo, 0, 0, previewCanvas.width, previewCanvas.height);
    return previewCanvas.toDataURL('image/jpeg', 0.55);
}

/** Mutes without stopping.
 *
 * track.enabled = false makes the track produce silence while staying in the
 * mixed stream, so the recording keeps a continuous audio timeline. Stopping
 * the track instead would end it for good — unmuting could not bring it back
 * without re-prompting for the microphone. */
function setMicMuted(muted) {
    if (!originalMicStream) return false;
    originalMicStream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    console.log('[Offscreen] Microphone', muted ? 'muted' : 'unmuted');
    return true;
}

function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        console.log('[Offscreen] Recording paused');
    }
}

function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        console.log('[Offscreen] Recording resumed');
    }
}

function cleanupTracks() {
    // Release the preview element too, or it holds a reference to a track
    // that is about to be stopped.
    if (previewVideo) {
        previewVideo.srcObject = null;
        previewVideo = null;
    }
    previewCanvas = null;

    // Stop ALL original streams to release hardware (camera light, mic)
    if (originalDisplayStream) {
        originalDisplayStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Offscreen] Original display track stopped:', track.kind);
        });
        originalDisplayStream = null;
    }

    if (originalMicStream) {
        originalMicStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Offscreen] Original mic track stopped:', track.kind);
        });
        originalMicStream = null;
    }

    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }

    if (pendingStream) {
        pendingStream.getTracks().forEach(track => track.stop());
        pendingStream = null;
    }
    pendingVideoTracks = null;

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

function cleanup() {
    console.log('[Offscreen] Cleaning up resources');
    cleanupTracks();
    mediaRecorder = null;
    recordedChunks = [];
}

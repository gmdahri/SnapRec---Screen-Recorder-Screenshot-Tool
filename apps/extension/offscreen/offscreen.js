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
                .then((result) => sendResponse({ success: true, startTime: result.startTime }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response

        case 'offscreen_stopRecording':
            stopRecording()
                .then(result => sendResponse({ success: true, size: result.size }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response


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

        case 'offscreen_storeRecordingBlob':
            storeRecordingBlobToIDB()
                .then(result => sendResponse({ success: true, size: result.size, type: result.type }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_getRecordingBlobAsArrayBuffer':
            getRecordingBlobAsArray()
                .then(result => sendResponse({ success: true, blobArray: result.blobArray, mimeType: result.mimeType, size: result.size }))
                .catch(error => sendResponse({ success: false, error: error.message }));
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
            const displayMediaConstraints = {
                video: {
                    cursor: 'always'
                }
            };

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
        if (options.microphone) {
            try {
                console.log('[Offscreen] Requesting microphone access...');
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                originalMicStream = micStream; // Store original reference
                audioTracks = micStream.getAudioTracks();
                console.log('[Offscreen] Microphone tracks acquired:', audioTracks.length);
            } catch (e) {
                console.warn('[Offscreen] Could not get microphone:', e);
            }
        }

        // Get audio tracks from display stream (system audio)
        const displayAudioTracks = displayStream.getAudioTracks();
        console.log('[Offscreen] Display audio tracks:', displayAudioTracks.length);

        // Combine streams
        const videoTracks = displayStream.getVideoTracks();
        let combinedStream;

        if (audioTracks.length > 0 && displayAudioTracks.length > 0) {
            // Mix both audio sources using AudioContext
            console.log('[Offscreen] Mixing microphone and system audio');
            audioContext = new AudioContext();
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

    return { startTime };
}

let currentRecordingBlob = null;

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

// Store the raw Blob directly into IndexedDB to avoid base64 conversion overhead
async function storeRecordingBlobToIDB() {
    if (!currentRecordingBlob) {
        throw new Error('No recording blob available');
    }

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
            store.put(currentRecordingBlob, 'latest_video_blob');

            transaction.oncomplete = () => {
                console.log('[Offscreen] Blob stored in IndexedDB, size:', currentRecordingBlob.size);
                resolve({ size: currentRecordingBlob.size, type: currentRecordingBlob.type });
            };
            transaction.onerror = () => {
                reject(new Error('Failed to store blob in IndexedDB'));
            };
        };

        request.onerror = () => {
            reject(new Error('Failed to open IndexedDB for blob storage'));
        };
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

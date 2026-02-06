// SnapRec Offscreen Recording Script
// This script handles MediaRecorder in a persistent context that survives tab navigations

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let audioContext = null;

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

        case 'offscreen_uploadVideo':
            uploadVideo(message.uploadUrl)
                .then(() => sendResponse({ success: true }))
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

        default:
            return false; // Unknown action
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
                const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
                console.log('[Offscreen] Blob created, size:', blob.size);
                currentRecordingBlob = blob;

                // Don't cleanup yet, we need the blob for upload
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

async function uploadVideo(uploadUrl) {
    if (!currentRecordingBlob) {
        throw new Error('No recording blob available to upload');
    }

    console.log('[Offscreen] Uploading blob to R2...', currentRecordingBlob.size);

    console.log('[Offscreen] Initiating fetch PUT request to:', uploadUrl.split('?')[0]);
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: currentRecordingBlob,
        headers: {
            'Content-Type': currentRecordingBlob.type || 'video/webm'
        }
    });

    console.log('[Offscreen] Fetch response received, ok:', response.ok, 'status:', response.status);

    if (!response.ok) {
        console.error('[Offscreen] Upload failed:', response.statusText);
        chrome.runtime.sendMessage({
            action: 'offscreen_uploadError',
            error: response.statusText
        });
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    console.log('[Offscreen] Upload successful, notifying background...');
    chrome.runtime.sendMessage({ action: 'offscreen_uploadComplete' });

    cleanup();
    currentRecordingBlob = null;
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

function cleanup() {
    console.log('[Offscreen] Cleaning up resources');

    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    mediaRecorder = null;
    recordedChunks = [];
}

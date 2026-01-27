// SnapRec Content Script
// This script is injected programmatically by the background script

(function () {
    // Prevent duplicate initialization
    if (window.snapRecInitialized) {
        console.log('SnapRec already initialized, sending ready message');
        return;
    }
    window.snapRecInitialized = true;

    console.log('SnapRec content script loaded');

    // State
    let isSelectingRegion = false;
    let selectionOverlay = null;
    let selectionBox = null;
    let startX, startY;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingOverlay = null;
    let webcamStream = null;
    let webcamVideo = null;

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received:', message.action);

        switch (message.action) {
            case 'startRegionSelect':
                startRegionSelection();
                break;
            case 'captureFullPage':
                captureFullPage();
                break;
            case 'initRecording':
                initRecording(message.streamId, message.options);
                break;
            case 'stopRecording':
                stopRecording();
                break;
        }
        return true;
    });

    // Region Selection
    function startRegionSelection() {
        console.log('Starting region selection');
        isSelectingRegion = true;

        // Create overlay
        selectionOverlay = document.createElement('div');
        selectionOverlay.className = 'snaprec-overlay';
        selectionOverlay.innerHTML = `
      <div class="snaprec-instructions">
        Click and drag to select region • Press ESC to cancel
      </div>
    `;
        document.body.appendChild(selectionOverlay);

        // Create selection box
        selectionBox = document.createElement('div');
        selectionBox.className = 'snaprec-selection-box';
        document.body.appendChild(selectionBox);

        // Add event listeners
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
    }

    function onMouseDown(e) {
        if (!isSelectingRegion) return;

        startX = e.clientX;
        startY = e.clientY;

        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.style.display = 'block';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!isSelectingRegion) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(currentX, startX);
        const top = Math.min(currentY, startY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function onMouseUp(e) {
        if (!isSelectingRegion) return;

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const rect = selectionBox.getBoundingClientRect();

        if (rect.width > 10 && rect.height > 10) {
            chrome.runtime.sendMessage({
                action: 'regionCaptured',
                rect: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                    devicePixelRatio: window.devicePixelRatio
                }
            });
        }

        cleanupSelection();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && isSelectingRegion) {
            cleanupSelection();
        }
    }

    function cleanupSelection() {
        isSelectingRegion = false;

        if (selectionOverlay) {
            selectionOverlay.remove();
            selectionOverlay = null;
        }

        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }

        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('keydown', onKeyDown);
    }

    // Full Page Capture - Simplified and Fixed
    async function captureFullPage() {
        console.log('Starting full page capture');
        showLoadingIndicator('Preparing capture...');

        try {
            // Store original scroll position
            const originalScrollX = window.scrollX;
            const originalScrollY = window.scrollY;

            // Get page dimensions
            const totalHeight = Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
            const totalWidth = Math.max(
                document.body.scrollWidth,
                document.body.offsetWidth,
                document.documentElement.scrollWidth,
                document.documentElement.offsetWidth
            );
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            console.log(`Page: ${totalWidth}x${totalHeight}, Viewport: ${viewportWidth}x${viewportHeight}`);

            // Calculate number of captures needed
            const numCaptures = Math.ceil(totalHeight / viewportHeight);
            console.log(`Need ${numCaptures} captures`);

            // Capture each section
            const images = [];

            for (let i = 0; i < numCaptures; i++) {
                const scrollY = i * viewportHeight;

                // Scroll to position
                window.scrollTo(0, scrollY);

                // Wait for scroll and render
                await sleep(300);

                updateLoadingIndicator(`Capturing section ${i + 1} of ${numCaptures}...`);

                // Capture visible area
                const dataUrl = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'captureVisibleForFullPage' }, (response) => {
                        console.log(`Captured section ${i + 1}, got response:`, !!response);
                        resolve(response);
                    });
                });

                if (dataUrl) {
                    // Load the image to get actual dimensions
                    const img = await loadImage(dataUrl);
                    images.push({
                        img: img,
                        scrollY: scrollY,
                        actualY: i * img.height  // Position in final canvas
                    });
                    console.log(`Section ${i + 1}: ${img.width}x${img.height}`);
                } else {
                    console.error(`Failed to capture section ${i + 1}`);
                }
            }

            // Restore scroll position
            window.scrollTo(originalScrollX, originalScrollY);

            if (images.length === 0) {
                throw new Error('No images captured');
            }

            updateLoadingIndicator('Stitching images...');

            // Create final canvas using first image dimensions as reference
            const imgWidth = images[0].img.width;
            const imgHeight = images[0].img.height;

            // Calculate final canvas height
            const finalHeight = (numCaptures - 1) * imgHeight +
                Math.min(imgHeight, Math.ceil((totalHeight % viewportHeight || viewportHeight) * (imgHeight / viewportHeight)));

            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = images.length * imgHeight; // Simple approach: stack all images

            console.log(`Final canvas: ${canvas.width}x${canvas.height}`);

            const ctx = canvas.getContext('2d');

            // Draw each captured image
            for (let i = 0; i < images.length; i++) {
                const { img } = images[i];
                const y = i * imgHeight;

                // For the last image, we might need to crop to avoid overlap
                if (i === images.length - 1 && images.length > 1) {
                    // Calculate how much of the last viewport is actually new content
                    const remainingHeight = totalHeight - (i * viewportHeight);
                    const cropRatio = remainingHeight / viewportHeight;
                    const cropHeight = Math.ceil(img.height * cropRatio);
                    const sourceY = img.height - cropHeight;

                    // Adjust canvas height
                    canvas.height = (i * imgHeight) + cropHeight;

                    // Draw only the new portion of the last image
                    ctx.drawImage(
                        img,
                        0, sourceY, img.width, cropHeight,  // source
                        0, i * imgHeight, img.width, cropHeight  // destination
                    );
                } else {
                    ctx.drawImage(img, 0, y);
                }
            }

            // Convert to data URL
            const finalDataUrl = canvas.toDataURL('image/png');
            console.log('Full page capture complete');

            // Send to background for processing
            chrome.runtime.sendMessage({
                action: 'processScreenshot',
                dataUrl: finalDataUrl,
                type: 'fullpage'
            });

        } catch (error) {
            console.error('Error capturing full page:', error);
            alert('Failed to capture full page: ' + error.message);
        } finally {
            hideLoadingIndicator();
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.error('Failed to load image:', e);
                reject(e);
            };
            img.src = src;
        });
    }

    // Loading Indicator
    let loadingIndicator = null;

    function showLoadingIndicator(text = 'Capturing...') {
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'snaprec-loading';
        loadingIndicator.innerHTML = `
      <div class="snaprec-loading-spinner"></div>
      <span class="snaprec-loading-text">${text}</span>
    `;
        document.body.appendChild(loadingIndicator);
    }

    function updateLoadingIndicator(text) {
        if (loadingIndicator) {
            const textEl = loadingIndicator.querySelector('.snaprec-loading-text');
            if (textEl) textEl.textContent = text;
        }
    }

    function hideLoadingIndicator() {
        if (loadingIndicator) {
            loadingIndicator.remove();
            loadingIndicator = null;
        }
    }

    // Recording
    async function initRecording(streamId, options) {
        console.log('Initializing recording with streamId:', streamId, 'options:', options);

        try {
            let displayStream;

            // Use getDisplayMedia for modern screen/tab capture
            try {
                displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: options.source === 'tab' ? 'browser' : 'monitor',
                        cursor: 'always'
                    },
                    audio: options.systemAudio ? true : false,
                    preferCurrentTab: options.source === 'tab'
                });
            } catch (displayError) {
                console.error('getDisplayMedia failed:', displayError);
                // User cancelled or permission denied
                return;
            }

            // Get microphone stream if enabled
            let audioTracks = [];
            if (options.microphone) {
                try {
                    console.log('Requesting microphone access...');
                    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioTracks = micStream.getAudioTracks();
                    console.log('Microphone tracks acquired:', audioTracks.length);
                } catch (e) {
                    console.warn('Could not get microphone:', e);
                }
            }

            // Check for system audio tracks from display stream
            const displayAudioTracks = displayStream.getAudioTracks();
            console.log('Display audio tracks (system audio):', displayAudioTracks.length);
            console.log('Options received - Mic:', options.microphone, 'System Audio:', options.systemAudio);

            // Combine streams
            const tracks = [...displayStream.getTracks(), ...audioTracks];
            const combinedStream = new MediaStream(tracks);

            // Setup webcam if enabled
            if (options.webcam) {
                await setupWebcam();
            }

            // Create media recorder with fallback mimeTypes
            let recorderOptions = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
                recorderOptions = { mimeType: 'video/webm;codecs=vp8' };
            }
            if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
                recorderOptions = { mimeType: 'video/webm' };
            }

            mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
            console.log('MediaRecorder created with mimeType:', recorderOptions.mimeType);

            recordedChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                console.log('Recording stopped, creating blob...');
                const blob = new Blob(recordedChunks, { type: recorderOptions.mimeType });
                console.log('Blob created, size:', blob.size);

                // Convert blob to base64 data URL for cross-page storage
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result;
                    console.log('Data URL created, length:', dataUrl.length);

                    chrome.runtime.sendMessage({
                        action: 'recordingComplete',
                        dataUrl: dataUrl
                    });
                };
                reader.readAsDataURL(blob);

                cleanupRecording();
            };

            // Handle stream ending (user stops sharing)
            displayStream.getVideoTracks()[0].onended = () => {
                console.log('Display stream ended');
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            };

            // Show recording overlay
            showRecordingOverlay();

            // Start recording
            mediaRecorder.start(1000);
            console.log('Recording started');

        } catch (error) {
            console.error('Error initializing recording:', error);
            alert('Failed to start recording: ' + error.message);
            cleanupRecording();
        }
    }

    async function setupWebcam() {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 200, height: 200 },
                audio: false
            });

            webcamVideo = document.createElement('video');
            webcamVideo.className = 'snaprec-webcam';
            webcamVideo.srcObject = webcamStream;
            webcamVideo.autoplay = true;
            webcamVideo.muted = true;
            document.body.appendChild(webcamVideo);
        } catch (error) {
            console.warn('Could not setup webcam:', error);
        }
    }

    function showRecordingOverlay() {
        recordingOverlay = document.createElement('div');
        recordingOverlay.className = 'snaprec-recording-bar';
        recordingOverlay.innerHTML = `
      <div class="snaprec-rec-indicator">
        <span class="snaprec-rec-dot"></span>
        <span class="snaprec-timer">00:00</span>
      </div>
      <div class="snaprec-controls">
        <button class="snaprec-pause-btn" title="Pause">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <button class="snaprec-stop-btn" title="Stop">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>
      </div>
    `;
        document.body.appendChild(recordingOverlay);

        // Timer
        let seconds = 0;
        const timerEl = recordingOverlay.querySelector('.snaprec-timer');
        const timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);

        recordingOverlay.dataset.timerInterval = timerInterval;

        // Event listeners
        const pauseBtn = recordingOverlay.querySelector('.snaprec-pause-btn');
        const stopBtn = recordingOverlay.querySelector('.snaprec-stop-btn');

        pauseBtn.addEventListener('click', togglePause);
        stopBtn.addEventListener('click', stopRecording);
    }

    function togglePause() {
        if (!mediaRecorder) return;

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            if (recordingOverlay) recordingOverlay.classList.add('paused');
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            if (recordingOverlay) recordingOverlay.classList.remove('paused');
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    function cleanupRecording() {
        if (recordingOverlay) {
            clearInterval(parseInt(recordingOverlay.dataset.timerInterval));
            recordingOverlay.remove();
            recordingOverlay = null;
        }

        if (webcamVideo) {
            webcamVideo.remove();
            webcamVideo = null;
        }

        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }

        mediaRecorder = null;
        recordedChunks = [];
    }

})();

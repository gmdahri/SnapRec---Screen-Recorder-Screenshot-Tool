// SnapRec Content Script - IMPROVED VERSION FOR 3+ SECTIONS
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
    let recordingOverlay = null;
    let isPaused = false;
    let timerInterval = null;
    let recordingSeconds = 0;
    let webcamStream = null;
    let webcamElement = null;

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received:', message.action);

        switch (message.action) {
            case 'startRegionSelect':
                startRegionSelection();
                sendResponse({ success: true });
                return false;
            case 'captureFullPage':
                captureFullPage().then(() => {
                    sendResponse({ success: true });
                }).catch(err => {
                    sendResponse({ success: false, error: err.message });
                });
                return true; // Async
            case 'showCountdown':
                showCountdown().then(() => {
                    sendResponse({ success: true });
                });
                return true; // Keep channel open for async response
            case 'showRecordingOverlay':
                showRecordingOverlay(message.startTime, message.webcam);
                sendResponse({ success: true });
                return false; // Response already sent synchronously
            case 'hideRecordingOverlay':
                hideRecordingOverlay();
                sendResponse({ success: true });
                return false; // Response already sent synchronously
            case 'showMiniPreview':
                showMiniPreview(message.dataUrl);
                sendResponse({ success: true });
                return false; // Response already sent synchronously
            default:
                return false; // Unknown action
        }
    });

    // Watch for recording state changes via storage - more reliable than messages
    // Content scripts in inactive tabs may miss direct messages, but storage
    // listeners fire reliably across all tabs
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.isRecording) {
            if (changes.isRecording.newValue === false && recordingOverlay) {
                console.log('[SnapRec Content] Recording stopped (via storage), hiding overlay');
                hideRecordingOverlay();
            }
        }
    });

    // Region Selection
    function startRegionSelection() {
        console.log('Starting region selection');

        // Clean up any existing ones first to prevent duplicates
        cleanupSelection();

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
            // IMPORTANT: Hide overlay BEFORE sending capture message
            // This ensures the overlay is not visible in the screenshot
            if (selectionOverlay) {
                selectionOverlay.style.display = 'none';
            }
            if (selectionBox) {
                selectionBox.style.display = 'none';
            }

            // Small delay to ensure DOM updates before capture
            setTimeout(() => {
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
                // Now cleanup the hidden elements
                cleanupSelection();
            }, 50);
        } else {
            cleanupSelection();
        }
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

        // Just in case references were lost or multiple instances, find by class and remove
        document.querySelectorAll('.snaprec-overlay, .snaprec-selection-box').forEach(el => el.remove());

        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeyDown);
    }

    // Full Page Capture - SIMPLIFIED ALGORITHM
    const SCROLL_DELAY = 600; // Shared with CONFIG.TIMEOUTS.SCROLL_DELAY
    async function captureFullPage() {
        console.log('=== Starting full page capture ===');
        showLoadingIndicator('Preparing capture...');

        try {
            // Store original scroll position
            const originalScrollX = window.scrollX;
            const originalScrollY = window.scrollY;

            // Get dimensions
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const totalHeight = document.documentElement.scrollHeight;

            console.log(`Viewport: ${viewportWidth}x${viewportHeight}`);
            console.log(`Total page height: ${totalHeight}`);
            console.log(`Device pixel ratio: ${window.devicePixelRatio}`);

            // Calculate number of captures needed
            const numCaptures = Math.ceil(totalHeight / viewportHeight);
            console.log(`Will capture ${numCaptures} sections`);

            // Scroll to top
            window.scrollTo(0, 0);
            await sleep(500);

            const captures = [];

            // Capture each section
            for (let i = 0; i < numCaptures; i++) {
                const targetY = i * viewportHeight;

                updateLoadingIndicator(`Capturing section ${i + 1}/${numCaptures}...`);
                console.log(`\n--- Section ${i + 1}/${numCaptures} ---`);
                console.log(`Target scroll Y: ${targetY}`);

                // Scroll to position
                window.scrollTo(0, targetY);
                await sleep(600);

                const actualY = window.scrollY;
                console.log(`Actual scroll Y: ${actualY}`);

                // Hide UI elements before capture
                hideLoadingIndicator();
                if (i > 0) toggleStickyElements(true);
                await sleep(400);

                // Capture
                const dataUrl = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'captureVisibleForFullPage' }, (response) => {
                        resolve(response);
                    });
                });

                // Restore UI
                if (i > 0) toggleStickyElements(false);
                showLoadingIndicator(`Processing section ${i + 1}/${numCaptures}...`);

                if (!dataUrl) {
                    console.error(`Failed to capture section ${i + 1}`);
                    throw new Error(`Capture failed at section ${i + 1}`);
                }

                const img = await loadImage(dataUrl);
                console.log(`Captured image: ${img.width}x${img.height}`);

                captures.push({
                    img: img,
                    scrollY: actualY,
                    sectionIndex: i
                });

                // Check if we've scrolled as far as possible
                if (actualY + viewportHeight >= totalHeight - 5) {
                    console.log(`Reached end of page at section ${i + 1}`);
                    break;
                }
            }

            // Restore scroll
            window.scrollTo(originalScrollX, originalScrollY);

            if (captures.length === 0) {
                throw new Error('No images captured');
            }

            console.log(`\n=== Stitching ${captures.length} captures ===`);
            updateLoadingIndicator('Stitching images...');

            // Get dimensions from first capture
            const firstImg = captures[0].img;
            const imgWidth = firstImg.width;
            const imgHeight = firstImg.height;

            // Calculate the scale between captured image and viewport
            const scale = imgHeight / viewportHeight;
            console.log(`Scale factor: ${scale.toFixed(3)} (${imgHeight}px image / ${viewportHeight}px viewport)`);

            // Simple stitching: each section draws exactly viewportHeight worth of content
            // except the last one which draws whatever is left

            let totalCanvasHeight;
            if (captures.length === 1) {
                totalCanvasHeight = imgHeight;
            } else {
                // For multiple captures, calculate based on actual page height
                totalCanvasHeight = Math.ceil(totalHeight * scale);
            }

            console.log(`Canvas dimensions: ${imgWidth}x${totalCanvasHeight}`);

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = totalCanvasHeight;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, imgWidth, totalCanvasHeight);

            // Draw each capture
            for (let i = 0; i < captures.length; i++) {
                const capture = captures[i];
                const { img, scrollY } = capture;

                console.log(`\n--- Drawing section ${i + 1} ---`);

                if (i === 0) {
                    // First section: draw the entire image at the top
                    console.log(`First section: drawing full image (${img.width}x${img.height}) at (0, 0)`);
                    ctx.drawImage(img, 0, 0);
                } else {
                    // Subsequent sections: only draw the new content
                    const prevCapture = captures[i - 1];
                    const prevScrollY = prevCapture.scrollY;

                    // Calculate overlap
                    const expectedNewContentStart = prevScrollY + viewportHeight;
                    const actualNewContentStart = scrollY;
                    const overlap = Math.max(0, expectedNewContentStart - actualNewContentStart);

                    console.log(`Previous section scrollY: ${prevScrollY}`);
                    console.log(`Current section scrollY: ${scrollY}`);
                    console.log(`Expected new content starts at: ${expectedNewContentStart}`);
                    console.log(`Actual new content starts at: ${actualNewContentStart}`);
                    console.log(`Overlap: ${overlap}px (viewport units)`);

                    // Convert overlap to image pixels
                    const overlapPx = Math.ceil(overlap * scale);
                    const sourceY = overlapPx;
                    const heightToDraw = img.height - sourceY;

                    // Destination Y is where previous section ended
                    const destY = Math.ceil(expectedNewContentStart * scale);

                    console.log(`Source Y in image: ${sourceY}px`);
                    console.log(`Height to draw: ${heightToDraw}px`);
                    console.log(`Destination Y on canvas: ${destY}px`);

                    if (heightToDraw > 0) {
                        ctx.drawImage(
                            img,
                            0, sourceY,              // source x, y
                            img.width, heightToDraw, // source width, height
                            0, destY,                // dest x, y
                            img.width, heightToDraw  // dest width, height
                        );
                        console.log(`✓ Drew ${heightToDraw}px of content`);
                    } else {
                        console.warn(`⚠ Skipped section ${i + 1}: heightToDraw = ${heightToDraw}`);
                    }
                }
            }

            console.log(`\n=== Stitching complete ===`);
            console.log(`Final canvas: ${canvas.width}x${canvas.height}`);

            // Convert to data URL
            updateLoadingIndicator('Converting to image...');
            const finalDataUrl = canvas.toDataURL('image/png', 0.95);

            console.log(`Data URL length: ${finalDataUrl.length} chars`);
            console.log(`Estimated size: ${(finalDataUrl.length * 0.75 / 1024 / 1024).toFixed(2)} MB`);

            // Send to background
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

    // Helper to hide sticky/fixed elements
    function toggleStickyElements(hide) {
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            // Skip our own elements
            if (el.className && typeof el.className === 'string' && el.className.includes('snaprec-')) return;

            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'sticky') {
                if (hide) {
                    if (!el.dataset.oldVisibility) {
                        el.dataset.oldVisibility = el.style.visibility || 'visible';
                    }
                    el.style.visibility = 'hidden';
                } else {
                    el.style.visibility = el.dataset.oldVisibility === 'visible' ? '' : el.dataset.oldVisibility;
                    delete el.dataset.oldVisibility;
                }
            }
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

    // Recording Overlay UI (actual recording happens in offscreen document)
    function showRecordingOverlay(startTime, showWebcam = false) {
        console.log('[SnapRec Content] Showing recording overlay, webcam:', showWebcam);

        // Remove existing overlay if present
        if (recordingOverlay) {
            hideRecordingOverlay();
        }

        // Calculate initial seconds from start time
        recordingSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        isPaused = false;

        recordingOverlay = document.createElement('div');
        recordingOverlay.className = 'snaprec-recording-bar';
        recordingOverlay.innerHTML = `
      <div class="snaprec-rec-indicator">
        <span class="snaprec-rec-dot"></span>
        <span class="snaprec-timer">${formatTime(recordingSeconds)}</span>
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

        // Start timer
        const timerEl = recordingOverlay.querySelector('.snaprec-timer');
        timerInterval = setInterval(() => {
            if (!isPaused) {
                recordingSeconds++;
                timerEl.textContent = formatTime(recordingSeconds);
            }
        }, 1000);

        // Event listeners
        const pauseBtn = recordingOverlay.querySelector('.snaprec-pause-btn');
        const stopBtn = recordingOverlay.querySelector('.snaprec-stop-btn');

        pauseBtn.addEventListener('click', togglePause);
        stopBtn.addEventListener('click', stopRecording);

        // Start webcam if requested
        if (showWebcam) {
            startWebcam();
        }
    }

    async function startWebcam() {
        try {
            console.log('[SnapRec Content] Starting webcam...');
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });

            webcamElement = document.createElement('video');
            webcamElement.className = 'snaprec-webcam';
            webcamElement.autoplay = true;
            webcamElement.srcObject = webcamStream;
            webcamElement.muted = true; // Avoid feedback

            document.body.appendChild(webcamElement);
            console.log('[SnapRec Content] Webcam started');
        } catch (error) {
            console.error('[SnapRec Content] Failed to start webcam:', error);
        }
    }

    function stopWebcam() {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        if (webcamElement) {
            webcamElement.remove();
            webcamElement = null;
        }
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function togglePause() {
        isPaused = !isPaused;

        if (isPaused) {
            chrome.runtime.sendMessage({ action: 'pauseRecording' });
            if (recordingOverlay) recordingOverlay.classList.add('paused');
        } else {
            chrome.runtime.sendMessage({ action: 'resumeRecording' });
            if (recordingOverlay) recordingOverlay.classList.remove('paused');
        }
    }

    function stopRecording() {
        console.log('[SnapRec Content] Stop button clicked, sending message to background');
        chrome.runtime.sendMessage({ action: 'stopRecording' });
        hideRecordingOverlay();
    }

    function hideRecordingOverlay() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        if (recordingOverlay) {
            recordingOverlay.remove();
            recordingOverlay = null;
        }

        isPaused = false;
        recordingSeconds = 0;
        stopWebcam();
    }

    // Countdown Timer
    function showCountdown() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'snaprec-countdown-overlay';
            document.body.appendChild(overlay);

            const numbers = [3, 2, 1];
            let index = 0;

            function showNumber() {
                if (index >= numbers.length) {
                    overlay.remove();
                    resolve();
                    return;
                }

                const numberEl = document.createElement('div');
                numberEl.className = 'snaprec-countdown-number';
                numberEl.textContent = numbers[index];
                overlay.innerHTML = '';
                overlay.appendChild(numberEl);

                index++;
                setTimeout(showNumber, 1000);
            }

            showNumber();
        });
    }

    // Mini Preview Window
    function showMiniPreview(dataUrl) {
        console.log('[SnapRec] Showing mini preview');

        // Remove existing preview if any
        const existing = document.querySelector('.snaprec-mini-preview');
        if (existing) existing.remove();

        const previewContainer = document.createElement('div');
        previewContainer.className = 'snaprec-mini-preview';
        previewContainer.innerHTML = `
            <div class="snaprec-preview-header">
                <div class="snaprec-drag-handle"></div>
            </div>
            <div class="snaprec-preview-body">
                <div class="snaprec-preview-img-container">
                    <img src="${dataUrl}" class="snaprec-preview-img" alt="Captured screenshot">
                    <div class="snaprec-preview-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M23 7l-7 5 7 5V7z"></path>
                            <rect x="1" y="5" width="15" height="14" rx="2"></rect>
                        </svg>
                        <span>Preview</span>
                    </div>
                </div>
            </div>
            <div class="snaprec-preview-footer">
                <div class="snaprec-footer-top">
                    <div class="snaprec-footer-title">
                        <h3>Capture Complete</h3>
                        <p>Last capture • Ready to edit</p>
                    </div>
                    <button class="snaprec-share-btn" id="snaprec-edit-btn-top">
                        Edit Clip
                    </button>
                </div>
                <div class="snaprec-actions-grid">
                    <button class="snaprec-action-item discard" id="snaprec-discard-btn">
                        <div class="snaprec-action-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </div>
                        <span class="snaprec-action-label">Discard Image</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(previewContainer);

        // Auto-close timer (10 seconds)
        let autoCloseTimeout = setTimeout(() => {
            closePreview();
        }, 10000);

        function closePreview() {
            previewContainer.style.transform = 'scale(0.9)';
            previewContainer.style.opacity = '0';
            setTimeout(() => previewContainer.remove(), 200);
            if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
        }

        // Action Buttons
        const editBtnTop = previewContainer.querySelector('#snaprec-edit-btn-top');
        const discardBtn = previewContainer.querySelector('#snaprec-discard-btn');

        const handleEdit = () => {
            chrome.runtime.sendMessage({ action: 'openFullEditor', dataUrl: dataUrl });
            previewContainer.remove();
            if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
        };

        editBtnTop.addEventListener('click', handleEdit);

        discardBtn.addEventListener('click', () => {
            closePreview();
        });

        // Dragging
        const header = previewContainer.querySelector('.snaprec-preview-header');
        let isDraggingPreview = false;
        let pDragStartX, pDragStartY;
        let pContStartX, pContStartY;

        header.addEventListener('mousedown', (e) => {
            isDraggingPreview = true;
            pDragStartX = e.clientX;
            pDragStartY = e.clientY;

            const rect = previewContainer.getBoundingClientRect();
            pContStartX = rect.left;
            pContStartY = rect.top;

            header.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onPreviewMouseMove);
            document.addEventListener('mouseup', onPreviewMouseUp);
        });

        function onPreviewMouseMove(e) {
            if (!isDraggingPreview) return;
            const dx = e.clientX - pDragStartX;
            const dy = e.clientY - pDragStartY;

            previewContainer.style.left = (pContStartX + dx) + 'px';
            previewContainer.style.top = (pContStartY + dy) + 'px';
            previewContainer.style.bottom = 'auto';
            previewContainer.style.right = 'auto';
        }

        function onPreviewMouseUp() {
            isDraggingPreview = false;
            header.style.cursor = 'grab';
            document.removeEventListener('mousemove', onPreviewMouseMove);
            document.removeEventListener('mouseup', onPreviewMouseUp);
        }
        // Entry animation
        previewContainer.style.transform = 'translateY(20px) scale(0.95)';
        previewContainer.style.opacity = '0';
        requestAnimationFrame(() => {
            previewContainer.style.transform = 'translateY(0) scale(1)';
            previewContainer.style.opacity = '1';
        });
    }

})();

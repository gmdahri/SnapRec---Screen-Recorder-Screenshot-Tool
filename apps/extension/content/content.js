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
    /** Guards the await inside startWebcam. getUserMedia can take seconds
     * while the permission prompt is up, and the toggle can flip in that
     * window. Without it the camera light comes back on for an overlay the
     * user has already dismissed. */
    let webcamWanted = false;
    /** The in-flight startWebcam, so concurrent callers wait for one camera
     * instead of each opening their own. */
    let webcamStarting = null;
    /** 'rect' | 'circle' — the two the design allows. A shape picker with six
     * options is a decision nobody wants while setting up a recording. */
    let webcamShape = 'circle';
    let micMuted = false;
    /** Whether the first-drag event has already been sent for this page. One
     * page instance is one session: the content script is injected fresh per
     * tab and per navigation, which is the same window the hint lives in. */
    let webcamDragTracked = false;

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
            case 'micMutedChanged':
                // The popup's switch and this overlay are two views of one
                // setting; whichever moved, both have to show it.
                micMuted = !!message.muted;
                renderWebcamState();
                sendResponse({ success: true });
                return false;
            case 'isWebcamPreviewOn':
                sendResponse({ on: !!webcamElement });
                return false;
            case 'showWebcamPreview':
                startWebcam({ preview: true });
                sendResponse({ success: true });
                return false;
            case 'hideWebcamPreview':
                stopWebcam();
                sendResponse({ success: true });
                return false;
            case 'showRecordingOverlay':
                showRecordingOverlay(message.startTime, message.webcam);
                startMetadataTracking();
                sendResponse({ success: true });
                return false; // Response already sent synchronously
            case 'hideRecordingOverlay':
                hideRecordingOverlay();
                stopMetadataTracking();
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
                stopMetadataTracking();
            } else if (changes.isRecording.newValue === true) {
                startMetadataTracking();
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

        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;

        try {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const totalHeight = document.documentElement.scrollHeight;
            const dpr = window.devicePixelRatio || 1;

            const begun = await chrome.runtime.sendMessage({
                action: 'fullPageBegin',
                pageW: viewportWidth, pageH: totalHeight, viewportH: viewportHeight, dpr,
            });
            if (!begun?.success) throw new Error(begun?.error ?? 'could not start capture');

            window.scrollTo(0, 0);
            await sleep(500);

            const numCaptures = Math.ceil(totalHeight / viewportHeight);
            let prevScrollY = null;

            for (let i = 0; i < numCaptures; i++) {
                updateLoadingIndicator(`Capturing section ${i + 1}/${numCaptures}...`);
                window.scrollTo(0, i * viewportHeight);
                await sleep(600);

                const scrollY = window.scrollY;
                const plan = window.SnapRecFullPage.stitchPlan({
                    scrollY, prevScrollY, viewportH: viewportHeight, isFirst: i === 0,
                });

                if (plan) {
                    hideLoadingIndicator();
                    if (i > 0) toggleStickyElements(true);
                    await sleep(400);

                    const sent = await chrome.runtime.sendMessage({
                        action: 'fullPageSection', ...plan,
                    });

                    if (i > 0) toggleStickyElements(false);
                    showLoadingIndicator(`Processing section ${i + 1}/${numCaptures}...`);
                    if (!sent?.success) throw new Error(sent?.error ?? `section ${i + 1} failed`);
                    prevScrollY = scrollY;
                }

                if (scrollY + viewportHeight >= totalHeight - 5) break;
            }

            updateLoadingIndicator('Finishing...');
            const done = await chrome.runtime.sendMessage({ action: 'fullPageFinish' });
            if (!done?.success) throw new Error(done?.error ?? 'could not finish capture');

            // A downscaled capture is stated, never passed off as full size.
            if (done.scale < 0.999) {
                console.log(`Page too large for full resolution; captured at ${Math.round(done.scale * 100)}%`);
            }
            showMiniPreview(done.thumbnail);

        } catch (error) {
            console.error('Error capturing full page:', error);
            alert('Failed to capture full page: ' + error.message);
        } finally {
            window.scrollTo(originalScrollX, originalScrollY);
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
        // A landmark, so a screen-reader user can reach the controls without
        // hunting through page content.
        recordingOverlay.setAttribute('role', 'region');
        recordingOverlay.setAttribute('aria-label', 'SnapRec recording controls');
        recordingOverlay.innerHTML = `
      <div class="snaprec-rec-indicator">
        <span class="snaprec-rec-dot" aria-hidden="true"></span>
        <span class="snaprec-status-word">Recording</span>
        <!-- Announced every 10s, not every second: a per-second live region is
             unusable with a screen reader running. -->
        <span class="snaprec-timer" aria-live="polite" data-announce-every="10"
              >${formatTime(recordingSeconds)}</span>
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

        // Start webcam if requested. If the preview is already up, this only
        // promotes it — re-running getUserMedia would put a second video on
        // the page and hold the camera twice.
        if (showWebcam) {
            startWebcam({ preview: false });
        } else {
            // The take does not include the camera, so neither should the page.
            stopWebcam();
        }
    }

    /** Send one analytics event from the page.
     *
     * The page does NOT own a PostHog client — background/analytics.js is the
     * only one, because the install id and the opt-out flag have to be
     * single-valued. Fire-and-forget, and the callback exists only to clear
     * lastError: an unread lastError logs a console error whenever the worker
     * is asleep, which is a normal state rather than a fault. */
    function trackFromPage(event, properties = {}) {
        try {
            chrome.runtime.sendMessage({ action: 'trackEvent', event, properties }, () => {
                void chrome.runtime.lastError;
            });
        } catch {
            // No receiver, or the page is going away. Nothing to recover.
        }
    }

    /** One camera, two meanings.
     *
     * `preview: true` is the popup's toggle — you are framing, nothing is
     * being captured, so the ring is cyan. `preview: false` is the take, and
     * the ring goes coral. Calling this twice reuses the existing stream
     * rather than opening the camera again. */
    async function startWebcam({ preview = false } = {}) {
        // Set first, because a re-entrant showRecordingOverlay tears the old
        // bar down via hideRecordingOverlay — which clears this flag — and
        // then asks for the camera again on the very next line. Recording the
        // latest intent up here means an in-flight getUserMedia is kept
        // rather than cancelled and restarted.
        webcamWanted = true;
        if (webcamElement) {
            webcamElement.dataset.preview = String(preview);
            return;
        }
        // Guarding on webcamElement alone is not enough: it stays null for as
        // long as getUserMedia takes, so two calls in that window both got
        // past it and opened a camera each. The second overwrote the first's
        // element and stream, orphaning a live camera that stopWebcam could
        // no longer reach — which is how a recording could end with the
        // camera still on and its overlay still on the page. The background
        // makes this ordinary: onActivated and onUpdated both inject the
        // recording overlay for the same tab.
        if (webcamStarting) {
            await webcamStarting;
            if (webcamElement) webcamElement.dataset.preview = String(preview);
            return;
        }
        webcamStarting = (async () => {
        try {
            console.log('[SnapRec Content] Starting webcam, preview:', preview);
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });

            // Between the await and here the user may have toggled off, or the
            // recording may have ended. Without this the camera light comes
            // back on for an overlay nobody asked for.
            if (!webcamWanted) {
                webcamStream.getTracks().forEach((t) => t.stop());
                webcamStream = null;
                return;
            }

            // A <video> cannot hold children, so the overlay is a container
            // with the video inside it. Only the video is mirrored — mirrored
            // controls would put the mic button where your eye says the close
            // button is.
            webcamElement = document.createElement('div');
            webcamElement.className = 'snaprec-webcam';
            webcamElement.dataset.preview = String(preview);
            webcamElement.dataset.shape = webcamShape;

            const video = document.createElement('video');
            video.className = 'snaprec-webcam-video';
            video.autoplay = true;
            video.playsInline = true;
            video.srcObject = webcamStream;
            video.muted = true; // Avoid feedback
            webcamElement.appendChild(video);

            webcamElement.appendChild(buildWebcamControls());
            renderWebcamState();

            makeWebcamDraggable(webcamElement);
            makeWebcamResizable(webcamElement);
            document.body.appendChild(webcamElement);
            // Size before position: the position clamp needs the real
            // dimensions to know how much of the overlay is still on screen.
            applyWebcamSize(webcamElement, await loadWebcamSize());
            applyWebcamPosition(webcamElement, await loadWebcamPosition());
            // Not awaited: the hint may appear a frame late, and must never
            // stand between the user and a live camera.
            maybeShowWebcamHint(webcamElement);
            console.log('[SnapRec Content] Webcam started');
        } catch (error) {
            // Denied, or in use by another app. The overlay is not worth
            // interrupting the page for — the popup already owns that message.
            console.warn('[SnapRec Content] Failed to start webcam:', error?.message);
            webcamStream = null;
        }
        })();
        try {
            await webcamStarting;
        } finally {
            webcamStarting = null;
        }
    }

    /** Where the user last put the overlay, in viewport percentages.
     *
     * Percentages rather than pixels because the same position has to survive
     * a different window size — a corner stays a corner, where a stored
     * 1400px left edge would be off-screen on a narrower window. */
    const WEBCAM_POS_KEY = 'webcamPosition';

    async function loadWebcamPosition() {
        try {
            const { [WEBCAM_POS_KEY]: pos } = await chrome.storage.local.get(WEBCAM_POS_KEY);
            return pos && typeof pos.xPct === 'number' ? pos : null;
        } catch {
            return null;
        }
    }

    function applyWebcamPosition(el, pos) {
        if (!pos) return;
        const { width, height } = el.getBoundingClientRect();
        const x = clampWebcam((pos.xPct / 100) * window.innerWidth, width, window.innerWidth);
        const y = clampWebcam((pos.yPct / 100) * window.innerHeight, height, window.innerHeight);
        // Overrides the stylesheet's default corner. Once the user has placed
        // it, bottom/right must stop competing with left/top.
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    }

    /** Keeps a margin of the overlay on screen. Fully clamping to the viewport
     * would forbid the half-off-screen placement people use to park it. */
    function clampWebcam(value, size, limit) {
        const visible = Math.min(size, 48);
        return Math.max(visible - size, Math.min(value, limit - visible));
    }

    /** Scroll to resize. The overlay is square, so one number says it all.
     *
     * Bounded at both ends: under ~120px a face is unreadable, and over
     * ~360px the overlay is competing with the thing being recorded instead
     * of accompanying it — which is the complaint that prompted this. */
    const WEBCAM_SIZE_KEY = 'webcamSize';
    const WEBCAM_MIN_SIZE = 120;
    const WEBCAM_MAX_SIZE = 360;

    function clampWebcamSize(px) {
        return Math.max(WEBCAM_MIN_SIZE, Math.min(px, WEBCAM_MAX_SIZE));
    }

    async function loadWebcamSize() {
        try {
            const { [WEBCAM_SIZE_KEY]: size } = await chrome.storage.local.get(WEBCAM_SIZE_KEY);
            return typeof size === 'number' ? clampWebcamSize(size) : null;
        } catch {
            return null;
        }
    }

    function applyWebcamSize(el, size) {
        if (!size) return;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
    }

    function makeWebcamResizable(el) {
        let persist = null;

        el.addEventListener('wheel', (e) => {
            // preventDefault with passive: false, or the page scrolls out
            // from under the overlay being resized — on a long article the
            // user would lose their place to change a bubble's size.
            e.preventDefault();
            e.stopPropagation();

            // Chrome sends pixel deltas, but a mouse configured for line or
            // page deltas sends 3 or 1, which would make the gesture feel
            // dead rather than fine-grained.
            const px = e.deltaMode === 1 ? e.deltaY * 16
                : e.deltaMode === 2 ? e.deltaY * window.innerHeight
                : e.deltaY;

            const rect = el.getBoundingClientRect();
            // Scrolling up grows it: the direction of pinching outwards, and
            // the opposite of pushing content away.
            const next = clampWebcamSize(rect.width - px * 0.5);
            if (Math.abs(next - rect.width) < 0.5) return;   // already at a bound
            applyWebcamSize(el, next);

            // Growing in a corner would otherwise push the overlay off the
            // edge: the drag clamp only runs on pointermove.
            if (el.style.left) {
                el.style.left = `${clampWebcam(rect.left, next, window.innerWidth)}px`;
                el.style.top = `${clampWebcam(rect.top, next, window.innerHeight)}px`;
            }

            // Resizing is the other gesture the hint names, so it has served
            // its purpose here too.
            dismissWebcamHint();

            // One write per gesture. A trackpad fires dozens of these a
            // second and chrome.storage.local has a write quota.
            clearTimeout(persist);
            persist = setTimeout(() => {
                try {
                    chrome.storage.local.set({ [WEBCAM_SIZE_KEY]: next });
                } catch { /* the overlay still resized; persistence is a nicety */ }
            }, 250);
        }, { passive: false });
    }

    /** The first-run hint.
     *
     * The overlay has always been draggable, and now resizes too, but nothing
     * on screen ever said so — a user left believing the bubble was pinned
     * where it landed, on top of their slides for the whole presentation.
     *
     * Shown once per install rather than once per recording: this sits over
     * the picture being captured, so a hint that returned every take would be
     * in the recording as well as in the way. */
    const WEBCAM_HINT_KEY = 'webcamHintShown';
    const WEBCAM_HINT_MS = 4000;
    const WEBCAM_HINT_FADE_MS = 220;
    let webcamHintEl = null;
    let webcamHintTimer = null;
    /** Whether this page showed the hint, so the drag event can say whether
     * the gesture was found with help or without it. */
    let webcamHintWasShown = false;

    async function maybeShowWebcamHint(el) {
        try {
            const { [WEBCAM_HINT_KEY]: shown } = await chrome.storage.local.get(WEBCAM_HINT_KEY);
            if (shown) return;
            // Claimed before it is drawn, not after it fades: the background
            // injects this overlay per tab, so two tabs coming up together
            // would otherwise both read false and both show it.
            await chrome.storage.local.set({ [WEBCAM_HINT_KEY]: true });
            showWebcamHintIfStillUp(el);
        } catch {
            // Without storage there is no way to know whether this is the
            // first time, and a hint on every recording is worse than none.
        }
    }

    /** The camera can be turned off inside the awaits above, and the overlay
     * can have been torn down and rebuilt by a re-injection. */
    function showWebcamHintIfStillUp(el) {
        if (!el.isConnected || el !== webcamElement) return;
        showWebcamHint(el);
    }

    function showWebcamHint(el) {
        const hint = document.createElement('div');
        hint.className = 'snaprec-webcam-hint';
        hint.textContent = 'Drag to move · Scroll to resize';
        // Announced, not only drawn: the overlay is reachable by keyboard,
        // and this is the only place the two gestures are named.
        hint.setAttribute('role', 'status');
        el.appendChild(hint);
        webcamHintEl = hint;
        webcamHintWasShown = true;
        trackFromPage('webcam_hint_shown');
        webcamHintTimer = setTimeout(() => dismissWebcamHint(), WEBCAM_HINT_MS);
    }

    /** Idempotent: the timer, the first drag, the first resize and stopWebcam
     * all call this, in any order. */
    function dismissWebcamHint() {
        const hint = webcamHintEl;
        if (!hint) return;
        webcamHintEl = null;
        clearTimeout(webcamHintTimer);
        webcamHintTimer = null;
        hint.dataset.leaving = 'true';
        // Removed on a timer rather than on transitionend, which never fires
        // under prefers-reduced-motion because there is no transition to end.
        setTimeout(() => hint.remove(), WEBCAM_HINT_FADE_MS);
    }

    /** Drag to move, anywhere on screen.
     *
     * Pointer events rather than mouse events so a trackpad, a pen and touch
     * all work, and setPointerCapture so the drag survives the pointer leaving
     * the element — without it, moving faster than the render loop drops the
     * overlay mid-gesture. */
    function makeWebcamDraggable(el) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;
        let moved = false;

        el.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const rect = el.getBoundingClientRect();
            dragging = true;
            moved = false;
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            el.setPointerCapture(e.pointerId);
            el.dataset.dragging = 'true';
            // The page below must not also receive this gesture — on a map or
            // a canvas the drag would pan the page as well as the overlay.
            e.preventDefault();
            e.stopPropagation();
        });

        el.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            moved = true;
            // The gesture the hint describes has happened, so it has nothing
            // left to say. On movement rather than pointerdown: a press that
            // never moves has not taught the user anything yet.
            dismissWebcamHint();
            if (!webcamDragTracked) {
                webcamDragTracked = true;
                // Once per page, not once per frame of the gesture — and it
                // carries whether the hint was on screen, which is the whole
                // question the hint was added to answer.
                trackFromPage('webcam_bubble_dragged', { hinted: webcamHintWasShown });
            }
            const rect = el.getBoundingClientRect();
            el.style.left = `${clampWebcam(e.clientX - offsetX, rect.width, window.innerWidth)}px`;
            el.style.top = `${clampWebcam(e.clientY - offsetY, rect.height, window.innerHeight)}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            e.preventDefault();
        });

        const end = (e) => {
            if (!dragging) return;
            dragging = false;
            delete el.dataset.dragging;
            try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
            if (!moved) return;
            const rect = el.getBoundingClientRect();
            try {
                chrome.storage.local.set({ [WEBCAM_POS_KEY]: {
                    xPct: (rect.left / window.innerWidth) * 100,
                    yPct: (rect.top / window.innerHeight) * 100,
                } });
            } catch { /* the overlay still moved; persistence is a nicety */ }
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);

        // A drag still ends in a click, which bubbles into the page — so
        // moving the overlay across a link or a canvas activated whatever was
        // underneath. Swallowed in the capture phase, and only when the
        // pointer actually moved, so a plain click on the overlay is left
        // alone. `moved` is reset on the next pointerdown.
        el.addEventListener('click', (e) => {
            if (!moved) return;
            // One shot. The control bar stops pointerdown so the drag handler
            // never sees it, which means `moved` would otherwise stay true
            // from the last drag and swallow every later click.
            moved = false;
            // Pressing a control is not the tail of a drag. The bar stops its
            // own clicks from reaching the page, so letting them through here
            // costs nothing — and swallowing them meant that after moving the
            // overlay, the next press of mute, shape or close did nothing.
            if (e.target.closest?.('.snaprec-webcam-controls')) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        // A window that shrinks past the overlay would otherwise strand it
        // outside the viewport with no way to drag it back.
        window.addEventListener('resize', () => {
            if (!webcamElement) return;
            const rect = webcamElement.getBoundingClientRect();
            if (webcamElement.style.left) {
                webcamElement.style.left = `${clampWebcam(rect.left, rect.width, window.innerWidth)}px`;
                webcamElement.style.top = `${clampWebcam(rect.top, rect.height, window.innerHeight)}px`;
            }
        });
    }

    /** The controls, revealed on hover or keyboard focus.
     *
     * Always-visible chrome would sit in every recording; hidden-until-needed
     * keeps the overlay a picture of you and nothing else. They are real
     * buttons so they are reachable by keyboard, which a hover-only affordance
     * never is. */
    function buildWebcamControls() {
        const bar = document.createElement('div');
        bar.className = 'snaprec-webcam-controls';

        const add = (name, label) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'snaprec-webcam-btn';
            b.dataset.webcam = name;
            b.title = label;
            b.setAttribute('aria-label', label);
            bar.appendChild(b);
            return b;
        };
        add('mic', 'Mute microphone');
        add('shape', 'Switch between a circle and a rectangle');
        add('close', 'Turn the camera off');

        // pointerdown, not click: the drag handler lives on the container and
        // would otherwise pick the gesture up and move the overlay instead.
        bar.addEventListener('pointerdown', (e) => e.stopPropagation());
        bar.addEventListener('click', (e) => {
            const btn = e.target.closest?.('[data-webcam]');
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.webcam === 'close') return stopWebcam();
            if (btn.dataset.webcam === 'shape') {
                webcamShape = webcamShape === 'circle' ? 'rect' : 'circle';
            }
            if (btn.dataset.webcam === 'mic') {
                micMuted = !micMuted;
                // The page cannot reach the microphone — it is held by the
                // offscreen document — so the background owns the change and
                // this only asks for it.
                try { chrome.runtime.sendMessage({ action: 'setMicMuted', muted: micMuted }); } catch { /* no-op */ }
            }
            renderWebcamState();
        });
        return bar;
    }

    /** Reads the shared rules module rather than re-deciding them here, so the
     * overlay and its tests cannot drift. */
    function renderWebcamState() {
        if (!webcamElement) return;
        const rules = globalThis.SnapRecWebcam;
        const state = { micMuted, cameraLost: false, shape: webcamShape, selected: false };

        webcamElement.dataset.shape = rules ? rules.overlayState(state).shape : webcamShape;
        if (rules) {
            const { borderRadius } = rules.shapeFor(webcamShape);
            webcamElement.style.borderRadius =
                typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;
        }

        const micBtn = webcamElement.querySelector('[data-webcam="mic"]');
        if (micBtn) {
            micBtn.dataset.on = String(!micMuted);
            micBtn.title = micMuted ? 'Unmute microphone' : 'Mute microphone';
            micBtn.setAttribute('aria-label', micBtn.title);
            micBtn.setAttribute('aria-pressed', String(micMuted));
        }

        // The word carries the state, so a muted mic is unambiguous in the
        // recording itself and under reduced motion — not merely the absence
        // of something.
        const label = rules ? rules.statusLabel(state) : (micMuted ? 'Microphone muted' : null);
        let status = webcamElement.querySelector('.snaprec-webcam-status');
        if (label && !status) {
            status = document.createElement('span');
            status.className = 'snaprec-webcam-status';
            webcamElement.appendChild(status);
        }
        if (status) {
            status.textContent = label ?? '';
            status.hidden = !label;
        }
    }

    function stopWebcam() {
        webcamWanted = false;
        // The node goes with the overlay, but its timers would outlive it.
        dismissWebcamHint();
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        // Sweep the DOM rather than only the element we are holding. A camera
        // the page can still see is a camera that is still on, whoever opened
        // it — an orphan from a race, or one left by an earlier instance of
        // this script. Stopping the tracks is what turns the light off;
        // removing the node only hides it.
        document.querySelectorAll('.snaprec-webcam').forEach((overlay) => {
            overlay.querySelectorAll('video').forEach((video) => {
                const stream = video.srcObject;
                if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
                video.srcObject = null;
            });
            overlay.remove();
        });
        webcamElement = null;
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

    // --- Metadata Tracking (Auto-Zoom) ---
    let trackingInterval = null;
    let eventBuffer = [];
    let isTracking = false;
    let trackingStartTime = 0;

    let lastMouseDownTime = 0;
    let scrollStopTimer = null;

    function startMetadataTracking() {
        if (isTracking) return;
        isTracking = true;
        trackingStartTime = Date.now();
        eventBuffer = [];
        lastMouseDownTime = 0;
        console.log('[SnapRec Content] Started metadata tracking');

        document.addEventListener('mousemove', onTrackingMouseMove, { passive: true });
        document.addEventListener('mousedown', onTrackingMouseDown, { passive: true });
        document.addEventListener('scroll', onTrackingScroll, { passive: true });
        window.addEventListener('resize', onTrackingResize, { passive: true });

        // Flush buffer every 500ms
        trackingInterval = setInterval(flushMetadataBuffer, 500);
    }

    function stopMetadataTracking() {
        if (!isTracking) return;
        isTracking = false;
        console.log('[SnapRec Content] Stopped metadata tracking');
        
        document.removeEventListener('mousemove', onTrackingMouseMove);
        document.removeEventListener('mousedown', onTrackingMouseDown);
        document.removeEventListener('scroll', onTrackingScroll);
        window.removeEventListener('resize', onTrackingResize);

        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }

        if (scrollStopTimer) {
            clearTimeout(scrollStopTimer);
            scrollStopTimer = null;
        }

        flushMetadataBuffer(); // Final flush
    }

    function createEventPayload(type, e) {
        return {
            type,
            timestamp: Date.now() - trackingStartTime,
            x: e.clientX,
            y: e.clientY,
            scrollY: window.scrollY,
            scrollX: window.scrollX,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
    }

    let lastMouseMove = 0;
    function onTrackingMouseMove(e) {
        const now = Date.now();
        if (now - lastMouseMove > 50) { // ~20fps
            eventBuffer.push(createEventPayload('mousemove', e));
            lastMouseMove = now;
        }
    }

    function isTextInputElement(el) {
        if (!el) return false;
        // Walk up the DOM — the click target may be a wrapper, label, or child of the input
        const node = el.closest('input, textarea, select, [contenteditable]');
        if (node) return true;
        // Also catch custom components that relay focus to an input
        const tag = el.tagName?.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function onTrackingMouseDown(e) {
        // Ignore right-click / middle-click
        if (e.button !== 0) return;

        // Ignore clicks inside text input elements — typing should not trigger zoom
        if (isTextInputElement(e.target)) return;

        // Debounce rapid successive clicks (double-click, triple-click) within 300ms
        const now = Date.now();
        if (now - lastMouseDownTime < 300) return;
        lastMouseDownTime = now;

        eventBuffer.push(createEventPayload('mousedown', e));
    }

    let lastScroll = 0;
    function onTrackingScroll(e) {
        const now = Date.now();
        if (now - lastScroll > 100) { // ~10fps
            eventBuffer.push({
                type: 'scroll',
                timestamp: now - trackingStartTime,
                scrollY: window.scrollY,
                scrollX: window.scrollX,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            });
            lastScroll = now;
        }

        // Scroll-stop zoom: when the user stops scrolling for 400ms, zoom to center of viewport.
        // Skip if a text input is focused — typing can cause auto-scroll which should not trigger zoom.
        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
            scrollStopTimer = null;
            if (isTextInputElement(document.activeElement)) return;
            eventBuffer.push({
                type: 'scrollstop',
                timestamp: Date.now() - trackingStartTime,
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                scrollY: window.scrollY,
                scrollX: window.scrollX,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            });
        }, 400);
    }

    function onTrackingResize(e) {
        eventBuffer.push({
            type: 'resize',
            timestamp: Date.now() - trackingStartTime,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
    }

    function flushMetadataBuffer() {
        if (eventBuffer.length === 0) return;

        try {
            chrome.runtime.sendMessage({
                action: 'recordMetadataChunks',
                chunks: eventBuffer
            });
        } catch (e) {
            console.warn('[SnapRec] Could not send metadata (context invalidated?):', e);
        }

        eventBuffer = [];
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
    async function showMiniPreview(dataUrl) {
        console.log('[SnapRec] Showing mini preview');

        // Remove existing preview if any
        const existing = document.querySelector('.snaprec-mini-preview');
        if (existing) existing.remove();

        let showReview = false;
        try {
            const { captureCount = 0, reviewDismissed = false } = await chrome.storage.local.get(['captureCount', 'reviewDismissed']);
            showReview = captureCount >= 3 && !reviewDismissed;
        } catch (e) { /* ignore */ }

        const reviewHtml = showReview ? `
                <div class="snaprec-review-cta">
                    <span>⭐</span>
                    <span>Love SnapRec?</span>
                    <a href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg/reviews" target="_blank" rel="noopener noreferrer" id="snaprec-review-link">Leave a review</a>
                </div>` : '';

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
                ${reviewHtml}
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

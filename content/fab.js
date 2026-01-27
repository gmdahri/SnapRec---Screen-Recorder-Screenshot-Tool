// SnapRec Floating Action Button (FAB)
// A draggable floating button with quick capture options

(function () {
    console.log('SnapRec FAB: Script loaded');

    // Check if FAB already exists
    if (document.querySelector('.snaprec-fab-container')) {
        console.log('SnapRec FAB: Already exists, skipping');
        return;
    }

    // Don't show on extension pages
    if (window.location.href.startsWith('chrome-extension://')) {
        console.log('SnapRec FAB: Extension page, skipping');
        return;
    }

    // Inject Styles directly to ensure they are applied
    const injectStyles = () => {
        if (document.getElementById('snaprec-fab-styles')) return;
        const style = document.createElement('style');
        style.id = 'snaprec-fab-styles';
        style.textContent = `
            .snaprec-fab-container {
                position: fixed !important;
                bottom: 80px !important;
                right: 24px !important;
                z-index: 2147483647 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                user-select: none !important;
                width: 56px !important;
                height: 56px !important;
            }
            .snaprec-fab {
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%) !important;
                border: none !important;
                cursor: grab !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4), 0 0 0 4px rgba(139, 92, 246, 0.1) !important;
                transition: all 0.3s ease !important;
                padding: 0 !important;
                color: white !important;
            }
            .snaprec-fab svg {
                width: 28px !important;
                height: 28px !important;
                fill: none !important;
                stroke: currentColor !important;
            }
            /* ... more styles will be in the actual file, but this is for immediate visibility ... */
        `;
        document.head.appendChild(style);
    };

    // Check if FAB is enabled (default: true)
    chrome.storage.local.get(['fabEnabled'], (result) => {
        console.log('SnapRec FAB: fabEnabled =', result.fabEnabled);
        if (result.fabEnabled === false) {
            console.log('SnapRec FAB: Disabled by user');
            return;
        }
        console.log('SnapRec FAB: Initializing...');
        injectStyles();
        initFAB();
    });

    let isRecording = false;
    let isDragging = false;
    let dragStartX, dragStartY;
    let fabStartX, fabStartY;

    function initFAB() {
        console.log('SnapRec FAB: Creating FAB element');
        // Create FAB container
        const container = document.createElement('div');
        container.className = 'snaprec-fab-container';
        container.innerHTML = `
            <button class="snaprec-fab" id="snaprecFab">
                <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7.05 7.05L5.64 5.64M18.36 18.36l-1.41-1.41M7.05 16.95l-1.41 1.41M18.36 5.64l-1.41 1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <span class="snaprec-fab-tooltip">SnapRec - Click or drag</span>
            <div class="snaprec-fab-menu">
                <button class="snaprec-fab-item" data-action="captureVisible">
                    <svg viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Capture Visible
                </button>
                <button class="snaprec-fab-item" data-action="captureFullPage">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
                        <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Full Page
                </button>
                <button class="snaprec-fab-item" data-action="captureRegion">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Select Region
                </button>
                <div class="snaprec-fab-divider"></div>
                <button class="snaprec-fab-item" data-action="startRecording" id="fabRecordBtn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="12" r="4" fill="#EF4444"/>
                    </svg>
                    Start Recording
                </button>
            </div>
        `;

        document.body.appendChild(container);

        const fab = container.querySelector('.snaprec-fab');
        const menu = container.querySelector('.snaprec-fab-menu');

        // Load saved position
        chrome.storage.local.get(['fabPosition'], (result) => {
            if (result.fabPosition) {
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                container.style.left = result.fabPosition.x + 'px';
                container.style.top = result.fabPosition.y + 'px';
            }
        });

        // Toggle menu on click
        fab.addEventListener('click', (e) => {
            if (!isDragging) {
                container.classList.toggle('expanded');
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('expanded');
            }
        });

        // Dragging functionality
        fab.addEventListener('mousedown', (e) => {
            isDragging = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = container.getBoundingClientRect();
            fabStartX = rect.left;
            fabStartY = rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;

            // Only start dragging if moved more than 5px
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
                container.classList.add('dragging');
                container.classList.remove('expanded');

                let newX = fabStartX + dx;
                let newY = fabStartY + dy;

                // Keep within viewport
                newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
                newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

                container.style.right = 'auto';
                container.style.bottom = 'auto';
                container.style.left = newX + 'px';
                container.style.top = newY + 'px';
            }
        }

        function onMouseUp(e) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            container.classList.remove('dragging');

            // Save position
            if (isDragging) {
                const rect = container.getBoundingClientRect();
                chrome.storage.local.set({
                    fabPosition: { x: rect.left, y: rect.top }
                });
            }

            // Reset dragging state after a short delay
            setTimeout(() => {
                isDragging = false;
            }, 100);
        }

        // Menu item actions
        container.querySelectorAll('.snaprec-fab-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                container.classList.remove('expanded');

                switch (action) {
                    case 'captureVisible':
                        chrome.runtime.sendMessage({ action: 'captureVisible' });
                        break;
                    case 'captureFullPage':
                        chrome.runtime.sendMessage({ action: 'captureFullPage' });
                        break;
                    case 'captureRegion':
                        chrome.runtime.sendMessage({ action: 'captureRegion' });
                        break;
                    case 'startRecording':
                        if (!isRecording) {
                            chrome.runtime.sendMessage({
                                action: 'startRecording',
                                options: {
                                    source: 'tab',
                                    microphone: false,
                                    systemAudio: true,
                                    webcam: false
                                }
                            });
                        }
                        break;
                    case 'stopRecording':
                        chrome.runtime.sendMessage({ action: 'stopRecording' });
                        break;
                }
            });
        });

        // Listen for recording state changes
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'recordingStarted') {
                isRecording = true;
                fab.classList.add('snaprec-fab-recording');
                const recordBtn = container.querySelector('#fabRecordBtn');
                recordBtn.dataset.action = 'stopRecording';
                recordBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="#EF4444"/>
                    </svg>
                    Stop Recording
                `;
            } else if (message.action === 'recordingStopped') {
                isRecording = false;
                fab.classList.remove('snaprec-fab-recording');
                const recordBtn = container.querySelector('#fabRecordBtn');
                recordBtn.dataset.action = 'startRecording';
                recordBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="12" r="4" fill="#EF4444"/>
                    </svg>
                    Start Recording
                `;
            }
        });
    }
})();

// SnapRec Popup Script

// Wake up service worker and ensure it's ready
const wakeUpServiceWorker = () => new Promise(resolve => {
  chrome.runtime.sendMessage({ action: 'ping' }, () => {
    if (chrome.runtime.lastError) {
      console.log('Service worker waking up:', chrome.runtime.lastError.message);
    }
    setTimeout(resolve, 100);
  });
});

// Send message with retry for service worker reliability
async function sendMessage(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    await wakeUpServiceWorker();
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
          chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(response);
        });
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await wakeUpServiceWorker();
  initModeToggle();
  initCaptureActions();
  initRecordOptions();
  initSettings();
  loadRecentCaptures();
  initUpdateBanner();
});

// Update Banner
async function initUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  const versionSpan = document.getElementById('updateVersion');
  const updateBtn = document.getElementById('updateNowBtn');

  // Trigger a fresh update check in background
  sendMessage({ action: 'checkForUpdate' }).catch(() => { });

  // Check if an update has already been flagged
  try {
    const { updateAvailable, updateVersion } = await chrome.storage.local.get(['updateAvailable', 'updateVersion']);
    if (updateAvailable && updateVersion) {
      versionSpan.textContent = updateVersion;
      banner.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Could not check update state:', e);
  }

  // "Update Now" reloads the extension to apply the pending update
  updateBtn.addEventListener('click', () => {
    chrome.runtime.reload();
  });
}

// Mode Toggle
function initModeToggle() {
  const toggleGroup = document.querySelector('.mode-toggle');
  const toggleBtns = document.querySelectorAll('.mode-toggle .toggle-btn');
  const panels = {
    screenshot: document.getElementById('screenshotPanel'),
    record: document.getElementById('recordPanel')
  };

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      panels.screenshot.classList.toggle('hidden', mode !== 'screenshot');
      panels.record.classList.toggle('hidden', mode !== 'record');
      toggleGroup.classList.toggle('mode-record', mode === 'record');
    });
  });
}

// Capture Actions
function initCaptureActions() {
  document.querySelectorAll('.action-card[data-action]').forEach(card => {
    card.addEventListener('click', () => {
      card.style.transform = 'scale(0.98)';

      // Send message and close immediately for best UX
      sendMessage({ action: card.dataset.action });
      setTimeout(() => window.close(), 150);
    });
  });
}

// Record Options
function initRecordOptions() {
  // Source buttons
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Start Recording
  document.getElementById('startRecordBtn').addEventListener('click', () => {
    const activeSource = document.querySelector('.source-btn.active');
    sendMessage({
      action: 'startRecording',
      options: {
        source: activeSource?.dataset.source || 'screen',
        microphone: document.getElementById('micToggle').checked,
        systemAudio: document.getElementById('systemAudioToggle').checked,
        webcam: document.getElementById('webcamToggle').checked
      }
    });

    // Close immediately so picker/countdown can show
    setTimeout(() => window.close(), 150);
  });
}

// Settings
function initSettings() {
  const settingsPanel = document.getElementById('settingsPanel');

  document.getElementById('settingsBtn').addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  loadSettings();
  initShortcuts();

  // Setting toggles
  const toggles = [
    { id: 'autoEditToggle', key: 'autoEdit' },
    { id: 'autoCopyToggle', key: 'autoCopy' },
    { id: 'fabToggle', key: 'fabEnabled' }
  ];

  toggles.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', e => {
      chrome.storage.local.set({ [key]: e.target.checked });
    });
  });
}

// Shortcuts
function initShortcuts() {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const shortcuts = {
    shortcutFullpage: isMac ? '⌘⇧1' : 'Ctrl+Shift+1',
    shortcutRegion: isMac ? '⌘⇧2' : 'Ctrl+Shift+2',
    shortcutVisible: isMac ? '⌘⇧3' : 'Ctrl+Shift+3',
    shortcutRecord: isMac ? '⌘⇧4' : 'Ctrl+Shift+4'
  };

  Object.entries(shortcuts).forEach(([id, keys]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = keys;
  });

  document.getElementById('customizeShortcutsBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    window.close();
  });
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['autoEdit', 'autoCopy', 'fabEnabled']);
    document.getElementById('autoEditToggle').checked = result.autoEdit !== false;
    document.getElementById('autoCopyToggle').checked = result.autoCopy || false;
    document.getElementById('fabToggle').checked = result.fabEnabled !== false;
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

// Recent Captures
async function loadRecentCaptures() {
  const container = document.getElementById('recentCaptures');
  const emptyState = document.getElementById('recentEmpty');

  try {
    const { recentCaptures: captures = [] } = await chrome.storage.local.get('recentCaptures');

    if (!captures.length) {
      emptyState.classList.remove('hidden');
      container.style.display = 'none';
      return;
    }

    emptyState.classList.add('hidden');
    container.style.display = 'flex';
    container.innerHTML = captures.slice(0, 10).map((capture, i) => `
      <div class="recent-item ${capture.type === 'video' ? 'video' : ''}" data-index="${i}">
        ${capture.thumbnail || capture.dataUrl
        ? `<img src="${capture.thumbnail || capture.dataUrl}" alt="Capture">`
        : ''}
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.recent-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const capture = captures[index];
        if (capture?.dataUrl) {
          chrome.runtime.sendMessage({ action: 'openCapture', capture });
          window.close();
        }
      });
    });
  } catch (e) {
    console.warn('Could not load recent captures:', e);
    emptyState.classList.remove('hidden');
  }

  // Clear button
  document.getElementById('clearRecent').addEventListener('click', async () => {
    await chrome.storage.local.remove('recentCaptures');
    loadRecentCaptures();
  });
}

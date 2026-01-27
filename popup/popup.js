// SnapRec Popup Script

document.addEventListener('DOMContentLoaded', () => {
  initModeToggle();
  initCaptureActions();
  initRecordOptions();
  initSettings();
  loadRecentCaptures();
});

// Mode Toggle (Screenshot / Record)
function initModeToggle() {
  const toggleBtns = document.querySelectorAll('.mode-toggle .toggle-btn');
  const screenshotPanel = document.getElementById('screenshotPanel');
  const recordPanel = document.getElementById('recordPanel');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show/hide panels
      const mode = btn.dataset.mode;
      if (mode === 'screenshot') {
        screenshotPanel.classList.remove('hidden');
        recordPanel.classList.add('hidden');
      } else {
        screenshotPanel.classList.add('hidden');
        recordPanel.classList.remove('hidden');
      }
    });
  });
}

// Capture Actions
function initCaptureActions() {
  const actionCards = document.querySelectorAll('.action-card[data-action]');

  actionCards.forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;

      // Add click animation
      card.style.transform = 'scale(0.98)';
      setTimeout(() => {
        card.style.transform = '';
      }, 100);

      switch (action) {
        case 'captureVisible':
          chrome.runtime.sendMessage({ action: 'captureVisible' });
          window.close();
          break;
        case 'captureFullPage':
          chrome.runtime.sendMessage({ action: 'captureFullPage' });
          window.close();
          break;
        case 'captureRegion':
          chrome.runtime.sendMessage({ action: 'captureRegion' });
          window.close();
          break;
      }
    });
  });
}

// Record Options
function initRecordOptions() {
  // Source buttons
  const sourceBtns = document.querySelectorAll('.source-btn');
  sourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sourceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Start Recording button
  const startRecordBtn = document.getElementById('startRecordBtn');
  startRecordBtn.addEventListener('click', () => {
    const activeSource = document.querySelector('.source-btn.active');
    const source = activeSource ? activeSource.dataset.source : 'screen';

    const options = {
      source: source,
      microphone: document.getElementById('micToggle').checked,
      systemAudio: document.getElementById('systemAudioToggle').checked,
      webcam: document.getElementById('webcamToggle').checked
    };

    chrome.runtime.sendMessage({
      action: 'startRecording',
      options: options
    });
    window.close();
  });
}

// Settings
function initSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const backBtn = document.getElementById('backBtn');

  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
  });

  backBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  // Load settings
  loadSettings();

  // Auto-edit toggle
  const autoEditToggle = document.getElementById('autoEditToggle');
  autoEditToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoEdit: autoEditToggle.checked });
  });

  // Auto-copy toggle
  const autoCopyToggle = document.getElementById('autoCopyToggle');
  autoCopyToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoCopy: autoCopyToggle.checked });
  });

  // FAB toggle
  const fabToggle = document.getElementById('fabToggle');
  fabToggle.addEventListener('change', () => {
    chrome.storage.local.set({ fabEnabled: fabToggle.checked });
  });
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['autoEdit', 'autoCopy', 'fabEnabled']);

    const autoEditToggle = document.getElementById('autoEditToggle');
    const autoCopyToggle = document.getElementById('autoCopyToggle');
    const fabToggle = document.getElementById('fabToggle');

    autoEditToggle.checked = result.autoEdit !== false; // Default true
    autoCopyToggle.checked = result.autoCopy || false;
    fabToggle.checked = result.fabEnabled !== false; // Default true
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

// Recent Captures
async function loadRecentCaptures() {
  const container = document.getElementById('recentCaptures');
  const emptyState = document.getElementById('recentEmpty');

  try {
    const result = await chrome.storage.local.get('recentCaptures');
    const captures = result.recentCaptures || [];

    if (captures.length === 0) {
      emptyState.classList.remove('hidden');
      container.style.display = 'none';
      return;
    }

    emptyState.classList.add('hidden');
    container.style.display = 'flex';
    container.innerHTML = '';

    captures.slice(0, 10).forEach((capture, index) => {
      const item = document.createElement('div');
      item.className = `recent-item ${capture.type === 'video' ? 'video' : ''}`;

      if (capture.thumbnail || capture.dataUrl) {
        const img = document.createElement('img');
        img.src = capture.thumbnail || capture.dataUrl;
        img.alt = 'Capture';
        item.appendChild(img);
      } else {
        item.style.background = 'var(--bg-tertiary)';
      }

      item.addEventListener('click', () => {
        openCapture(capture);
      });

      container.appendChild(item);
    });
  } catch (e) {
    console.warn('Could not load recent captures:', e);
    emptyState.classList.remove('hidden');
  }

  // Clear button
  const clearBtn = document.getElementById('clearRecent');
  clearBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('recentCaptures');
    loadRecentCaptures();
  });
}

function openCapture(capture) {
  if (capture.dataUrl) {
    chrome.runtime.sendMessage({
      action: 'openCapture',
      capture: capture
    });
    window.close();
  }
}

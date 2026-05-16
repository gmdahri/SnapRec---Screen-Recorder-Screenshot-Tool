// SnapRec — Microphone Permission Page
// Opened in a regular tab so Chrome's address-bar mic prompt has a window to
// attach to. This is the canonical recovery path when the popup-context or
// offscreen-context getUserMedia is silently rejecting due to a sticky
// session-level denial.

const allowBtn = document.getElementById('allowBtn');
const statusEl = document.getElementById('status');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

async function requestMicrophone() {
  allowBtn.disabled = true;
  setStatus('Requesting microphone access...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());

    setStatus('Microphone enabled! You can close this tab and start recording from the SnapRec popup.', 'success');
    allowBtn.textContent = 'Done';
    allowBtn.disabled = true;

    // Auto-close after a short delay so the user sees the confirmation
    setTimeout(() => {
      window.close();
    }, 2500);
  } catch (err) {
    allowBtn.disabled = false;

    if (err.name === 'NotAllowedError') {
      setStatus('Permission was denied. Click the microphone icon in the address bar to change it, or check System Settings on macOS.', 'error');
    } else if (err.name === 'NotFoundError') {
      setStatus('No microphone detected on this device.', 'error');
    } else {
      setStatus('Could not access microphone: ' + (err.message || err.name), 'error');
    }
  }
}

allowBtn.addEventListener('click', requestMicrophone);

// Auto-trigger on page load so the user gets the prompt immediately. If the
// browser blocks an unprompted request, the user can still click the button.
requestMicrophone();

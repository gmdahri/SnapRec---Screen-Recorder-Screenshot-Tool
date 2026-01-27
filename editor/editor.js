// SnapRec Screenshot Editor

// State
let currentTool = 'select';
let currentColor = '#8B5CF6';
let strokeWidth = 3;
let isDrawing = false;
let startX, startY;
let zoom = 1;
let history = [];
let historyIndex = -1;
let originalImage = null;

// DOM Elements
const mainCanvas = document.getElementById('mainCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const mainCtx = mainCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');

// Toolbar buttons
const toolbarButtons = document.querySelectorAll('.toolbar-btn');
const colorPicker = document.getElementById('colorPicker');
const colorPreview = document.getElementById('colorPreview');
const strokeWidthInput = document.getElementById('strokeWidth');
const zoomLevelEl = document.getElementById('zoomLevel');

// Action buttons
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetBtn = document.getElementById('resetBtn');
const cancelBtn = document.getElementById('cancelBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Initialize
async function init() {
    try {
        const result = await chrome.storage.local.get('editingImage');
        if (result.editingImage) {
            await loadImage(result.editingImage);
        }
    } catch (error) {
        console.error('Error loading image:', error);
    }

    setupEventListeners();
}

// Load Image
async function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;

            // Set canvas size to match image exactly
            mainCanvas.width = img.width;
            mainCanvas.height = img.height;
            drawCanvas.width = img.width;
            drawCanvas.height = img.height;

            // Also set CSS size to match (important for high-DPI displays)
            mainCanvas.style.width = img.width + 'px';
            mainCanvas.style.height = img.height + 'px';
            drawCanvas.style.width = img.width + 'px';
            drawCanvas.style.height = img.height + 'px';

            // Set wrapper size
            canvasWrapper.style.width = img.width + 'px';
            canvasWrapper.style.height = img.height + 'px';

            // Draw image at full size
            mainCtx.drawImage(img, 0, 0, img.width, img.height);

            // Save initial state
            saveState();

            // Auto-fit zoom based on container size
            const container = document.querySelector('.canvas-area');
            const containerRect = container.getBoundingClientRect();
            const padding = 80;
            const scaleX = (containerRect.width - padding) / img.width;
            const scaleY = (containerRect.height - padding) / img.height;
            const fitZoom = Math.min(scaleX, scaleY, 1);
            setZoom(fitZoom);

            resolve();
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Save State for Undo/Redo
function saveState() {
    // Remove any states after current index
    history = history.slice(0, historyIndex + 1);

    // Save current state
    const state = mainCanvas.toDataURL();
    history.push(state);
    historyIndex = history.length - 1;

    // Limit history size
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }

    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
    }
}

async function restoreState(dataUrl) {
    const img = new Image();
    img.onload = () => {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        mainCtx.drawImage(img, 0, 0);
        updateUndoRedoButtons();
    };
    img.src = dataUrl;
}

// Tool Selection
function selectTool(tool) {
    currentTool = tool;

    toolbarButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update cursor
    if (tool === 'select') {
        drawCanvas.style.cursor = 'default';
    } else if (tool === 'text') {
        drawCanvas.style.cursor = 'text';
    } else {
        drawCanvas.style.cursor = 'crosshair';
    }
}

// Drawing Functions
function startDrawing(e) {
    if (currentTool === 'select') return;

    isDrawing = true;
    const rect = drawCanvas.getBoundingClientRect();
    startX = (e.clientX - rect.left) / zoom;
    startY = (e.clientY - rect.top) / zoom;

    if (currentTool === 'pen') {
        drawCtx.beginPath();
        drawCtx.moveTo(startX, startY);
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineWidth = strokeWidth;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    }

    if (currentTool === 'text') {
        isDrawing = false;
        showTextInput(startX, startY);
    }
}

function draw(e) {
    if (!isDrawing) return;

    const rect = drawCanvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / zoom;
    const currentY = (e.clientY - rect.top) / zoom;

    // Clear draw canvas
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    drawCtx.strokeStyle = currentColor;
    drawCtx.fillStyle = currentColor;
    drawCtx.lineWidth = strokeWidth;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    switch (currentTool) {
        case 'arrow':
            drawArrow(startX, startY, currentX, currentY);
            break;
        case 'rectangle':
            drawRectangle(startX, startY, currentX, currentY);
            break;
        case 'circle':
            drawCircle(startX, startY, currentX, currentY);
            break;
        case 'pen':
            drawCtx.lineTo(currentX, currentY);
            drawCtx.stroke();
            break;
        case 'blur':
            drawBlurRegion(startX, startY, currentX, currentY);
            break;
    }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    // Merge draw canvas to main canvas
    if (currentTool !== 'text') {
        mainCtx.drawImage(drawCanvas, 0, 0);
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        saveState();
    }
}

// Shape Drawing Functions
function drawArrow(x1, y1, x2, y2) {
    const headLen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Line
    drawCtx.beginPath();
    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.stroke();

    // Arrowhead
    drawCtx.beginPath();
    drawCtx.moveTo(x2, y2);
    drawCtx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    drawCtx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    drawCtx.closePath();
    drawCtx.fill();
}

function drawRectangle(x1, y1, x2, y2) {
    const width = x2 - x1;
    const height = y2 - y1;

    drawCtx.beginPath();
    drawCtx.rect(x1, y1, width, height);
    drawCtx.stroke();
}

function drawCircle(x1, y1, x2, y2) {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const centerX = Math.min(x1, x2) + radiusX;
    const centerY = Math.min(y1, y2) + radiusY;

    drawCtx.beginPath();
    drawCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    drawCtx.stroke();
}

function drawBlurRegion(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    if (width < 10 || height < 10) return;

    // Get image data from main canvas
    const imageData = mainCtx.getImageData(left, top, width, height);
    const blurredData = pixelateImageData(imageData, 10);

    // Draw blurred region on draw canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(blurredData, 0, 0);

    drawCtx.drawImage(tempCanvas, left, top);
}

function pixelateImageData(imageData, pixelSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;

            // Average the colors in the pixel block
            for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
                for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
                    const i = ((y + dy) * width + (x + dx)) * 4;
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    a += data[i + 3];
                    count++;
                }
            }

            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            a = Math.round(a / count);

            // Set all pixels in block to average color
            for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
                for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
                    const i = ((y + dy) * width + (x + dx)) * 4;
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                    data[i + 3] = a;
                }
            }
        }
    }

    return imageData;
}

// Text Input
function showTextInput(x, y) {
    // Remove any existing text input
    const existingOverlay = canvasWrapper.querySelector('.text-input-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'text-input-overlay';
    // Position without zoom since canvas wrapper already has scale transform
    overlay.style.left = x + 'px';
    overlay.style.top = y + 'px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type text...';
    input.style.color = currentColor;
    input.style.fontSize = (strokeWidth * 4) + 'px';

    overlay.appendChild(input);
    canvasWrapper.appendChild(overlay);

    // Small delay to ensure the element is rendered before focusing
    setTimeout(() => input.focus(), 10);

    const commitText = () => {
        if (input.value.trim()) {
            const fontSize = strokeWidth * 6;
            mainCtx.font = `bold ${fontSize}px Inter, sans-serif`;
            mainCtx.fillStyle = currentColor;
            mainCtx.textBaseline = 'top';
            mainCtx.fillText(input.value, x, y);
            saveState();
        }
        overlay.remove();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitText();
        } else if (e.key === 'Escape') {
            overlay.remove();
        }
    });

    // Don't commit on blur - only on Enter (to prevent double-commits)
    input.addEventListener('blur', () => {
        // Delay to allow Enter key to process first
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 100);
    });
}

// Zoom
function setZoom(newZoom) {
    zoom = Math.max(0.25, Math.min(4, newZoom));
    canvasWrapper.style.transform = `scale(${zoom})`;
    zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
}

// Reset
function reset() {
    if (originalImage) {
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        mainCtx.drawImage(originalImage, 0, 0);
        saveState();
    }
}

// Copy to Clipboard
async function copyToClipboard() {
    try {
        const blob = await new Promise(resolve => {
            mainCanvas.toBlob(resolve, 'image/png');
        });

        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);

        showToast('Copied to clipboard!');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showToast('Failed to copy');
    }
}

// Download
function download() {
    const dataUrl = mainCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `SnapRec_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();

    showToast('Downloaded!');
}

// Upload to Google Drive
async function uploadToDrive() {
    const driveBtn = document.getElementById('driveBtn');
    const originalText = driveBtn.innerHTML;

    try {
        // Show loading state
        driveBtn.disabled = true;
        driveBtn.innerHTML = `
            <svg class="spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="30 70" />
            </svg>
            Uploading...
        `;

        const dataUrl = mainCanvas.toDataURL('image/png');
        const filename = `SnapRec_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

        // Send to background script for upload
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'uploadToDrive',
                dataUrl: dataUrl,
                filename: filename,
                mimeType: 'image/png'
            }, resolve);
        });

        if (result && result.success) {
            showToast('Uploaded to Google Drive!');

            // Optionally copy share link to clipboard
            if (result.shareLink) {
                try {
                    await navigator.clipboard.writeText(result.shareLink);
                    showToast('Link copied to clipboard!');
                } catch (e) {
                    console.log('Share link:', result.shareLink);
                }
            }
        } else {
            const errorMsg = result?.error || 'Upload failed';
            showToast(errorMsg);
            console.error('Drive upload failed:', result);
        }
    } catch (error) {
        console.error('Error uploading to Drive:', error);
        showToast('Failed to upload');
    } finally {
        // Restore button
        driveBtn.disabled = false;
        driveBtn.innerHTML = originalText;
    }
}

// Toast
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// Event Listeners
function setupEventListeners() {
    // Tool selection
    toolbarButtons.forEach(btn => {
        btn.addEventListener('click', () => selectTool(btn.dataset.tool));
    });

    // Color picker
    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        colorPreview.style.background = currentColor;
    });

    // Stroke width
    strokeWidthInput.addEventListener('input', (e) => {
        strokeWidth = parseInt(e.target.value);
    });

    // Drawing
    drawCanvas.addEventListener('mousedown', startDrawing);
    drawCanvas.addEventListener('mousemove', draw);
    drawCanvas.addEventListener('mouseup', stopDrawing);
    drawCanvas.addEventListener('mouseleave', stopDrawing);

    // Undo/Redo
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    // Zoom
    zoomInBtn.addEventListener('click', () => setZoom(zoom + 0.25));
    zoomOutBtn.addEventListener('click', () => setZoom(zoom - 0.25));

    // Reset
    resetBtn.addEventListener('click', reset);

    // Actions
    cancelBtn.addEventListener('click', () => window.close());
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', download);

    // Drive upload button
    const driveBtn = document.getElementById('driveBtn');
    if (driveBtn) {
        driveBtn.addEventListener('click', uploadToDrive);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (e.key === 's') {
                e.preventDefault();
                download();
            } else if (e.key === 'c' && !window.getSelection().toString()) {
                e.preventDefault();
                copyToClipboard();
            }
        }

        // Tool shortcuts
        if (!e.ctrlKey && !e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'v': selectTool('select'); break;
                case 'a': selectTool('arrow'); break;
                case 'r': selectTool('rectangle'); break;
                case 'c': selectTool('circle'); break;
                case 't': selectTool('text'); break;
                case 'p': selectTool('pen'); break;
                case 'b': selectTool('blur'); break;
            }
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

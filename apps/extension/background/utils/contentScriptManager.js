// Content Script Injection Manager
const ContentScriptManager = {
    async inject(tabId, options = {}) {
        const {
            waitTime = 250,
            // webcam.js first: it defines globalThis.SnapRecWebcam, which
            // content.js reads for the overlay's shape and status rules. Until
            // now nothing injected it, so that tested module had no consumer
            // and the rules lived nowhere.
            // fullpage.js before content.js: it defines globalThis.SnapRecFullPage,
            // which content.js reads for the stitch geometry.
            jsFiles = ['content/webcam.js', 'background/fullpage.js', 'content/content.js'],
            // design-system.css first: it is only :root custom properties and
            // two @font-face rules — nothing that can style the host page — and
            // content.css reads var(--sr-*) from it. Injected alone, as it was,
            // every one of those resolved to nothing.
            cssFiles = ['styles/design-system.css', 'content/content.css']
        } = options;

        try {
            // Inject JS files sequentially to ensure order if multiple
            for (const file of jsFiles) {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: [file]
                });
            }

            // Inject CSS files
            if (cssFiles && cssFiles.length > 0) {
                await chrome.scripting.insertCSS({
                    target: { tabId },
                    files: cssFiles
                });
            }

            // Wait for script to initialize
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            return { success: true };
        } catch (error) {
            console.error('Content script injection failed:', error);
            return { success: false, error: error.message };
        }
    }
};

// Export for use in background
if (typeof module !== 'undefined') {
    module.exports = ContentScriptManager;
}

// Content Script Injection Manager
const ContentScriptManager = {
    async inject(tabId, options = {}) {
        const {
            waitTime = 250,
            jsFiles = ['content/content.js'],
            cssFiles = ['content/content.css']
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

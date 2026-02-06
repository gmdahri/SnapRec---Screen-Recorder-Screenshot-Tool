// Tab Utilities
const TabUtils = {
    async getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error('No active tab found');
        return tab;
    },

    isRestrictedUrl(url) {
        return url?.startsWith('chrome://') ||
            url?.startsWith('chrome-extension://') ||
            url?.startsWith('edge://') ||
            url?.startsWith('about:');
    },

    async ensureContentScript(tabId) {
        // This is a helper to check if content script is already injected
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            return response?.pong === true;
        } catch (e) {
            return false;
        }
    }
};

// Export for use in background
if (typeof module !== 'undefined') {
    module.exports = TabUtils;
}

// Messaging Utilities
const Messaging = {
    async sendToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    },

    async sendToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    },

    // Extension-specific wake-up for service worker
    async wakeUpServiceWorker() {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'ping' }, () => {
                // Ignore error, we just want to wake it up
                setTimeout(resolve, 100);
            });
        });
    }
};

// Export for use in scripts
if (typeof module !== 'undefined') {
    module.exports = Messaging;
}

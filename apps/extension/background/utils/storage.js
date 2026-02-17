// Storage Utilities
const Storage = {
    async get(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                resolve(result);
            });
        });
    },

    async set(items) {
        return new Promise((resolve) => {
            chrome.storage.local.set(items, () => {
                resolve();
            });
        });
    },

    async remove(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(keys, () => {
                resolve();
            });
        });
    },

    async clear() {
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => {
                resolve();
            });
        });
    },

    // Session helpers
    async getSession() {
        const { snaprecSession } = await this.get('snaprecSession');
        return snaprecSession;
    },

    // Recording helpers
    async getRecordingState() {
        return this.get(['isRecording', 'recordingStartTime', 'recordingOptions']);
    },

    // Recent captures
    async addToRecentCaptures(capture) {
        const { recentCaptures = [] } = await this.get('recentCaptures');
        // Prepend and limit to 10
        const updated = [capture, ...recentCaptures.filter(c => c.dataUrl !== capture.dataUrl)].slice(0, 10);
        await this.set({ recentCaptures: updated });
        return updated;
    }
};

// Global shorthand for background script compatibility
async function addToRecentCaptures(capture) {
    return Storage.addToRecentCaptures(capture);
}

// Export for use in scripts
if (typeof module !== 'undefined') {
    module.exports = Storage;
}

// SnapRec Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3001',
    WEB_BASE_URL: 'http://localhost:5173',
    TIMEOUTS: {
        SCRIPT_INJECTION_DELAY: 250,
        COUNTDOWN_DURATION: 3500,
        SCROLL_DELAY: 600,
        AUTO_CLOSE_PREVIEW: 10000,
    }
};

// Export for use in modules if needed
if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}

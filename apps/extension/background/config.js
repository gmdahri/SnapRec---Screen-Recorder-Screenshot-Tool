// SnapRec Configuration
const CONFIG = {
    API_BASE_URL: 'https://snaprec-489525905608.us-central1.run.app',
    WEB_BASE_URL: 'https://www.snaprecorder.org',
    
    // API_BASE_URL: 'http://localhost:3001',
    // WEB_BASE_URL: 'http://localhost:5173',
    TIMEOUTS: {
        SCRIPT_INJECTION_DELAY: 250,
        COUNTDOWN_DURATION: 3500,
        SCROLL_DELAY: 600,
        AUTO_CLOSE_PREVIEW: 10000,
    },
    UPDATE_CHECK_INTERVAL_MINUTES: 30,

    /** PostHog analytics.
     *
     * KEY is a PostHog *project* API key — a publishable client credential that
     * can only write events, not read them. It ships inside the extension bundle
     * exactly as it ships inside the website's JS, so it is not a secret in the
     * way a personal API token is, and it is committed here for the same reason
     * VITE_EXTENSION_ID is committed in the web app: it is a public identifier.
     *
     * The extension has no build step, so there is no env var to read at runtime
     * — this object IS the config, the same way API_BASE_URL above is.
     *
     * Blanking KEY is the kill switch: background/analytics.js goes completely
     * inert, with no other change needed. */
    POSTHOG: {
        KEY: 'phc_nrQUHsKcZYoPomBnNpUmwvXQESJcJcsu2dnwrM5X3xJ7',
        HOST: 'https://us.i.posthog.com',
    },
};

// Export for use in modules if needed
if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}

/** Analytics for the popup — a thin pipe to the background client.
 *
 * The popup does NOT own a PostHog instance. There is exactly one client, in
 * background/analytics.js, because identity (the install id) and the opt-out
 * flag have to be single-valued: a second client would mint a second distinct_id
 * the first time the popup opened, and every install would count twice.
 *
 * Also fire-and-forget. sendMessage's callback is read only to clear
 * chrome.runtime.lastError — an unread lastError logs a spurious console error
 * when the service worker is asleep, which is a normal state, not a fault.
 */

/** Send an event to the background client. Never throws, never blocks. */
export function track(event, properties = {}) {
    try {
        chrome.runtime.sendMessage({ action: 'trackEvent', event, properties }, () => {
            void chrome.runtime.lastError;
        });
    } catch {
        // Popup closing mid-send, or no receiver. Nothing to recover.
    }
}

/** Read the opt-out flag, for rendering a settings toggle. */
export function getOptOut() {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ action: 'getAnalyticsOptOut' }, (response) => {
                void chrome.runtime.lastError;
                resolve(Boolean(response?.optedOut));
            });
        } catch {
            resolve(true);
        }
    });
}

/** Turn analytics off or back on. Persists in chrome.storage.local. */
export function setOptOut(optOut) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ action: 'setAnalyticsOptOut', optOut }, (response) => {
                void chrome.runtime.lastError;
                resolve(Boolean(response?.ok));
            });
        } catch {
            resolve(false);
        }
    });
}

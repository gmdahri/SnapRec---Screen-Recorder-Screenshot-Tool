// SnapRec Extension Auth Module
// Handles authentication state between extension and web app

const WEB_APP_URL = 'https://snaprecorder.pages.dev';

// Store auth session in chrome.storage.local
async function storeSession(session) {
    try {
        await chrome.storage.local.set({
            snaprecSession: {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: session.expires_at,
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    fullName: session.user.user_metadata?.full_name || session.user.email,
                    avatarUrl: session.user.user_metadata?.avatar_url || null
                }
            }
        });
        console.log('Session stored successfully');
        return true;
    } catch (error) {
        console.error('Failed to store session:', error);
        return false;
    }
}

// Get stored session
async function getSession() {
    try {
        const result = await chrome.storage.local.get('snaprecSession');
        return result.snaprecSession || null;
    } catch (error) {
        console.error('Failed to get session:', error);
        return null;
    }
}

// Clear session (sign out)
async function clearSession() {
    try {
        await chrome.storage.local.remove('snaprecSession');
        console.log('Session cleared');
        return true;
    } catch (error) {
        console.error('Failed to clear session:', error);
        return false;
    }
}

// Check if session is valid (not expired)
async function isSessionValid() {
    const session = await getSession();
    if (!session) return false;

    const now = Math.floor(Date.now() / 1000);
    return session.expiresAt > now;
}

// Get auth headers for API requests
async function getAuthHeaders() {
    const session = await getSession();
    if (!session || !session.accessToken) {
        return {};
    }
    return {
        'Authorization': `Bearer ${session.accessToken}`
    };
}

// Open login page in web app
function openLoginPage() {
    chrome.tabs.create({
        url: `${WEB_APP_URL}/login?source=extension`
    });
}

// Listen for auth messages from web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type === 'SNAPREC_AUTH_SESSION') {
        storeSession(message.session).then(success => {
            sendResponse({ success });
        });
        return true; // Keep channel open for async
    }

    if (message.type === 'SNAPREC_AUTH_SIGNOUT') {
        clearSession().then(success => {
            sendResponse({ success });
        });
        return true;
    }
});

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.snaprecAuth = {
        storeSession,
        getSession,
        clearSession,
        isSessionValid,
        getAuthHeaders,
        openLoginPage
    };
}

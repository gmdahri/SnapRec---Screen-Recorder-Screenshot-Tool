import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const CONSENT_KEY = 'snaprec_cookie_consent';

export const CookieConsent: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(CONSENT_KEY);
        if (!consent) {
            const timer = setTimeout(() => setVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const accept = () => {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        setVisible(false);
    };

    const decline = () => {
        localStorage.setItem(CONSENT_KEY, 'declined');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] px-3 py-3 pointer-events-none">
            <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-2xl px-4 py-3 pointer-events-auto animate-slide-up">
                <div className="flex flex-row gap-3 items-center">
                    <p className="flex-1 min-w-0 text-sm text-slate-700 leading-snug">
                        We use cookies for ads &amp; analytics.{' '}
                        <NavLink to="/privacy" className="text-indigo-600 hover:underline font-semibold">
                            Privacy Policy
                        </NavLink>
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={decline}
                            className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Decline
                        </button>
                        <button
                            onClick={accept}
                            className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

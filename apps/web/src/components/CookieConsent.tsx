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
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 pointer-events-none">
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 pointer-events-auto animate-slide-up">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">
                            We use cookies for essential site functionality and to serve personalized
                            ads via Google AdSense. By clicking "Accept", you consent to our use of
                            cookies.{' '}
                            <NavLink to="/privacy" className="text-indigo-600 hover:underline font-semibold">
                                Privacy Policy
                            </NavLink>
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={decline}
                            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Decline
                        </button>
                        <button
                            onClick={accept}
                            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

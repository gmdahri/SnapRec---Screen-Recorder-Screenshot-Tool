import React from 'react';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Short reason shown above the CTA, e.g. "AI insights are a Pro feature." */
    reason?: string;
    /** Query string suffix added to /pricing for analytics. */
    source?: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason, source }) => {
    const navigate = useNavigate();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <span className="font-bold text-sm uppercase tracking-widest">SnapRec Pro</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    Unlock AI summaries and transcripts
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-relaxed">
                    {reason ||
                        'Pro gives you automatic transcripts, AI summaries, action items, and chapters on every recording — no third-party bot joins your call.'}
                </p>
                <button
                    onClick={() =>
                        navigate(`/pricing${source ? `?from=${encodeURIComponent(source)}` : ''}`)
                    }
                    className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
                >
                    See Pro plans
                </button>
                <button
                    onClick={onClose}
                    className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700 py-2"
                >
                    Maybe later
                </button>
            </div>
        </div>
    );
};

export default UpgradeModal;

import React from 'react';

interface PricingTableProps {
    onSelectPro: () => void;
    isProActive?: boolean;
    isLoading?: boolean;
}

const Check = () => <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>;

const PricingTable: React.FC<PricingTableProps> = ({ onSelectPro, isProActive, isLoading }) => {
    return (
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Free</h3>
                <p className="text-slate-500 mb-4">For anyone who needs quick screen recordings.</p>
                <div className="text-4xl font-black text-slate-900 dark:text-white mb-6">
                    $0<span className="text-base font-medium text-slate-400">/forever</span>
                </div>
                <ul className="space-y-3 text-slate-700 dark:text-slate-300 text-sm flex-1">
                    <li className="flex gap-2"><Check /> Unlimited recordings, no watermark</li>
                    <li className="flex gap-2"><Check /> Screenshots + screen recording</li>
                    <li className="flex gap-2"><Check /> Shareable links</li>
                    <li className="flex gap-2"><Check /> Comments & reactions</li>
                </ul>
                <button
                    disabled
                    className="mt-8 w-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold py-3 rounded-lg cursor-default"
                >
                    Current plan
                </button>
            </div>

            {/* Pro */}
            <div className="relative bg-gradient-to-br from-primary/5 to-violet-600/5 dark:from-primary/10 dark:to-violet-600/10 rounded-2xl border-2 border-primary p-8 flex flex-col shadow-xl shadow-primary/10">
                <div className="absolute -top-3 left-8 bg-primary text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    Recommended
                </div>
                <div className="absolute -top-3 right-8 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    7-day free trial
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Pro</h3>
                <p className="text-slate-500 mb-4">For teams that record meetings and need notes.</p>
                <div className="text-4xl font-black text-slate-900 dark:text-white mb-1">
                    $19<span className="text-base font-medium text-slate-400">/month</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-5">
                    Free for 7 days, then $19/mo. Cancel anytime.
                </p>
                <ul className="space-y-3 text-slate-700 dark:text-slate-300 text-sm flex-1">
                    <li className="flex gap-2"><Check /> Everything in Free</li>
                    <li className="flex gap-2"><Check /> <strong>20 hours/mo</strong> of AI transcription</li>
                    <li className="flex gap-2"><Check /> AI summary, action items, chapters</li>
                    <li className="flex gap-2"><Check /> Speaker diarization (who said what)</li>
                    <li className="flex gap-2"><Check /> Editable transcript</li>
                    <li className="flex gap-2"><Check /> Email when summary is ready</li>
                </ul>
                <button
                    onClick={onSelectPro}
                    disabled={isProActive || isLoading}
                    className="mt-8 w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-md shadow-primary/20 disabled:opacity-50"
                >
                    {isProActive ? 'Active' : isLoading ? 'Opening checkout…' : 'Start free trial'}
                </button>
                <p className="text-center text-xs text-slate-400 mt-2">Card required · cancel anytime</p>
            </div>
        </div>
    );
};

export default PricingTable;

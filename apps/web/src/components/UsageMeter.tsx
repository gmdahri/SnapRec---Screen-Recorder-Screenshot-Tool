import React from 'react';

interface UsageMeterProps {
    usedMinutes: number;
    includedMinutes: number;
    label?: string;
}

const UsageMeter: React.FC<UsageMeterProps> = ({ usedMinutes, includedMinutes, label = 'AI hours used' }) => {
    const usedH = (usedMinutes / 60).toFixed(1);
    const totalH = (includedMinutes / 60).toFixed(0);
    const pct = includedMinutes > 0 ? Math.min(100, Math.round((usedMinutes / includedMinutes) * 100)) : 0;
    const isWarning = pct >= 80;
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                <span className={`text-sm font-bold ${isWarning ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                    {usedH} / {totalH} hrs
                </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                    className={`h-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};

export default UsageMeter;

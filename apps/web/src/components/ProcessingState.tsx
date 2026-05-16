import React from 'react';

interface ProcessingStateProps {
    title: string;
    durationSec?: number | null;
    /** Multiplier on durationSec to estimate remaining (0.05 = 5%). */
    estimateRatio?: number;
}

const ProcessingState: React.FC<ProcessingStateProps> = ({ title, durationSec, estimateRatio = 0.05 }) => {
    const remainingSec = durationSec && durationSec > 0 ? Math.max(5, Math.round(durationSec * estimateRatio)) : null;
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 flex items-start gap-4">
            <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 dark:text-white">{title}</p>
                <p className="text-sm text-slate-500 mt-1">
                    {remainingSec ? `About ${remainingSec}s remaining` : 'This usually takes under a minute.'}
                </p>
                <div className="mt-4 space-y-2">
                    <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-3/4" />
                    <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-1/2" />
                    <div className="h-2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-5/6" />
                </div>
            </div>
        </div>
    );
};

export default ProcessingState;

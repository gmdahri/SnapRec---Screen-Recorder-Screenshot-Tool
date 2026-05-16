import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Transcript, TranscriptSegment } from '../hooks/useRecordings';

interface TranscriptViewerProps {
    transcript: Transcript;
    /** Current playback time, used to highlight the active segment. */
    currentTime?: number;
    /** Called when the user clicks a segment to seek the video. */
    onSeek?: (sec: number) => void;
}

const fmt = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, currentTime = 0, onSeek }) => {
    const [query, setQuery] = useState('');
    const segments = transcript.segmentsJson || [];
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);

    const filtered = useMemo<TranscriptSegment[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) return segments;
        return segments.filter((s) => s.text.toLowerCase().includes(q));
    }, [segments, query]);

    const activeIndex = useMemo(() => {
        for (let i = 0; i < filtered.length; i++) {
            const s = filtered[i];
            if (currentTime >= s.start && currentTime < s.end) return i;
        }
        return -1;
    }, [filtered, currentTime]);

    useEffect(() => {
        if (activeIndex >= 0 && activeRef.current) {
            activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeIndex]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[640px]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">search</span>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search transcript…"
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
                />
                {transcript.language && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase">
                        {transcript.language}
                    </span>
                )}
            </div>
            <div ref={containerRef} className="flex-1 overflow-y-auto p-2">
                {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {query ? 'No matches.' : 'Transcript is empty.'}
                    </div>
                )}
                {filtered.map((s, i) => {
                    const isActive = i === activeIndex;
                    return (
                        <button
                            key={`${s.start}-${i}`}
                            ref={isActive ? activeRef : undefined}
                            onClick={() => onSeek?.(s.start)}
                            className={`group w-full text-left rounded-lg px-3 py-2 flex gap-3 transition-colors ${
                                isActive
                                    ? 'bg-primary/10 text-slate-900 dark:text-white'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <span className="text-xs font-mono text-primary tabular-nums w-12 shrink-0 mt-0.5">
                                {fmt(s.start)}
                            </span>
                            <span className="text-sm leading-relaxed">{s.text}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TranscriptViewer;

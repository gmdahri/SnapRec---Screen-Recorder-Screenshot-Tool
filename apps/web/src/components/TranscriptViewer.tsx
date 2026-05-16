import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Transcript, TranscriptSegment } from '../hooks/useRecordings';

interface TranscriptViewerProps {
    transcript: Transcript;
    currentTime?: number;
    onSeek?: (sec: number) => void;
    isOwner?: boolean;
    onSaveSegments?: (segments: TranscriptSegment[]) => Promise<void>;
}

const SPEAKER_COLORS = [
    'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
];

const fmt = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
    transcript,
    currentTime = 0,
    onSeek,
    isOwner = false,
    onSaveSegments,
}) => {
    const [query, setQuery] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedSegments, setEditedSegments] = useState<TranscriptSegment[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);

    const segments = transcript.segmentsJson || [];
    const hasSpeakers = segments.some((s) => typeof s.speaker === 'number');

    const filtered = useMemo<TranscriptSegment[]>(() => {
        if (isEditMode) return editedSegments;
        const q = query.trim().toLowerCase();
        if (!q) return segments;
        return segments.filter((s) => s.text.toLowerCase().includes(q));
    }, [segments, query, isEditMode, editedSegments]);

    const activeIndex = useMemo(() => {
        if (isEditMode) return -1;
        for (let i = 0; i < filtered.length; i++) {
            const s = filtered[i];
            if (currentTime >= s.start && currentTime < s.end) return i;
        }
        return -1;
    }, [filtered, currentTime, isEditMode]);

    useEffect(() => {
        if (activeIndex >= 0 && activeRef.current) {
            activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeIndex]);

    const enterEdit = () => {
        setEditedSegments(segments.map((s) => ({ ...s })));
        setIsEditMode(true);
    };

    const cancelEdit = () => {
        setIsEditMode(false);
        setEditedSegments([]);
    };

    const saveEdit = async () => {
        if (!onSaveSegments) return;
        setIsSaving(true);
        try {
            await onSaveSegments(editedSegments);
            setIsEditMode(false);
            setEditedSegments([]);
        } finally {
            setIsSaving(false);
        }
    };

    const updateSegmentText = useCallback((idx: number, text: string) => {
        setEditedSegments((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], text };
            return next;
        });
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[640px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                {!isEditMode && (
                    <>
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
                        {isOwner && onSaveSegments && (
                            <button
                                onClick={enterEdit}
                                className="p-1 rounded text-slate-400 hover:text-primary transition-colors"
                                title="Edit transcript"
                            >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                        )}
                    </>
                )}
                {isEditMode && (
                    <>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">
                            Editing transcript
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={cancelEdit}
                                className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="text-xs px-3 py-1 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                            >
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Segments */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-2">
                {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {query ? 'No matches.' : 'Transcript is empty.'}
                    </div>
                )}
                {filtered.map((s, i) => {
                    const isActive = !isEditMode && i === activeIndex;
                    const speakerColor =
                        typeof s.speaker === 'number'
                            ? SPEAKER_COLORS[s.speaker % SPEAKER_COLORS.length]
                            : null;

                    if (isEditMode) {
                        return (
                            <div key={`edit-${s.start}-${i}`} className="px-3 py-2 flex gap-3">
                                <span className="text-xs font-mono text-primary tabular-nums w-12 shrink-0 mt-2">
                                    {fmt(s.start)}
                                </span>
                                <textarea
                                    value={s.text}
                                    onChange={(e) => updateSegmentText(i, e.target.value)}
                                    rows={2}
                                    className="flex-1 text-sm leading-relaxed rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                />
                            </div>
                        );
                    }

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
                            <span className="flex-1 text-sm leading-relaxed">{s.text}</span>
                            {hasSpeakers && typeof s.speaker === 'number' && (
                                <span
                                    className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded self-start mt-0.5 ${speakerColor}`}
                                >
                                    S{s.speaker + 1}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TranscriptViewer;

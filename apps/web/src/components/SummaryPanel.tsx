import React, { useState } from 'react';
import type { Summary, Chapter, ActionItem } from '../hooks/useRecordings';

interface SummaryPanelProps {
    summary: Summary;
    onSeek?: (sec: number) => void;
    onRegenerate?: () => void;
    isOwner?: boolean;
    isRegenerating?: boolean;
}

const fmtTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const SummaryPanel: React.FC<SummaryPanelProps> = ({
    summary,
    onSeek,
    onRegenerate,
    isOwner,
    isRegenerating,
}) => {
    const [copied, setCopied] = useState(false);

    const copyActionItemsAsMarkdown = () => {
        const md = summary.actionItemsJson
            .map((a: ActionItem) => `- [ ] ${a.text}${a.owner ? ` (@${a.owner})` : ''}`)
            .join('\n');
        navigator.clipboard.writeText(md).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="flex flex-col gap-5">
            {/* TL;DR */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary">TL;DR</h3>
                    {isOwner && onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="text-xs text-slate-500 hover:text-primary flex items-center gap-1 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {isRegenerating ? 'sync' : 'autorenew'}
                            </span>
                            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                        </button>
                    )}
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{summary.tldr}</p>
            </section>

            {/* Bullets */}
            {summary.bulletsJson.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Key points</h3>
                    <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                        {summary.bulletsJson.map((b, i) => (
                            <li key={i} className="flex gap-2">
                                <span className="text-primary">•</span>
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Action items */}
            {summary.actionItemsJson.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Action items</h3>
                        <button
                            onClick={copyActionItemsAsMarkdown}
                            className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
                            {copied ? 'Copied' : 'Copy as Markdown'}
                        </button>
                    </div>
                    <ul className="space-y-2">
                        {summary.actionItemsJson.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                <input type="checkbox" className="mt-1 accent-primary" />
                                <span>
                                    {item.text}
                                    {item.owner ? (
                                        <span className="ml-2 text-xs font-semibold text-primary">@{item.owner}</span>
                                    ) : null}
                                    {item.dueDate ? (
                                        <span className="ml-2 text-xs text-slate-500">due {item.dueDate}</span>
                                    ) : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Chapters */}
            {summary.chaptersJson.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Chapters</h3>
                    <ol className="space-y-1">
                        {summary.chaptersJson.map((c: Chapter, i) => (
                            <li key={i}>
                                <button
                                    onClick={() => onSeek?.(c.startSec)}
                                    className="w-full text-left flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                    <span className="text-xs font-mono text-primary tabular-nums w-12 shrink-0">
                                        {fmtTime(c.startSec)}
                                    </span>
                                    <span className="text-sm">{c.title}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {/* Key decisions */}
            {summary.keyDecisionsJson.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Decisions</h3>
                    <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                        {summary.keyDecisionsJson.map((d, i) => (
                            <li key={i}>{d}</li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

export default SummaryPanel;

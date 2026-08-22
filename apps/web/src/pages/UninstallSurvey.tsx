import React, { useState } from 'react';
import { LandingNavbar, LandingFooter, SEO } from '../components';
import { capture } from '../lib/analytics';

/** The page chrome.runtime.setUninstallURL opens when SnapRec is removed.
 *
 * Reachable only from that browser-opened URL: it is deliberately absent from
 * the navbar, the footer, routes.mjs, the sitemap and IndexNow, and it is
 * disallowed in robots.txt. src/__tests__/routes.test.ts enforces that absence
 * rather than leaving it to memory.
 *
 * Everything is optional. Someone who has just uninstalled owes us nothing, so
 * there is no auth, no required field, and Submit works with nothing ticked —
 * the alternative is a form that argues with a person on their way out.
 */

const REASONS = [
    'I found a better alternative',
    "It didn't work as expected",
    'Too complicated to use',
    "I don't need a screen recorder anymore",
    'It slowed down my browser',
    'Privacy concerns',
    'Missing a feature I need',
    'Other',
] as const;

type Reason = typeof REASONS[number];

/** Reasons that open a follow-up box, and the question each one asks. */
const FOLLOW_UPS: Partial<Record<Reason, { key: 'alternative' | 'missing_feature' | 'other_reason'; label: string }>> = {
    'I found a better alternative': { key: 'alternative', label: 'Which one?' },
    'Missing a feature I need': { key: 'missing_feature', label: 'What feature?' },
    'Other': { key: 'other_reason', label: 'Tell us more' },
};

const field =
    'w-full h-11 px-3.5 bg-[var(--sr-surface-paper)] border border-[var(--sr-border-light)] ' +
    'rounded-[var(--sr-radius-control)] text-[14px] text-[var(--sr-text-primary-on-light)] ' +
    'placeholder:text-[var(--sr-text-faint-on-light)] focus:outline-none ' +
    'focus:border-[var(--sr-cyan)] transition-colors';

const UninstallSurvey: React.FC = () => {
    const [selected, setSelected] = useState<Reason[]>([]);
    const [details, setDetails] = useState<Record<string, string>>({});
    const [freetext, setFreetext] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const toggle = (reason: Reason) => {
        setSelected(prev =>
            prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (submitted) return;

        /* Only send follow-up text for reasons still ticked. Someone who types a
         * feature request, then unticks that reason, has withdrawn it — sending
         * it anyway would put an answer in PostHog they did not give. */
        const answered = (key: string) =>
            selected.some(r => FOLLOW_UPS[r]?.key === key) ? details[key]?.trim() || undefined : undefined;

        /* Emitted in the order the list is displayed, not the order they were
         * clicked. Click order would make ["Privacy", "Other"] and
         * ["Other", "Privacy"] distinct values for the same answer, splitting
         * every breakdown of reason-sets in PostHog. */
        const reasons = REASONS.filter(r => selected.includes(r));

        capture('uninstall_survey_submitted', {
            reasons,
            missing_feature: answered('missing_feature'),
            alternative: answered('alternative'),
            other_reason: answered('other_reason'),
            freetext: freetext.trim() || undefined,
        });

        setSubmitted(true);
    };

    return (
        <div className="min-h-screen flex flex-col bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
            {/* noIndex also suppresses the canonical tag — see components/SEO.tsx. */}
            <SEO
                noIndex
                title="Uninstall Survey"
                description="Tell us what made you uninstall SnapRec."
            />
            <LandingNavbar />

            <main className="flex-1 flex items-start justify-center px-6 py-20">
                <div className="w-full max-w-[620px]">
                    {submitted ? (
                        <div className="flex flex-col gap-4" role="status" aria-live="polite">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-cyan-on-light)]">
                                feedback received
                            </span>
                            <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] m-0">
                                Thanks for your feedback.
                            </h1>
                            <p className="text-[15.5px] leading-[1.65] text-[var(--sr-text-muted-on-light)] m-0">
                                If you ever want to come back, we'll be here.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
                            <div className="flex flex-col gap-3">
                                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-text-faint-on-light)]">
                                    uninstall survey
                                </span>
                                <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] m-0">
                                    We're sorry to see you go
                                </h1>
                                <p className="text-[15.5px] leading-[1.65] text-[var(--sr-text-muted-on-light)] m-0">
                                    Help us improve — what made you uninstall SnapRec?
                                </p>
                            </div>

                            <fieldset className="border-0 p-0 m-0 flex flex-col">
                                <legend className="sr-only">Reasons for uninstalling</legend>
                                {REASONS.map(reason => {
                                    const checked = selected.includes(reason);
                                    const followUp = FOLLOW_UPS[reason];
                                    return (
                                        <div key={reason} className="border-t border-[var(--sr-border-light-soft)] last:border-b">
                                            <label className="flex items-center gap-3 py-3.5 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggle(reason)}
                                                    className="size-4 shrink-0 accent-[var(--sr-cyan)] cursor-pointer"
                                                />
                                                <span className="text-[14.5px] text-[var(--sr-text-primary-on-light)] group-hover:text-[var(--sr-cyan-on-light)] transition-colors">
                                                    {reason}
                                                </span>
                                            </label>

                                            {checked && followUp && (
                                                <div className="pb-4 pl-7 flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor={`followup-${followUp.key}`}
                                                        className="text-[12.5px] text-[var(--sr-text-muted-on-light)]"
                                                    >
                                                        {followUp.label}
                                                    </label>
                                                    <input
                                                        id={`followup-${followUp.key}`}
                                                        type="text"
                                                        value={details[followUp.key] ?? ''}
                                                        onChange={e =>
                                                            setDetails(d => ({ ...d, [followUp.key]: e.target.value }))}
                                                        className={field}
                                                        autoComplete="off"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </fieldset>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="freetext" className="text-[13px] text-[var(--sr-text-muted-on-light)]">
                                    Anything else you'd like to share?
                                </label>
                                <textarea
                                    id="freetext"
                                    value={freetext}
                                    onChange={e => setFreetext(e.target.value)}
                                    rows={4}
                                    className="w-full p-3.5 bg-[var(--sr-surface-paper)] border border-[var(--sr-border-light)] rounded-[var(--sr-radius-control)] text-[14px] leading-relaxed text-[var(--sr-text-primary-on-light)] placeholder:text-[var(--sr-text-faint-on-light)] focus:outline-none focus:border-[var(--sr-cyan)] transition-colors resize-y"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    type="submit"
                                    className="inline-flex items-center h-[var(--sr-h-sm)] px-5 rounded-[var(--sr-radius-control)] bg-[var(--sr-text-primary-on-light)] text-[var(--sr-surface-paper)] text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Submit feedback
                                </button>
                                <span className="text-[12.5px] text-[var(--sr-text-faint-on-light)]">
                                    Anonymous. No account needed.
                                </span>
                            </div>
                        </form>
                    )}
                </div>
            </main>

            <LandingFooter />
        </div>
    );
};

export default UninstallSurvey;

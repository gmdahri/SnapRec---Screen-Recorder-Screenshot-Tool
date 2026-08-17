import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, SEO } from '../components';

/** SEO C2 — the catch-all.
 *
 * Before this existed, App.tsx had no `path="*"` and the Cloudflare Pages
 * fallback returned HTTP 200, so every typo, stale link and probe rendered a
 * blank page that search engines were free to index as a soft 404. This page is
 * the visible half of the fix; `public/_redirects` is the status-code half.
 *
 * The links are the point: someone who lands here arrived from a broken URL, so
 * the four destinations that actually carry traffic are one click away rather
 * than behind a back button. */

const DESTINATIONS: { label: string; to: string; blurb: string }[] = [
    { label: 'How it works', to: '/how-it-works', blurb: 'Recording, screenshots and sharing, start to finish.' },
    { label: 'Blog', to: '/blog', blurb: 'Tutorials, comparisons and screen-recording tips.' },
    { label: 'Loom alternative', to: '/loom-alternative', blurb: 'No time limit, no watermark, no video cap.' },
    { label: 'Contact', to: '/contact', blurb: 'Tell us what was meant to be here.' },
];

export function NotFound() {
    return (
        <div className="min-h-screen flex flex-col bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
            {/* noIndex also suppresses the canonical tag — see components/SEO.tsx. */}
            <SEO
                noIndex
                title="Page Not Found"
                description="That page does not exist. SnapRec is a free Chrome screen recorder and screenshot tool — here are the pages people usually want."
            />
            <LandingNavbar />

            <main className="flex-1 flex items-center justify-center px-6 py-24">
                <div className="w-full max-w-[640px] flex flex-col gap-7">
                    <div className="flex flex-col gap-4">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-text-faint-on-light)]">
                            error 404
                        </span>
                        <h1 className="text-[clamp(1.875rem,4vw,2.5rem)] font-bold leading-[1.08] tracking-[-0.035em] m-0">
                            Page Not Found
                        </h1>
                        <p className="text-[15.5px] leading-[1.65] text-[var(--sr-text-muted-on-light)] max-w-[52ch] m-0">
                            The URL you followed does not point at anything. It may have been
                            renamed, or the link that sent you here may have been cut short.
                            Nothing you captured is affected.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <NavLink
                            to="/"
                            className="inline-flex items-center h-[var(--sr-h-sm)] px-4 rounded-[var(--sr-radius-control)] bg-[var(--sr-text-primary-on-light)] text-[var(--sr-surface-paper)] text-[13px] font-semibold no-underline hover:opacity-90 transition-opacity"
                        >
                            Back to the homepage
                        </NavLink>
                        <NavLink
                            to="/blog"
                            className="inline-flex items-center h-[var(--sr-h-sm)] px-4 rounded-[var(--sr-radius-control)] border border-[var(--sr-border-light)] text-[13px] font-semibold text-[var(--sr-text-primary-on-light)] no-underline hover:bg-[var(--sr-surface-paper)] transition-colors"
                        >
                            Read the blog
                        </NavLink>
                    </div>

                    <nav aria-label="Popular pages" className="flex flex-col gap-3 pt-2">
                        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-text-faint-on-light)] font-normal m-0">
                            Try one of these
                        </h2>
                        <ul className="list-none m-0 p-0 flex flex-col">
                            {DESTINATIONS.map(d => (
                                <li key={d.to} className="border-t border-[var(--sr-border-light-soft)] last:border-b">
                                    <NavLink
                                        to={d.to}
                                        className="flex flex-col gap-0.5 py-3.5 no-underline group"
                                    >
                                        <span className="text-[14px] font-semibold text-[var(--sr-text-primary-on-light)] group-hover:text-[var(--sr-cyan-on-light)] transition-colors">
                                            {d.label}
                                        </span>
                                        <span className="text-[13px] text-[var(--sr-text-muted-on-light)]">
                                            {d.blurb}
                                        </span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </main>

            <LandingFooter />
        </div>
    );
}

export default NotFound;

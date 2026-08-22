/** React bindings for lib/analytics.
 *
 * Kept separate from the wrapper so the wrapper stays framework-free and can be
 * called from plain click handlers without pulling React in.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { capture, trackPageview } from '../lib/analytics';

/** Sends a $pageview on every route change.
 *
 * Mounted once inside the Router. posthog-js's own capture_pageview fires only
 * on hard load, which in an SPA means every client-side navigation is missing
 * and every session reads as a single-page bounce. */
export function usePageviews(): void {
    const { pathname } = useLocation();

    useEffect(() => {
        trackPageview(pathname);
    }, [pathname]);
}

/** Fires `page_section_viewed` the first time a section scrolls into view.
 *
 * Once per mount, not once per intersection — scrolling up and back down is not
 * a second view, and counting it as one makes the funnel meaningless.
 *
 * Returns a ref to attach to the section element:
 *
 *   const ref = useSectionViewed('pricing');
 *   <section ref={ref}> ... </section>
 */
export function useSectionViewed<T extends Element = HTMLElement>(
    sectionName: string,
    /** Fraction of the section that must be visible to count. */
    threshold = 0.4,
) {
    const ref = useRef<T | null>(null);
    const fired = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || fired.current) return;

        // Old browsers and jsdom without the polyfill: skip silently rather
        // than break the page for a metric.
        if (typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting || fired.current) continue;
                    fired.current = true;
                    capture('page_section_viewed', { section_name: sectionName });
                    observer.disconnect();
                }
            },
            { threshold },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [sectionName, threshold]);

    return ref;
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const captured: Array<[string, Record<string, unknown>]> = [];
vi.mock('../../lib/analytics', () => ({
    capture: (event: string, props: Record<string, unknown>) => { captured.push([event, props]); },
}));

import UninstallSurvey from '../UninstallSurvey';

const wrap = () => render(
    <HelmetProvider><MemoryRouter><UninstallSurvey /></MemoryRouter></HelmetProvider>);

const tick = (label: string | RegExp) => fireEvent.click(screen.getByLabelText(label));
const submit = () => fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));
const lastEvent = () => captured[captured.length - 1];

describe('uninstall survey', () => {
    beforeEach(() => { captured.length = 0; });

    it('asks the two questions the brief specifies', () => {
        wrap();
        expect(screen.getByRole('heading', { name: "We're sorry to see you go" })).toBeInTheDocument();
        expect(screen.getByText('Help us improve — what made you uninstall SnapRec?')).toBeInTheDocument();
    });

    it('offers all eight reasons as checkboxes', () => {
        wrap();
        expect(screen.getAllByRole('checkbox')).toHaveLength(8);
        for (const reason of [
            'I found a better alternative', "It didn't work as expected", 'Too complicated to use',
            "I don't need a screen recorder anymore", 'It slowed down my browser',
            'Privacy concerns', 'Missing a feature I need', 'Other',
        ]) expect(screen.getByLabelText(reason)).toBeInTheDocument();
    });

    it('is multi-select', () => {
        wrap();
        tick('Privacy concerns');
        tick('It slowed down my browser');
        submit();
        // Reported in list order, not click order, so the same answer always
        // produces the same array — see the note in UninstallSurvey.tsx.
        expect(lastEvent()[1].reasons).toEqual(['It slowed down my browser', 'Privacy concerns']);
    });

    it('reports reasons in list order whichever order they were clicked', () => {
        wrap();
        tick('Other');
        tick('Privacy concerns');
        tick('I found a better alternative');
        submit();
        expect(lastEvent()[1].reasons)
            .toEqual(['I found a better alternative', 'Privacy concerns', 'Other']);
    });

    /* Each conditional input appears only for its own reason. */
    describe('conditional follow-ups', () => {
        it.each([
            ['Missing a feature I need', 'What feature?'],
            ['I found a better alternative', 'Which one?'],
            ['Other', 'Tell us more'],
        ])('%s reveals "%s"', (reason, label) => {
            wrap();
            expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
            tick(reason);
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        });

        it('hides the input again when the reason is unticked', () => {
            wrap();
            tick('Other');
            expect(screen.getByLabelText('Tell us more')).toBeInTheDocument();
            tick('Other');
            expect(screen.queryByLabelText('Tell us more')).not.toBeInTheDocument();
        });
    });

    it('sends every field under the documented prop names', () => {
        wrap();
        tick('Missing a feature I need');
        tick('I found a better alternative');
        tick('Other');
        fireEvent.change(screen.getByLabelText('What feature?'), { target: { value: 'GIF export' } });
        fireEvent.change(screen.getByLabelText('Which one?'), { target: { value: 'Loom' } });
        fireEvent.change(screen.getByLabelText('Tell us more'), { target: { value: 'just trying things' } });
        fireEvent.change(screen.getByLabelText(/anything else/i), { target: { value: 'thanks anyway' } });
        submit();

        const [event, props] = lastEvent();
        expect(event).toBe('uninstall_survey_submitted');
        expect(props).toEqual({
            reasons: ['I found a better alternative', 'Missing a feature I need', 'Other'],
            missing_feature: 'GIF export',
            alternative: 'Loom',
            other_reason: 'just trying things',
            freetext: 'thanks anyway',
        });
    });

    /* Text typed against a reason that was then unticked is a withdrawn answer.
     * Sending it anyway would put words in PostHog the person did not give. */
    it('drops follow-up text when its reason is unticked', () => {
        wrap();
        tick('Other');
        fireEvent.change(screen.getByLabelText('Tell us more'), { target: { value: 'oops' } });
        tick('Other');
        submit();
        expect(lastEvent()[1]).toMatchObject({ reasons: [], other_reason: undefined });
    });

    it('omits empty optional fields rather than sending blanks', () => {
        wrap();
        tick('Privacy concerns');
        submit();
        expect(lastEvent()[1]).toEqual({
            reasons: ['Privacy concerns'],
            missing_feature: undefined, alternative: undefined,
            other_reason: undefined, freetext: undefined,
        });
    });

    /* Someone who has just uninstalled owes us nothing — the form must not
     * argue with them on the way out. */
    it('submits with nothing selected', () => {
        wrap();
        submit();
        expect(lastEvent()[0]).toBe('uninstall_survey_submitted');
        expect(lastEvent()[1].reasons).toEqual([]);
    });

    it('shows the thank you and retires the form', () => {
        wrap();
        submit();
        expect(screen.getByText('Thanks for your feedback.')).toBeInTheDocument();
        expect(screen.getByText("If you ever want to come back, we'll be here.")).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /submit feedback/i })).not.toBeInTheDocument();
    });

    it('cannot be double-submitted', () => {
        wrap();
        submit();
        expect(captured).toHaveLength(1);
    });
});

/* The page must stay unreachable except via the uninstall URL. */
describe('uninstall survey is unlinked and unindexed', () => {
    const web = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

    /* The previous version of this test asserted only that a rewrite rule for
     * the bare path existed, which it did — and the page was still unreachable
     * for a week. Cloudflare's own trailing-slash normalisation claimed the
     * bare path first and 308'd it to `/`, so every uninstalling user landed on
     * the marketing homepage and the survey recorded nothing. What matters is
     * not that a rule mentions the path but that the path the extension
     * actually opens ends up at the survey, so that is what these assert. */
    /* The survey has no per-route rule any more and must not get one back:
     * Cloudflare Pages ignores per-route 200 rewrites to /index.html for paths
     * with no file on disk, and while `/uninstall-survey*  /index.html  200`
     * was present it was inert. The page is served by the `/*` catch-all
     * instead — see the header comment in public/_redirects. */
    it('is served by the catch-all, not a per-route rule', () => {
        const rules = web('public/_redirects').split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));

        expect(rules.at(-1)).toBe('/*  /index.html  200');
        expect(rules.filter(l => /^\/uninstall-survey\S*\s+\/index\.html/.test(l)))
            .toEqual([]);
    });

    it('301s the bare path to the slashed form rather than letting it normalise to /', () => {
        const redirects = web('public/_redirects');
        const rules = redirects.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));

        expect(rules, 'bare path needs an explicit 301')
            .toContain('/uninstall-survey  /uninstall-survey/  301');

        /* Order is what makes it work: Pages takes the first match, so the 301
         * has to come before the catch-all or the catch-all serves the bare
         * path directly and the canonical slashed URL is never reached. */
        expect(rules.indexOf('/uninstall-survey  /uninstall-survey/  301'))
            .toBeLessThan(rules.indexOf('/*  /index.html  200'));
    });

    /* Extensions already installed have the bare URL stored in the browser and
     * will request it forever, so the _redirects rule above is the only thing
     * that can fix them. New installs skip the hop. */
    it('the extension points at a URL the redirects resolve', () => {
        const bg = readFileSync(
            resolve(__dirname, '../../../../extension/background/background.js'), 'utf8');
        expect(bg).toContain('${CONFIG.WEB_BASE_URL}/uninstall-survey/');
    });

    it('is disallowed in robots.txt', () => {
        expect(web('public/robots.txt')).toContain('Disallow: /uninstall-survey');
    });

    it('renders noindex', () => {
        const page = web('src/pages/UninstallSurvey.tsx');
        expect(page).toContain('noIndex');
    });

    it('is absent from the sitemap, the route list and IndexNow', () => {
        expect(web('public/sitemap.xml')).not.toContain('uninstall-survey');
        expect(web('routes.mjs')).not.toContain('uninstall-survey');
        expect(readFileSync(resolve(__dirname, '../../../../../.github/workflows/indexnow.yml'), 'utf8'))
            .not.toContain('uninstall-survey');
    });

    it('nothing links to it', () => {
        for (const f of ['src/components/LandingNavbar.tsx', 'src/components/LandingFooter.tsx',
            'src/pages/NotFound.tsx', 'src/data/blogData.ts']) {
            expect(web(f), f).not.toContain('uninstall-survey');
        }
    });
});

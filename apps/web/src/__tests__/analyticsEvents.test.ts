import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

const SRC = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

/** Every event in the tracking plan, and the file that must fire it.
 *
 * A typed event map stops a typo from compiling, but nothing stops an event
 * from being *declared and never fired* — which looks identical to a working
 * integration until you open PostHog and find the funnel empty. This asserts
 * each one has a real call site. */
const PLAN: Record<string, string> = {
    // Auth
    auth_google_started: 'contexts/AuthContext.tsx',
    auth_magic_link_sent: 'contexts/AuthContext.tsx',
    auth_completed: 'contexts/AuthContext.tsx',
    guest_claim_completed: 'pages/ClaimCaptures.tsx',
    // Sharing
    share_link_generated: 'pages/ShareView.tsx',
    share_page_viewed: 'pages/ShareView.tsx',
    reaction_added: 'pages/ShareView.tsx',
    comment_posted: 'pages/ShareView.tsx',
    // Editors
    screenshot_editor_opened: 'pages/Editor.tsx',
    screenshot_tool_used: 'pages/Editor.tsx',
    video_editor_opened: 'pages/VideoEditor/VideoEditorPage.tsx',
    video_export_started: 'pages/VideoEditor/VideoEditorContext.tsx',
};

describe('analytics tracking plan', () => {
    it.each(Object.entries(PLAN))('%s is fired from %s', (event, file) => {
        expect(read(file)).toContain(`capture('${event}'`);
    });

    it('every planned event is declared in the typed event map', () => {
        const map = read('lib/analytics.ts');
        const undeclared = Object.keys(PLAN).filter((e) => !map.includes(`${e}:`));
        expect(undeclared).toEqual([]);
    });

    /* The seven triggers are a closed set in the type. If a new gate is added
     * without a trigger, or a trigger is declared and never used, the funnel
     * silently under-reports. */
    it('fires every auth_modal_triggered value the type declares', () => {
        const map = read('lib/analytics.ts');
        const declared = /trigger: ((?:\s*\|?\s*'[a-z_]+')+)/.exec(map)![1]
            .split('|').map((t) => t.trim().replace(/'/g, '')).filter(Boolean);

        const sources = ['pages/ShareView.tsx', 'pages/Editor/context/EditorContext.tsx']
            .map(read).join('\n');

        expect(declared.sort()).toEqual([
            'comment', 'download', 'react', 'save', 'screenshot_gated', 'share_link', 'video_editor',
        ]);
        const missing = declared.filter((t) => !sources.includes(`trigger: '${t}'`));
        expect(missing).toEqual([]);
    });

    /* Every login-modal gate must report itself. A new gate added without a
     * capture is the easiest way for this to rot. */
    it('every setLoginAction gate in ShareView reports a trigger', () => {
        const view = read('pages/ShareView.tsx');
        const gates = view.split('setLoginAction(').length - 1;
        const triggers = view.split("capture('auth_modal_triggered'").length - 1;
        expect(triggers).toBe(gates);
    });

    /** posthog-js must stay behind lib/analytics.ts — a direct import elsewhere
     * bypasses the typed map, the opt-out and the lazy load. */
    it('nothing imports posthog-js except the wrapper', () => {
        // --exclude-dir skips this file, which necessarily contains the string
        // it is searching for.
        const hits = execFileSync('grep',
            ['-rl', '--exclude-dir=__tests__', "from 'posthog-js'", SRC], { encoding: 'utf8' })
            .trim().split('\n').filter(Boolean)
            .map((f) => f.replace(`${SRC}/`, ''));
        expect(hits).toEqual(['lib/analytics.ts']);
    });
});

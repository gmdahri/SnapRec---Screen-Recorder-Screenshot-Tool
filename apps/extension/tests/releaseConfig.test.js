// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkReleaseConfig } from '../scripts/check-release-config.mjs';

/** ship-to-store.sh refuses to package an extension pointed at a dev server.
 *
 * config.js is switched to localhost by hand for development and has to be
 * switched back before a release; nothing used to check. The samples below
 * stand in for config.js so this test does not depend on whoever is
 * developing against localhost right now. */

const config = (api, web, posthog = 'https://us.i.posthog.com') => `
const CONFIG = {
    API_BASE_URL: '${api}',
    WEB_BASE_URL: '${web}',
    // API_BASE_URL: 'http://localhost:3001',
    // WEB_BASE_URL: 'http://localhost:5173',
    POSTHOG: { KEY: 'phc_x', HOST: '${posthog}' },
};
if (typeof module !== 'undefined') { module.exports = CONFIG; }
`;
const PROD = config('https://snaprec-489525905608.us-central1.run.app', 'https://www.snaprecorder.org');

describe('checkReleaseConfig', () => {
    it('passes the production configuration, localhost lines commented out', () => {
        expect(checkReleaseConfig(PROD)).toEqual([]);
    });

    it('fails a configuration pointed at localhost, naming both URLs', () => {
        const problems = checkReleaseConfig(config('http://localhost:3001', 'http://localhost:5173'));
        expect(problems.join('\n')).toMatch(/API_BASE_URL is not https/);
        expect(problems.join('\n')).toMatch(/WEB_BASE_URL points at a development host/);
    });

    it.each(['http://127.0.0.1:3001', 'https://localhost', 'https://api.local', 'http://snaprec.example.com', 'https://0.0.0.0'])('fails %s', (api) => {
        expect(checkReleaseConfig(config(api, 'https://www.snaprecorder.org')).length).toBeGreaterThan(0);
    });

    it('fails a configuration that does not evaluate', () => {
        expect(checkReleaseConfig('const CONFIG = {')[0]).toMatch(/does not evaluate/);
    });

    it('allows analytics to be switched off', () => {
        expect(checkReleaseConfig(config('https://api.snaprecorder.org', 'https://www.snaprecorder.org', ''))).toEqual([]);
    });

    it('the committed config.js passes', () => {
        const committed = execFileSync('git', ['show', 'HEAD:apps/extension/background/config.js'], { cwd: resolve(__dirname, '../../..'), encoding: 'utf8' });
        expect(checkReleaseConfig(committed)).toEqual([]);
    });
});

describe('ship-to-store.sh', () => {
    /** A copy of the extension folder with the given config.js. */
    function copyWith(configSource) {
        const dir = mkdtempSync(join(tmpdir(), 'snaprec-ship-'));
        const ext = resolve(__dirname, '..');
        for (const f of ['ship-to-store.sh', 'version.json', 'package.json', 'manifest.json']) cpSync(join(ext, f), join(dir, f));
        mkdirSync(join(dir, 'scripts')); cpSync(join(ext, 'scripts/check-release-config.mjs'), join(dir, 'scripts/check-release-config.mjs'));
        mkdirSync(join(dir, 'background')); writeFileSync(join(dir, 'background/config.js'), configSource);
        return dir;
    }

    it('stops before asking anything or touching a version file when config.js points at localhost', () => {
        const dir = copyWith(config('http://localhost:3001', 'http://localhost:5173'));
        const before = readFileSync(join(dir, 'version.json'), 'utf8');
        let failed = null;
        try { execFileSync('bash', [join(dir, 'ship-to-store.sh')], { cwd: dir, input: 'y\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { failed = e; }
        expect(failed).not.toBeNull();
        expect(String(failed.stderr)).toMatch(/Refusing to package/);
        expect(String(failed.stdout)).not.toMatch(/Proceed\?/);
        expect(readFileSync(join(dir, 'version.json'), 'utf8')).toBe(before);
    });

    it('goes on to the version prompt when config.js is the production one', () => {
        const dir = copyWith(PROD);
        // Answer "no" at the prompt: nothing is packaged.
        const out = execFileSync('bash', [join(dir, 'ship-to-store.sh')], { cwd: dir, input: 'n\n', encoding: 'utf8' });
        expect(out).toMatch(/points at production/);
        expect(out).toMatch(/Aborted/);
    });
});

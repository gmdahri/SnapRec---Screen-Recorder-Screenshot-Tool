/** Refuses to package an extension that points at a development server.
 *
 * background/config.js is edited by hand to run against localhost
 * (CLAUDE.md: "swap to the commented-out localhost lines — and remember to swap
 * back before shipping"). Nothing enforced the swap back. ship-to-store.sh runs
 * this first, before it touches any version file, and stops on a problem.
 *
 * It evaluates config.js the way the extension does — so commented-out lines
 * cannot fool it — and requires every URL the extension talks to to be https
 * on a public host.
 *
 *   node scripts/check-release-config.mjs            # checks background/config.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const DEV_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|.*\.local|.*\.test|.*\.localhost)$/i;

/** Problems with a config.js source, as sentences; empty when it can ship. */
export function checkReleaseConfig(source) {
    let config;
    try {
        const sandbox = {};
        vm.createContext(sandbox);
        config = vm.runInContext(`${source}\n;CONFIG`, sandbox);
    } catch (e) {
        return [`config.js does not evaluate: ${e.message}`];
    }
    const urls = {
        API_BASE_URL: config?.API_BASE_URL,
        WEB_BASE_URL: config?.WEB_BASE_URL,
        'POSTHOG.HOST': config?.POSTHOG?.HOST,
    };
    const problems = [];
    for (const [name, value] of Object.entries(urls)) {
        if (name === 'POSTHOG.HOST' && !value) continue;     // analytics may be switched off
        let url;
        try { url = new URL(value); } catch { problems.push(`${name} is not a URL: ${JSON.stringify(value)}`); continue; }
        if (url.protocol !== 'https:') problems.push(`${name} is not https: ${url.origin}`);
        if (DEV_HOST.test(url.hostname)) problems.push(`${name} points at a development host: ${url.origin}`);
    }
    return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const file = resolve(dirname(fileURLToPath(import.meta.url)), '../background/config.js');
    const problems = checkReleaseConfig(readFileSync(file, 'utf8'));
    if (problems.length) {
        console.error('Refusing to package: background/config.js is not the production configuration.');
        for (const p of problems) console.error(`  - ${p}`);
        console.error('Switch config.js back to the production URLs and run this again.');
        process.exit(1);
    }
    console.log('✔ background/config.js points at production');
}

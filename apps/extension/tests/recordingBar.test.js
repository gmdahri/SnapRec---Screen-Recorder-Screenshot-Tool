import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The recording bar can be dragged out of the way, and stays where it was put.
 *
 * It sits bottom-centre — exactly where Chrome puts its own "… is sharing your
 * screen" bar, which no page can move or hide — so the two collided. Bottom-
 * centre stays the default; the user can now drag it anywhere, and the spot
 * is remembered across tabs and recordings.
 *
 * Runs the real content.js in jsdom. jsdom does no layout, so the bar's box is
 * derived from its inline position, as a browser would report it. */

const CONTENT = readFileSync(resolve(__dirname, '../content/content.js'), 'utf8');
const BAR = { width: 300, height: 42 };
const KEY = 'recordingBarPosition';

let store;
let messageListener;
let storageListeners;

function boot(initial = {}) {
    store = { ...initial };
    storageListeners = [];
    globalThis.chrome = {
        runtime: {
            onMessage: { addListener: (fn) => { messageListener = fn; } },
            sendMessage: vi.fn((_m, cb) => { cb?.(); }),
            lastError: undefined,
        },
        storage: {
            local: {
                get: vi.fn(async (key) => (key in store ? { [key]: store[key] } : {})),
                set: vi.fn(async (o) => {
                    const changes = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { oldValue: store[k], newValue: v }]));
                    Object.assign(store, o);
                    storageListeners.forEach((fn) => fn(changes, 'local'));
                }),
            },
            onChanged: { addListener: (fn) => { storageListeners.push(fn); } },
        },
    };
    delete window.snapRecInitialized;
    // eslint-disable-next-line no-new-func
    new Function(CONTENT)();
}

function show() {
    messageListener({ action: 'showRecordingOverlay', startTime: Date.now(), webcam: false }, {}, () => {});
    return document.querySelector('.snaprec-recording-bar');
}

function pointer(el, type, x, y, extra = {}) {
    const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...extra });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    el.dispatchEvent(e);
    return e;
}

function drag(el, from, to) {
    pointer(el, 'pointerdown', from.x, from.y);
    pointer(el, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    pointer(el, 'pointermove', to.x, to.y);
    pointer(el, 'pointerup', to.x, to.y);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    document.body.innerHTML = '';
    window.innerWidth = 1200;
    window.innerHeight = 800;
    // Layout as the stylesheet would give it: bottom-centre until placed.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
        if (!this.classList.contains('snaprec-recording-bar')) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
        const left = this.style.left ? parseFloat(this.style.left) : window.innerWidth / 2 - BAR.width / 2;
        const top = this.style.top ? parseFloat(this.style.top) : window.innerHeight - 40 - BAR.height;
        return { left, top, width: BAR.width, height: BAR.height, right: left + BAR.width, bottom: top + BAR.height };
    });
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
    messageListener?.({ action: 'hideRecordingOverlay' }, {}, () => {});
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('the recording bar', () => {
    it('starts bottom-centre, as before', async () => {
        boot();
        const bar = show();
        await flush();
        expect(bar.style.left).toBe('');
        expect(bar.style.top).toBe('');
    });

    it('moves with a drag and remembers where it was put', async () => {
        boot();
        const bar = show();
        await flush();
        // The bar starts at left 450, top 718. Grabbed 50px in and 22px down:
        drag(bar, { x: 500, y: 740 }, { x: 150, y: 100 });
        expect(bar.style.left).toBe('100px');
        expect(bar.style.top).toBe('78px');
        expect(bar.style.transform).toBe('none');
        expect(store[KEY].xPct).toBeCloseTo((100 / 1200) * 100);
        expect(store[KEY].yPct).toBeCloseTo((78 / 800) * 100);
    });

    it('a drag does not reach the page as a click for auto-zoom', async () => {
        boot();
        const bar = show();
        await flush();
        const down = pointer(bar, 'pointerdown', 500, 740);
        pointer(bar, 'pointerup', 500, 740);
        // A cancelled pointerdown stops the browser sending the mousedown the
        // click trail listens for.
        expect(down.defaultPrevented).toBe(true);
    });

    it('pressing Pause or Stop is not a drag', async () => {
        boot();
        const bar = show();
        await flush();
        const pause = bar.querySelector('.snaprec-pause-btn');
        const down = pointer(pause, 'pointerdown', 900, 760);
        pointer(pause, 'pointermove', 100, 100);
        pointer(pause, 'pointerup', 100, 100);
        expect(down.defaultPrevented).toBe(false);
        expect(bar.style.left).toBe('');
        expect(KEY in store).toBe(false);
    });

    it('a press without movement saves nothing', async () => {
        boot();
        const bar = show();
        await flush();
        pointer(bar, 'pointerdown', 500, 740);
        pointer(bar, 'pointerup', 500, 740);
        expect(KEY in store).toBe(false);
    });

    it('cannot be dragged off screen: it is the only way to stop from the page', async () => {
        boot();
        const bar = show();
        await flush();
        drag(bar, { x: 500, y: 740 }, { x: 5000, y: 5000 });
        expect(parseFloat(bar.style.left)).toBe(1200 - 300 - 8);
        expect(parseFloat(bar.style.top)).toBe(800 - 42 - 8);
        drag(bar, { x: 1000, y: 760 }, { x: -5000, y: -5000 });
        expect(parseFloat(bar.style.left)).toBe(8);
        expect(parseFloat(bar.style.top)).toBe(8);
    });

    it('comes back where it was put on the next recording', async () => {
        boot({ [KEY]: { xPct: 10, yPct: 20 } });
        const bar = show();
        await flush();
        expect(bar.style.left).toBe('120px');
        expect(bar.style.top).toBe('160px');
    });

    it('a stored spot outside a smaller window is pulled back into view', async () => {
        boot({ [KEY]: { xPct: 95, yPct: 99 } });
        const bar = show();
        await flush();
        expect(parseFloat(bar.style.left)).toBe(1200 - 300 - 8);
        expect(parseFloat(bar.style.top)).toBe(800 - 42 - 8);
    });

    it('ignores a malformed stored value', async () => {
        boot({ [KEY]: { xPct: 'left' } });
        const bar = show();
        await flush();
        expect(bar.style.left).toBe('');
    });

    it('stays in view when the window shrinks', async () => {
        boot();
        const bar = show();
        await flush();
        drag(bar, { x: 500, y: 740 }, { x: 1100, y: 700 });
        window.innerWidth = 700;
        window.dispatchEvent(new Event('resize'));
        expect(parseFloat(bar.style.left)).toBeLessThanOrEqual(700 - 300 - 8);
    });

    it('follows a move made in another tab', async () => {
        boot();
        const bar = show();
        await flush();
        await chrome.storage.local.set({ [KEY]: { xPct: 50, yPct: 5 } });
        expect(bar.style.left).toBe('600px');
        expect(bar.style.top).toBe('40px');
    });

    it('shows that it can be moved', () => {
        const css = readFileSync(resolve(__dirname, '../content/content.css'), 'utf8');
        expect(css).toMatch(/\.snaprec-recording-bar\s*\{[^}]*cursor:\s*grab/s);
        expect(css).toMatch(/\.snaprec-recording-bar\[data-dragging\][^{]*\{[^}]*cursor:\s*grabbing/s);
    });
});

/* Same-origin iframe only: capture interaction meta for editor zoom. Main frame uses content.js. */
(function () {
    if (window.self === window.top) return;
    if (window.__snaprecSubMetaBound) return;
    window.__snaprecSubMetaBound = true;

    let startMs = null;
    let pointerSamples = [];
    let clicks = [];
    let keyEvents = [];
    let focusSessions = [];
    let typingSessions = [];
    let focusStack = [];
    let typingOpen = null;
    let typingTimer = null;
    const TYPING_IDLE_MS = 420;
    const MOVE_MS = 80;
    let moveT = null;
    let bound = false;

    function tSec() {
        return startMs == null ? 0 : Math.round(((Date.now() - startMs) / 1000) * 1000) / 1000;
    }
    function norm(cx, cy) {
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        return {
            x: Math.round((cx / w) * 1000) / 1000,
            y: Math.round((cy / h) * 1000) / 1000,
        };
    }
    function center(el) {
        try {
            const r = el.getBoundingClientRect();
            return norm(r.left + r.width / 2, r.top + r.height / 2);
        } catch {
            return { x: 0.5, y: 0.5 };
        }
    }
    function pushPt(cx, cy) {
        if (startMs == null || pointerSamples.length >= 2000) return;
        const o = norm(cx, cy);
        pointerSamples.push({ t: tSec(), x: o.x, y: o.y });
    }
    function endTyping() {
        if (!typingOpen) return;
        const end = tSec();
        if (end > typingOpen.startSec + 0.04) {
            typingSessions.push({
                startSec: typingOpen.startSec,
                endSec: end,
                x: typingOpen.x,
                y: typingOpen.y,
            });
        }
        typingOpen = null;
    }
    function bind(st) {
        if (bound) return;
        bound = true;
        startMs = st || Date.now();
        const onMove = (e) => {
            if (moveT) return;
            moveT = setTimeout(() => {
                moveT = null;
                pushPt(e.clientX, e.clientY);
            }, MOVE_MS);
        };
        const onClick = (e) => {
            const o = norm(e.clientX, e.clientY);
            clicks.push({ t: tSec(), x: o.x, y: o.y });
        };
        const onFocusIn = (e) => {
            const t = e.target;
            if (!t) return;
            const xy = center(t);
            pushPt(xy.x * window.innerWidth, xy.y * window.innerHeight);
            focusStack.push({ startSec: tSec(), x: xy.x, y: xy.y });
        };
        const onFocusOut = () => {
            if (!focusStack.length) return;
            const open = focusStack.pop();
            const end = tSec();
            if (end > open.startSec + 0.02) {
                focusSessions.push({
                    startSec: open.startSec,
                    endSec: end,
                    x: open.x,
                    y: open.y,
                });
            }
        };
        const onKey = (e) => {
            if (e.repeat) return;
            const onlyMod =
                e.key === 'Shift' ||
                e.key === 'Control' ||
                e.key === 'Alt' ||
                e.key === 'Meta';
            if (onlyMod) return;
            const ts = tSec();
            if (keyEvents.length < 500) {
                keyEvents.push({ t: ts, key: e.key && e.key.length <= 20 ? e.key : '?' });
            }
            let cx = 0.5;
            let cy = 0.5;
            if (focusStack.length) {
                const top = focusStack[focusStack.length - 1];
                cx = top.x;
                cy = top.y;
            } else if (document.activeElement && document.activeElement !== document.body) {
                const xy = center(document.activeElement);
                cx = xy.x;
                cy = xy.y;
            }
            if (!typingOpen) typingOpen = { startSec: ts, x: cx, y: cy };
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                typingTimer = null;
                endTyping();
            }, TYPING_IDLE_MS);
        };
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('click', onClick, true);
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('focusout', onFocusOut, true);
        window.__snaprecSubUnbind = () => {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('keydown', onKey, true);
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('focusout', onFocusOut, true);
            if (typingTimer) clearTimeout(typingTimer);
            bound = false;
        };
    }
    function flush() {
        if (typingTimer) {
            clearTimeout(typingTimer);
            typingTimer = null;
        }
        endTyping();
        const end = tSec();
        while (focusStack.length) {
            const open = focusStack.pop();
            if (end > open.startSec + 0.02) {
                focusSessions.push({
                    startSec: open.startSec,
                    endSec: end,
                    x: open.x,
                    y: open.y,
                });
            }
        }
        if (window.__snaprecSubUnbind) {
            window.__snaprecSubUnbind();
            window.__snaprecSubUnbind = null;
        }
        const n =
            pointerSamples.length +
            clicks.length +
            keyEvents.length +
            focusSessions.length +
            typingSessions.length;
        if (n === 0) return;
        try {
            chrome.runtime.sendMessage({
                action: 'snaprec_recordingMeta',
                meta: {
                    pointerSamples: pointerSamples.slice(),
                    clicks: clicks.slice(),
                    keyEvents: keyEvents.slice(),
                    focusSessions: focusSessions.slice(),
                    typingSessions: typingSessions.slice(),
                    vw: window.innerWidth,
                    vh: window.innerHeight,
                    devicePixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1,
                    scrollX: typeof window.scrollX === 'number' ? window.scrollX : 0,
                    scrollY: typeof window.scrollY === 'number' ? window.scrollY : 0,
                },
            });
        } catch (e) {
            console.warn('[SnapRec subframe meta]', e);
        }
        pointerSamples = [];
        clicks = [];
        keyEvents = [];
        focusSessions = [];
        typingSessions = [];
        startMs = null;
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.isRecording && changes.isRecording.newValue === false) {
            flush();
        }
    });
    window.__snaprecSubMetaStart = function (st) {
        bind(st || Date.now());
    };
    window.__snaprecSubMetaFlush = flush;
})();

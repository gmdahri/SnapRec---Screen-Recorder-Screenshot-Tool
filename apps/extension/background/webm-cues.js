/** Gives a MediaRecorder WebM a duration and a seek index.
 *
 * Chrome's MediaRecorder writes a WebM for live streaming: the Segment and
 * every Cluster have "unknown" size, Info has no Duration, and there are no
 * Cues. A player then reports the duration as Infinity and cannot seek — the
 * share page showed "0:07 / --:--", and clicking the timeline went back to
 * the start. Rewriting a multi-gigabyte file afterwards is out of the question
 * (it is streamed to R2 while it records, and must never be loaded into RAM),
 * so this works on the stream as it is recorded:
 *
 *  1. The first chunk's header is rewritten once, with two blank (Void)
 *     regions reserved: one inside Info, for a Duration, and one after Info,
 *     for a SeekHead. Everything after the header is passed through as is.
 *  2. While recording, every video keyframe's time and Cluster position is
 *     noted, by walking the element headers of the bytes as they arrive.
 *  3. At Stop, finish() gives back the header with the two regions filled in
 *     — the same length, so nothing after it moves and the upload's part 1
 *     can be re-sent at its old size — and a Cues element to append at the
 *     end, which the SeekHead points to.
 *
 * Anything unexpected (a header split oddly, an element this does not know at
 * the top level) turns the indexer off: the recording passes through
 * unchanged, exactly as before. It never costs a recording.
 *
 * Chrome writes video frames as BlockGroups (a Block, plus a ReferenceBlock
 * when the frame depends on another) and audio as SimpleBlocks; both are read.
 *
 * Classic script: loaded by offscreen.html, and by the tests through vm. */
(() => {
    const ID = {
        EBML: 0x1A45DFA3, Segment: 0x18538067, Info: 0x1549A966, Tracks: 0x1654AE6B,
        Cluster: 0x1F43B675, Cues: 0x1C53BB6B, SeekHead: 0x114D9B74, Void: 0xEC,
        TimecodeScale: 0x2AD7B1, Duration: 0x4489, Timecode: 0xE7, SimpleBlock: 0xA3,
        BlockGroup: 0xA0, TrackEntry: 0xAE, TrackNumber: 0xD7, TrackType: 0x83,
        Position: 0xA7, PrevSize: 0xAB, Block: 0xA1, ReferenceBlock: 0xFB,
    };
    /** Room inside Info for Duration (11 bytes), and after Info for a SeekHead
     * (26 bytes). Spare room stays a Void. */
    const INFO_RESERVE = 16;
    const TOP_RESERVE = 40;
    const CLUSTER_CHILDREN = new Set([ID.Timecode, ID.SimpleBlock, ID.BlockGroup, ID.Position, ID.PrevSize]);
    const TOP_LEVEL_KNOWN = new Set([ID.Cluster, ID.Cues, ID.SeekHead, ID.Void, 0x1254C367 /* Tags */, 0x1941A469 /* Attachments */, 0x1043A770 /* Chapters */]);

    /* ── EBML reading ───────────────────────────────────────────────────── */

    /** An element ID (marker bits kept) at `pos`, or null if it runs past the end. */
    function readId(b, pos) {
        if (pos >= b.length) return null;
        const first = b[pos];
        const len = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : first >= 0x10 ? 4 : 0;
        if (!len) throw new Error('bad element id');
        if (pos + len > b.length) return null;
        let id = 0;
        for (let i = 0; i < len; i++) id = id * 256 + b[pos + i];
        return { id, len };
    }

    /** A size (marker removed) at `pos`; `unknown` for the all-ones value. */
    function readSize(b, pos) {
        if (pos >= b.length) return null;
        const first = b[pos];
        let len = 1; let mask = 0x80;
        while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
        if (len > 8) throw new Error('bad size');
        if (pos + len > b.length) return null;
        let v = first & (mask - 1);
        let allOnes = v === mask - 1;
        for (let i = 1; i < len; i++) { v = v * 256 + b[pos + i]; if (b[pos + i] !== 0xff) allOnes = false; }
        return { value: allOnes ? null : v, len };
    }

    function readHeader(b, pos) {
        const id = readId(b, pos);
        if (!id) return null;
        const size = readSize(b, pos + id.len);
        if (!size) return null;
        return { id: id.id, size: size.value, head: id.len + size.len };
    }

    const readUInt = (b, pos, len) => { let v = 0; for (let i = 0; i < len; i++) v = v * 256 + b[pos + i]; return v; };

    /* ── EBML writing ───────────────────────────────────────────────────── */

    function idBytes(id) {
        const out = [];
        for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
        return out;
    }
    function sizeBytes(n, len) {
        const need = len ?? (n < 0x7f ? 1 : n < 0x3fff ? 2 : n < 0x1fffff ? 3 : n < 0x0fffffff ? 4 : 8);
        const out = new Array(need).fill(0);
        let v = n;
        for (let i = need - 1; i >= 0; i--) { out[i] = v % 256; v = Math.floor(v / 256); }
        out[0] |= 0x80 >> (need - 1);
        return out;
    }
    function uintBytes(v, len) {
        const need = len ?? Math.max(1, Math.ceil(Math.log2(v + 1) / 8));
        const out = new Array(need).fill(0);
        let x = v;
        for (let i = need - 1; i >= 0; i--) { out[i] = x % 256; x = Math.floor(x / 256); }
        return out;
    }
    const element = (id, payload, sizeLen) => [...idBytes(id), ...sizeBytes(payload.length, sizeLen), ...payload];
    function voidOf(total) {
        if (total < 2) throw new Error('void too small');
        if (total - 2 <= 126) return [ID.Void, ...sizeBytes(total - 2, 1), ...new Array(total - 2).fill(0)];
        return [ID.Void, ...sizeBytes(total - 9, 8), ...new Array(total - 9).fill(0)];
    }
    function float64(v) {
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat64(0, v);
        return [...new Uint8Array(view.buffer)];
    }

    /* ── The indexer ────────────────────────────────────────────────────── */

    function createWebmIndexer() {
        let failed = false;
        let headerDone = false;
        let carry = new Uint8Array(0);   // unconsumed bytes, never more than a header's worth after the header
        let base = 0;                    // original-stream offset of carry[0]
        let skip = 0;                    // payload bytes still to pass over

        // Learned from the header.
        let segDataStart = 0;
        let originalHeaderLength = 0;
        let rewritten = null;            // the header as emitted, with the reserved Voids
        let infoVoidAt = 0;              // where the Info reserve starts, in `rewritten`
        let topVoidAt = 0;
        let timecodeScale = 1_000_000;
        let videoTrack = null;

        // Learned while recording.
        let state = 'top';               // 'top' | 'cluster' | 'group'
        let group = null;                // the BlockGroup being read: { end, track, time, referenced }
        let clusterEnd = null;           // original offset where a known-size cluster ends
        let clusterStart = 0;
        let clusterTime = 0;
        let clusterCued = false;
        let maxTime = 0;
        let lastVideoTime = null;
        let videoGap = 0;
        const cues = [];                 // { time, clusterAt } — original offsets

        function fail(reason) {
            failed = true;
            carry = new Uint8Array(0);
            return { failed: true, reason };
        }

        function append(u8) {
            const next = new Uint8Array(carry.length + u8.length);
            next.set(carry, 0);
            next.set(u8, carry.length);
            carry = next;
        }

        /** Parses EBML header, Segment header, Info and Tracks; on the first
         * Cluster, builds the rewritten header. Returns null to wait for more. */
        function parseHeader() {
            const b = carry;
            const ebml = readHeader(b, 0);
            if (!ebml) return null;
            if (ebml.id !== ID.EBML || ebml.size === null) throw new Error('not an EBML stream');
            let pos = ebml.head + ebml.size;
            const seg = readHeader(b, pos);
            if (!seg) return null;
            if (seg.id !== ID.Segment) throw new Error('no Segment');
            const segHeaderAt = pos;
            segDataStart = pos + seg.head;
            pos = segDataStart;
            let info = null;
            while (true) {
                const e = readHeader(b, pos);
                if (!e) return null;
                if (e.id === ID.Cluster) break;
                if (e.size === null) throw new Error('unknown-size header element');
                if (pos + e.head + e.size > b.length) return null;
                if (e.id === ID.Info) info = { at: pos, head: e.head, size: e.size };
                else if (e.id === ID.Tracks) readTracks(b, pos + e.head, pos + e.head + e.size);
                else if (e.id !== ID.Void) throw new Error('header element not handled');
                pos += e.head + e.size;
            }
            if (!info) throw new Error('no Info');
            // Info's children: keep them, refuse a stream that already has a Duration.
            const kids = [];
            for (let q = info.at + info.head; q < info.at + info.head + info.size;) {
                const c = readHeader(b, q);
                if (c.id === ID.Duration) throw new Error('already has a Duration');
                if (c.id === ID.TimecodeScale) timecodeScale = readUInt(b, q + c.head, c.size);
                kids.push(...b.subarray(q, q + c.head + c.size));
                q += c.head + c.size;
            }
            const newInfoPayload = [...kids, ...voidOf(INFO_RESERVE)];
            const newInfo = element(ID.Info, newInfoPayload);
            const before = [...b.subarray(0, segDataStart)];
            const afterInfo = [...b.subarray(info.at + info.head + info.size, pos)];
            const out = [...before, ...newInfo, ...voidOf(TOP_RESERVE), ...afterInfo];
            infoVoidAt = before.length + newInfo.length - INFO_RESERVE;
            topVoidAt = before.length + newInfo.length;
            rewritten = new Uint8Array(out);
            originalHeaderLength = pos;
            void segHeaderAt;
            return pos;
        }

        function readTracks(b, from, to) {
            for (let q = from; q < to;) {
                const e = readHeader(b, q);
                if (e.id === ID.TrackEntry) {
                    let number = null; let type = null;
                    for (let r = q + e.head; r < q + e.head + e.size;) {
                        const c = readHeader(b, r);
                        if (c.id === ID.TrackNumber) number = readUInt(b, r + c.head, c.size);
                        if (c.id === ID.TrackType) type = readUInt(b, r + c.head, c.size);
                        r += c.head + c.size;
                    }
                    if (type === 1 && videoTrack === null) videoTrack = number;
                }
                q += e.head + e.size;
            }
        }

        function frame(track, time, keyframe) {
            if (time > maxTime) maxTime = time;
            if (track !== videoTrack) return;
            if (lastVideoTime !== null && time > lastVideoTime) videoGap = time - lastVideoTime;
            lastVideoTime = time;
            if (keyframe && !clusterCued) { cues.push({ time, clusterAt: clusterStart }); clusterCued = true; }
        }

        /** Walks element headers from carry[pos]; returns how far it got. */
        function walk(pos) {
            const b = carry;
            while (pos < b.length) {
                if (skip > 0) {
                    const n = Math.min(skip, b.length - pos);
                    skip -= n; pos += n;
                    continue;
                }
                const abs = base + pos;
                if (state === 'group') {
                    if (abs >= group.end) {
                        // A Block with no ReferenceBlock depends on nothing: a keyframe.
                        if (group.track !== null) frame(group.track, group.time, !group.referenced);
                        group = null; state = 'cluster';
                        continue;
                    }
                    const g = readHeader(b, pos);
                    if (!g) return pos;
                    if (g.size === null) throw new Error('unknown-size element in a BlockGroup');
                    if (g.id === ID.Block) {
                        const at = pos + g.head;
                        const track = readSize(b, at);
                        if (!track || at + track.len + 2 > b.length) return pos;
                        group.track = track.value;
                        group.time = clusterTime + ((b[at + track.len] << 8 | b[at + track.len + 1]) << 16 >> 16);
                    } else if (g.id === ID.ReferenceBlock) {
                        group.referenced = true;
                    }
                    pos += g.head; skip = g.size;
                    continue;
                }
                if (state === 'cluster' && clusterEnd !== null && abs >= clusterEnd) { state = 'top'; continue; }
                const e = readHeader(b, pos);
                if (!e) return pos;
                if (state === 'cluster' && !CLUSTER_CHILDREN.has(e.id)) {
                    if (clusterEnd !== null) throw new Error('element past a sized cluster');
                    state = 'top';           // an unknown-size cluster ends at the next top-level element
                    continue;
                }
                if (state === 'top') {
                    if (e.id === ID.Cluster) {
                        state = 'cluster';
                        clusterStart = abs;
                        clusterEnd = e.size === null ? null : abs + e.head + e.size;
                        clusterCued = false;
                        pos += e.head;
                        continue;
                    }
                    if (!TOP_LEVEL_KNOWN.has(e.id) || e.size === null) throw new Error('unexpected top-level element');
                    pos += e.head; skip = e.size;
                    continue;
                }
                // A cluster child.
                if (e.id === ID.Timecode) {
                    if (pos + e.head + e.size > b.length) return pos;
                    clusterTime = readUInt(b, pos + e.head, e.size);
                    pos += e.head + e.size;
                    continue;
                }
                if (e.id === ID.SimpleBlock) {
                    // track number (vint), relative timecode (int16), flags.
                    const at = pos + e.head;
                    const track = readSize(b, at);
                    if (!track || at + track.len + 3 > b.length) return pos;
                    const rel = (b[at + track.len] << 8 | b[at + track.len + 1]) << 16 >> 16;
                    const flags = b[at + track.len + 2];
                    frame(track.value, clusterTime + rel, (flags & 0x80) !== 0);
                    pos += e.head; skip = e.size;
                    continue;
                }
                if (e.id === ID.BlockGroup) {
                    if (e.size === null) throw new Error('unknown-size BlockGroup');
                    state = 'group';
                    group = { end: abs + e.head + e.size, track: null, time: 0, referenced: false };
                    pos += e.head;
                    continue;
                }
                pos += e.head; skip = e.size;    // Position, PrevSize: passed over
            }
            return pos;
        }

        /** Feed the ORIGINAL bytes, in order. Returns { header, originalHeaderLength }
         * once, when the header is complete; { failed } if the stream is not one
         * this can handle (from then on it is passed through unchanged). */
        function ingest(u8) {
            if (failed) return { failed: true };
            try {
                append(u8);
                let result = {};
                let pos = 0;
                if (!headerDone) {
                    const end = parseHeader();
                    if (end === null) {
                        if (carry.length > 1024 * 1024) return fail('header too long');
                        return {};
                    }
                    headerDone = true;
                    result = { header: rewritten, originalHeaderLength };
                    pos = end;
                }
                pos = walk(pos);
                carry = carry.slice(pos);
                base += pos;
                return result;
            } catch (e) {
                return fail(e?.message ?? 'parse error');
            }
        }

        /** At Stop: the header with Duration and SeekHead written in (same length
         * as the emitted header) and the Cues element to append; null when
         * there is nothing usable (indexer off, no header, no video keyframes). */
        function finish(totalEmittedBytes) {
            if (state === 'group' && group?.track !== null && group) frame(group.track, group.time, !group.referenced);
            if (failed || !rewritten || videoTrack === null || cues.length === 0) return null;
            const delta = rewritten.length - originalHeaderLength;
            const durationUnits = maxTime + videoGap;
            const cuePoints = cues.map(({ time, clusterAt }) => element(0xBB, [
                ...element(0xB3, uintBytes(time)),
                ...element(0xB7, [
                    ...element(0xF7, uintBytes(videoTrack)),
                    ...element(0xF1, uintBytes(clusterAt + delta - segDataStart)),
                ]),
            ]));
            const cuesPayload = cuePoints.flat();
            const cuesEl = element(ID.Cues, cuesPayload, 8);
            const cuesPosition = totalEmittedBytes - segDataStart;

            const durationEl = element(ID.Duration, float64(durationUnits));
            const seekHead = element(ID.SeekHead, element(0x4DBB, [
                ...element(0x53AB, idBytes(ID.Cues)),
                ...element(0x53AC, uintBytes(cuesPosition, 8)),
            ]));
            const patched = new Uint8Array(rewritten);
            patched.set([...durationEl, ...voidOf(INFO_RESERVE - durationEl.length)], infoVoidAt);
            patched.set([...seekHead, ...voidOf(TOP_RESERVE - seekHead.length)], topVoidAt);
            return {
                header: patched,
                trailer: new Uint8Array(cuesEl),
                durationMs: (durationUnits * timecodeScale) / 1e6,
                cuePoints: cues.length,
            };
        }

        return { ingest, finish, failed: () => failed };
    }

    /** The recorder's side: takes MediaRecorder's chunks (Blobs) in order and
     * passes on the chunks to keep and upload — the first one with its header
     * rewritten, the rest untouched (the same Blob objects, nothing copied).
     * Reading each chunk to index it is asynchronous, so chunks are handled
     * in a chain: order is kept, and finish() waits for the last one.
     *
     * finish() returns { header, trailer, durationMs } to apply at Stop, or
     * null — in which case what was passed on is a valid recording as it is. */
    function createRecordingIndex({ emit }) {
        const indexer = createWebmIndexer();
        let chain = Promise.resolve();
        let held = [];                  // chunks before the header is complete
        let headerDone = false;
        let emittedBytes = 0;
        const out = (blob) => { emittedBytes += blob.size; emit(blob); };

        function push(blob) {
            chain = chain.then(async () => {
                if (headerDone && indexer.failed()) { out(blob); return; }
                let r = { failed: true };
                try { r = indexer.ingest(new Uint8Array(await blob.arrayBuffer())); } catch { /* unreadable: pass through */ }
                if (headerDone) { out(blob); return; }
                held.push(blob);
                if (r.header) {
                    const all = new Blob(held);
                    held = [];
                    headerDone = true;
                    out(new Blob([r.header, all.slice(r.originalHeaderLength)]));
                } else if (r.failed) {
                    headerDone = true;
                    held.forEach(out);
                    held = [];
                }
            });
            return chain;
        }

        async function finish() {
            await chain;
            if (held.length) { held.forEach(out); held = []; return null; }
            return indexer.finish(emittedBytes);
        }

        return { push, finish };
    }

    const api = { createWebmIndexer, createRecordingIndex, INFO_RESERVE, TOP_RESERVE };
    globalThis.SnapRecWebm = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

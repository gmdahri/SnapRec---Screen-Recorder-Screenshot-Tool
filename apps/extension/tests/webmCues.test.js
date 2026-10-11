// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Blob as NodeBlob } from 'node:buffer';

/** A MediaRecorder WebM gets a Duration and a seek index (background/webm-cues.js).
 *
 * The fixture is a real Chrome MediaRecorder recording (7 s, VP9 + Opus, 1 s
 * timeslice): Segment and Clusters of unknown size, no Duration, no Cues —
 * which is why the share page showed "--:--" and could not seek. Measured in
 * Chrome on a 35-minute file of the same shape: with Duration alone the
 * duration shows and seeking works, but a seek over HTTP reads the file up to
 * the target (84 of 93 MB for 30:00); with Cues too it reads 5.4 MB. */

const FIXTURE = readFileSync(resolve(__dirname, 'fixtures/mediarecorder-7s.webm'));

function load() {
    const sandbox = { Blob: NodeBlob, Uint8Array, DataView, ArrayBuffer, Math, Error, Set, Promise, Number, Array };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../background/webm-cues.js'), 'utf8'), sandbox);
    return sandbox.SnapRecWebm;
}

/* A minimal reader for the assertions: top-level Segment children and Info's. */
function vint(b, pos, keepMarker) {
    const first = b[pos]; let len = 1; let mask = 0x80;
    while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
    let v = keepMarker ? first : first & (mask - 1); let ones = v === mask - 1;
    for (let i = 1; i < len; i++) { v = v * 256 + b[pos + i]; if (b[pos + i] !== 0xff) ones = false; }
    return { v, len, unknown: !keepMarker && ones };
}
function el(b, pos) { const id = vint(b, pos, true); const size = vint(b, pos + id.len, false); return { id: id.v, size: size.unknown ? null : size.v, head: id.len + size.len }; }
function structure(b) {
    const e = el(b, 0); const segAt = e.head + e.size; const seg = el(b, segAt); const dataStart = segAt + seg.head;
    const top = []; let info = null; let p = dataStart;
    while (p < b.length) {
        const x = el(b, p);
        top.push({ id: x.id, at: p });
        if (x.id === 0x1549A966) {
            info = [];
            for (let q = p + x.head; q < p + x.head + x.size;) { const c = el(b, q); info.push({ id: c.id, at: q, head: c.head, size: c.size }); q += c.head + c.size; }
        }
        if (x.id === 0x1F43B675 && x.size === null) {
            let q = p + x.head;                     // walk an unknown-size cluster's children
            while (q < b.length) { const c = el(b, q); if (![0xE7, 0xA3, 0xA0].includes(c.id)) break; q += c.head + c.size; }
            p = q; continue;
        }
        p += x.head + x.size;
    }
    return { dataStart, top, info };
}
const ids = (s) => s.top.map((t) => t.id);
const has = (s, id) => ids(s).includes(id);

/** Streams `bytes` through createRecordingIndex in chunks of `size`, as a
 * recorder would, and assembles what the extension keeps at Stop. */
async function record(bytes, size) {
    const { createRecordingIndex } = load();
    const emitted = [];
    const index = createRecordingIndex({ emit: (b) => emitted.push(b) });
    const pushed = [];
    for (let i = 0; i < bytes.length; i += size) {
        const chunk = new NodeBlob([bytes.subarray(i, i + size)]);
        pushed.push(chunk);
        index.push(chunk);
    }
    const fin = await index.finish();
    const stream = Buffer.from(await new NodeBlob(emitted).arrayBuffer());
    const file = fin ? Buffer.concat([Buffer.from(fin.header), stream.subarray(fin.header.length), Buffer.from(fin.trailer)]) : stream;
    return { fin, file, stream, emitted, pushed };
}

describe('what MediaRecorder writes (the bug)', () => {
    it('has no Duration in Info and no Cues', () => {
        const s = structure(FIXTURE);
        expect(s.info.map((c) => c.id)).not.toContain(0x4489);
        expect(has(s, 0x1C53BB6B)).toBe(false);
        expect(has(s, 0x114D9B74)).toBe(false);
    });
});

describe('after indexing', () => {
    it('Info has the duration of the recording', async () => {
        const { fin, file } = await record(FIXTURE, 16 * 1024);
        const s = structure(file);
        const d = s.info.find((c) => c.id === 0x4489);
        expect(d).toBeDefined();
        const seconds = new DataView(file.buffer, file.byteOffset + d.at + d.head, 8).getFloat64(0) / 1000;
        expect(seconds).toBeGreaterThan(6.9);       // last frame at 6.928 s
        expect(seconds).toBeLessThan(7.1);
        expect(fin.durationMs).toBeCloseTo(seconds * 1000, 3);
    });

    it('has Cues at the end, one per keyframe, each pointing at a Cluster', async () => {
        const { fin, file } = await record(FIXTURE, 16 * 1024);
        const s = structure(file);
        expect(ids(s).at(-1)).toBe(0x1C53BB6B);
        expect(fin.cuePoints).toBe(3);               // keyframes at 0, ~3.4, ~6.7 s
        // Each CueClusterPosition, from the start of the Segment's data, is a Cluster.
        const cues = s.top.at(-1);
        const cuesEl = el(file, cues.at);
        let found = 0;
        for (let q = cues.at + cuesEl.head; q < cues.at + cuesEl.head + cuesEl.size;) {
            const point = el(file, q);
            for (let r = q + point.head; r < q + point.head + point.size;) {
                const c = el(file, r);
                if (c.id === 0xB7) {
                    for (let t = r + c.head; t < r + c.head + c.size;) {
                        const g = el(file, t);
                        if (g.id === 0xF1) {
                            let pos = 0; for (let i = 0; i < g.size; i++) pos = pos * 256 + file[t + g.head + i];
                            expect(file.readUInt32BE(s.dataStart + pos)).toBe(0x1F43B675);
                            found++;
                        }
                        t += g.head + g.size;
                    }
                }
                r += c.head + c.size;
            }
            q += point.head + point.size;
        }
        expect(found).toBe(3);
    });

    it('has a SeekHead pointing at the Cues', async () => {
        const { file } = await record(FIXTURE, 16 * 1024);
        const s = structure(file);
        const head = s.top.find((t) => t.id === 0x114D9B74);
        expect(head).toBeDefined();
        // SeekHead > Seek > SeekPosition: the last 8 bytes of a fixed 26-byte element.
        const position = Number(file.readBigUInt64BE(head.at + 26 - 8));
        expect(file.readUInt32BE(s.dataStart + position)).toBe(0x1C53BB6B);
    });

    it('the patched header is the length of the one emitted, so nothing after it moves', async () => {
        const { fin, stream } = await record(FIXTURE, 16 * 1024);
        expect(stream.subarray(0, fin.header.length).length).toBe(fin.header.length);
        expect(structure(stream).info.find((c) => c.id === 0xEC)).toBeDefined();   // reserved, not yet written
    });

    it('passes every chunk after the header through as the very same Blob', async () => {
        const { emitted, pushed } = await record(FIXTURE, 16 * 1024);
        expect(emitted.slice(1)).toEqual(pushed.slice(1));
        emitted.slice(1).forEach((b, i) => expect(b).toBe(pushed[i + 1]));
    });

    it.each([7, 100, 189, 4096, 65536, FIXTURE.length])('the same result whatever the chunk size (%i bytes)', async (size) => {
        const reference = await record(FIXTURE, 16 * 1024);
        const { file } = await record(FIXTURE, size);
        expect(file.equals(reference.file)).toBe(true);
    });

    it('the recording\'s own bytes are untouched: only the header grew', async () => {
        const { fin, file } = await record(FIXTURE, 16 * 1024);
        const s0 = structure(FIXTURE);
        const firstCluster = s0.top.find((t) => t.id === 0x1F43B675).at;
        const grown = fin.header.length - firstCluster;
        expect(file.subarray(fin.header.length, file.length - fin.trailer.length).equals(FIXTURE.subarray(firstCluster))).toBe(true);
        expect(grown).toBe(56);
    });
});

describe('never costs a recording', () => {
    it('something that is not a WebM passes through unchanged, and nothing is patched', async () => {
        const junk = Buffer.from('this is not a webm at all, just bytes'.repeat(100));
        const { fin, file } = await record(junk, 512);
        expect(fin).toBeNull();
        expect(file.equals(junk)).toBe(true);
    });

    it('a WebM that already has a Duration passes through unchanged', async () => {
        // Info with TimecodeScale and a Duration, then a Cluster.
        const info = Buffer.from([0x15, 0x49, 0xa9, 0x66, 0x8f, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, 0x44, 0x89, 0x88, 0x40, 0x8f, 0x40, 0, 0, 0, 0, 0]);
        const ebml = FIXTURE.subarray(0, 36);
        const segment = Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        const cluster = Buffer.from([0x1f, 0x43, 0xb6, 0x75, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe7, 0x81, 0x00]);
        const input = Buffer.concat([ebml, segment, info, cluster]);
        const { fin, file } = await record(input, 64);
        expect(fin).toBeNull();
        expect(file.equals(input)).toBe(true);
    });

    it('a stream cut off mid-header passes through unchanged', async () => {
        const cut = FIXTURE.subarray(0, 120);
        const { fin, file } = await record(cut, 50);
        expect(fin).toBeNull();
        expect(file.equals(cut)).toBe(true);
    });
});

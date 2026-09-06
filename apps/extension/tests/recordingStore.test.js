// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import '../offscreen/recording-store.js';
const store = globalThis.SnapRecRecordingStore;

describe('durable recording journal', () => {
  it('recovers ordered chunks after the in-memory recorder is gone', async () => {
    const id = await store.begin('video/webm');
    await store.append(id, 0, new Blob(['first']));
    await store.append(id, 1, new Blob(['second']));
    expect(await (await store.blob(id, 'video/webm')).text()).toBe('firstsecond');
    expect((await store.list()).find(s => s.id === id).complete).toBe(false);
  });
  it('starting another capture does not erase the previous unfinished one', async () => {
    const first = await store.begin('video/webm');
    await store.append(first, 0, new Blob(['keep']));
    const second = await store.begin('video/webm');
    await store.finish(second);
    expect(await (await store.blob(first, 'video/webm')).text()).toBe('keep');
    expect((await store.list()).find(s => s.id === second).complete).toBe(true);
  });
  it('explicit removal deletes only the chosen capture', async () => {
    const first = await store.begin('video/webm');
    const second = await store.begin('video/webm');
    await store.append(first, 0, new Blob(['delete']));
    await store.append(second, 0, new Blob(['retain']));
    await store.remove(first);
    expect((await store.list()).some(s => s.id === first)).toBe(false);
    expect((await store.blob(first, 'video/webm')).size).toBe(0);
    expect(await (await store.blob(second, 'video/webm')).text()).toBe('retain');
  });
});

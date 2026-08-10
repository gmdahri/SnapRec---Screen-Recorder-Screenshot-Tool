import { describe, expect, it, vi } from 'vitest';
import { detectExtension } from '../useExtensionStatus';

describe('extension detection', () => {
  it('reports connected with a version when the ping answers', async () => {
    const r = await detectExtension({ isChromium: true, ping: async () => ({ version: '2.4' }) });
    expect(r).toEqual({ status: 'connected', version: '2.4' });
  });

  it('reports unsupported on a non-Chromium browser without pinging', async () => {
    const ping = vi.fn();
    const r = await detectExtension({ isChromium: false, ping });
    expect(r.status).toBe('unsupported');
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports notInstalled when the ping resolves null', async () => {
    expect((await detectExtension({ isChromium: true, ping: async () => null })).status)
      .toBe('notInstalled');
  });

  it('reports notResponding when the ping hangs past the timeout', async () => {
    const r = await detectExtension({
      isChromium: true, ping: () => new Promise(() => {}), timeoutMs: 10,
    });
    expect(r.status).toBe('notResponding');
  });

  it('reports notResponding when the ping throws', async () => {
    const r = await detectExtension({
      isChromium: true, ping: async () => { throw new Error('boom'); },
    });
    expect(r.status).toBe('notResponding');
  });
});

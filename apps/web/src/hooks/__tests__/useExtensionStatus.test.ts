import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { detectExtension, useExtensionStatus } from '../useExtensionStatus';

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

  it('starts in checking, not in a failure state', async () => {
    // A hook that initialises to notResponding tells the user the extension is
    // broken before it has asked. That was the flash this state exists to stop.
    const { result } = renderHook(() => useExtensionStatus());
    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).not.toBe('checking'));
  });

  it('clears its timeout when the ping answers first', async () => {
    vi.useFakeTimers();
    try {
      const ping = () => Promise.resolve({ version: '1.3.3' });
      await detectExtension({ isChromium: true, ping, timeoutMs: 1200 });
      // A pending timer per call leaks, and in tests it fires after teardown.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

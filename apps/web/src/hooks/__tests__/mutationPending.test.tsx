import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddComment, useRecording, useUpdateRecording, recordingsKeys } from '../useRecordings';

/** `isPending` has to cover the refetch, not only the request.
 *
 * Both mutations answer, then invalidate the recording so the new row or the
 * new text arrives. If the invalidation is fired and forgotten, the mutation
 * settles first and every surface driven by `isPending` — the comment skeleton,
 * the description's saving state — clears while the page is still holding the
 * old data. That leaves a frame showing neither the pending state nor the
 * result, which reads as the write having been dropped.
 *
 * These tests gate the refetch open to make that window observable. */

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } },
}));

/** A promise plus the handle to settle it later. */
function gate<T>() {
  let open!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { open = resolve; });
  return { promise, open };
}

const json = (body: unknown) => ({
  ok: true, status: 200, statusText: 'OK',
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const recording = {
  id: 'r1', title: 'Demo', fileUrl: '/f.webm', type: 'video',
  createdAt: '2026-08-09T10:00:00Z', views: 1, reactions: [], comments: [],
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Renders the query and the mutation together, and reports the pending flag
 * the share surfaces actually read. */
function harness(useMutationHook: typeof useAddComment | typeof useUpdateRecording) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const fired: { run: () => void } = { run: () => {} };

  function Probe() {
    useRecording('r1');
    const mutation = useMutationHook();
    fired.run = () => mutation.mutate(
      // Both shapes are accepted by their own hook; the other field is ignored.
      { id: 'r1', content: 'looks right', data: { description: 'new' } } as never,
    );
    return <span data-testid="pending">{String(mutation.isPending)}</span>;
  }

  render(<Probe />, { wrapper: wrapper(client) });
  return { client, fired };
}

describe.each([
  ['useAddComment', useAddComment] as const,
  ['useUpdateRecording', useUpdateRecording] as const,
])('%s', (_name, hook) => {
  it('stays pending until the refetched recording has arrived', async () => {
    const firstLoad = json(recording);
    const refetch = gate<ReturnType<typeof json>>();

    fetchMock
      // The query's initial load.
      .mockImplementationOnce(async () => firstLoad)
      // The mutation itself: answers straight away.
      .mockImplementationOnce(async () => json({ ok: true }))
      // The refetch the invalidation triggers: held open.
      .mockImplementationOnce(() => refetch.promise);

    const { fired } = harness(hook);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fired.run();
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('true'));

    // The POST/PATCH has been answered and the refetch is in flight. This is
    // exactly the window that used to report "done".
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId('pending')).toHaveTextContent('true');

    refetch.open(json({ ...recording, views: 2 }));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('false'));
  });
});

describe('recordingsKeys', () => {
  it('keeps detail under the list prefix, so one invalidation reaches both', () => {
    expect(recordingsKeys.detail('r1').slice(0, 1)).toEqual([...recordingsKeys.all]);
  });
});

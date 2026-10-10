import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { recordingsKeys } from '../hooks/useRecordings';

/** One viewer's copy of a recording is never another viewer's.
 *
 * GET /recordings/:id answers per viewer — whether they own it, wrote a
 * comment, reacted — so the cached copy is keyed by who fetched it. And every
 * copy still shares the recording's prefix, so the mutations that invalidate
 * "this recording" reach all of them. */

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

describe('the cached copy of a recording', () => {
    it('is separate per viewer, and separate for anonymous', () => {
        const client = new QueryClient();
        client.setQueryData(recordingsKeys.detailFor('r1', 'sb-owner'), { viewerIsOwner: true });
        expect(client.getQueryData(recordingsKeys.detailFor('r1', null))).toBeUndefined();
        expect(client.getQueryData(recordingsKeys.detailFor('r1', 'sb-other'))).toBeUndefined();
        expect(client.getQueryData(recordingsKeys.detailFor('r1', 'sb-owner'))).toEqual({ viewerIsOwner: true });
    });

    it('every viewer’s copy is invalidated together', async () => {
        const client = new QueryClient();
        for (const viewer of ['sb-owner', 'sb-other', null]) {
            client.setQueryData(recordingsKeys.detailFor('r1', viewer), { v: viewer });
        }
        await client.invalidateQueries({ queryKey: recordingsKeys.detail('r1') });
        const states = client.getQueryCache().findAll({ queryKey: recordingsKeys.detail('r1') }).map((q) => q.state.isInvalidated);
        expect(states).toEqual([true, true, true]);
    });
});

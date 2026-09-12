import { RecordingsService } from '../recordings.service';

/** The job that bounds anonymous storage cost.
 *
 * If this silently stops working, nothing breaks visibly — guest recordings
 * simply accumulate and bill. These tests pin the two things that would make
 * it useless: deleting the R2 object as well as the row, and never wedging on
 * an object that has already gone. */

function serviceWithRows(rows: any[]) {
  const deletedKeys: string[] = [];
  const removed: any[] = [];
  const repo = {
    find: async () => rows,
    remove: async (r: any[]) => { removed.push(...r); return r; },
  };
  const storage = { deleteObject: async (k: string) => { deletedKeys.push(k); } };
  // Positional, matching the constructor exactly: recordings, reactions,
  // comments, views, usersService, storageService. Only the first and last
  // are exercised here.
  const svc = new RecordingsService(
    repo as any, {} as any, {} as any, {} as any, {} as any, storage as any);
  return { svc, deletedKeys, removed };
}

describe('sweepExpired', () => {
  it('deletes the R2 object as well as the row', async () => {
    const { svc, deletedKeys, removed } = serviceWithRows([
      { id: 'r1', fileUrl: 'video-1.webm', expiresAt: new Date('2026-01-01') },
    ]);
    const result = await svc.sweepExpired(new Date('2026-01-02'));
    expect(result.deleted).toBe(1);
    expect(deletedKeys).toEqual(['video-1.webm']);
    expect(removed).toHaveLength(1);
  });

  it('reports zero when nothing is due', async () => {
    const { svc, deletedKeys } = serviceWithRows([]);
    expect((await svc.sweepExpired(new Date())).deleted).toBe(0);
    expect(deletedKeys).toEqual([]);
  });

  it('still removes the row when the R2 object is already gone', async () => {
    // An object deleted by hand, or a failed upload, must not wedge the sweep.
    const { svc, removed } = serviceWithRows([
      { id: 'r1', fileUrl: 'missing.webm', expiresAt: new Date('2026-01-01') },
    ]);
    (svc as any).storageService.deleteObject = async () => { throw new Error('404'); };
    expect((await svc.sweepExpired(new Date('2026-01-02'))).deleted).toBe(1);
    expect(removed).toHaveLength(1);
  });
});

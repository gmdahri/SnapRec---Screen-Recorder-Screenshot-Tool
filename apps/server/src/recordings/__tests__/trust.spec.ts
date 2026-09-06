import { RecordingsService } from '../recordings.service';
import { RecordingsController } from '../recordings.controller';
import { guestPrincipal, UploadPolicyService } from '../../storage/upload-policy.service';

function setup(record: any = {}) {
  const row = { id: 'capture', fileUrl: 'media.webm', views: 0, isPublic: true, user: { supabaseId: 'owner' }, ...record };
  const repo = { findOne: jest.fn().mockResolvedValue(row), find: jest.fn().mockResolvedValue([row]), save: jest.fn(), insert: jest.fn(), remove: jest.fn(), query: jest.fn().mockResolvedValue([]) };
  const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const service = new RecordingsService(repo as any, {} as any, {} as any, {} as any, { findOrCreateBySupabaseId: jest.fn().mockResolvedValue({ supabaseId: 'new-owner' }) } as any, storage as any);
  return { service, repo, row, storage };
}

describe('recording trust boundaries', () => {
  test.each([undefined, 'stranger'])('private capture denies viewer %s', async viewer => {
    const { service } = setup({ isPublic: false });
    await expect(service.assertAccess('capture', viewer)).rejects.toThrow('unavailable');
  });
  test('private ownerless capture is not accessible to an anonymous viewer', async () => {
    await expect(setup({ isPublic: false, user: null }).service.assertAccess('capture')).rejects.toThrow('unavailable');
  });
  test('owner can open a disabled link', async () => {
    const { service } = setup({ sharingDisabledAt: new Date() });
    await expect(service.assertAccess('capture', 'owner')).resolves.toBeDefined();
  });
  test('file download cannot bypass link revocation', async () => {
    await expect(setup({ isPublic: false }).service.assertFileAccess('media.webm', 'stranger')).rejects.toThrow();
  });
  test('metadata reads do not increment views and do not expose guest proof', async () => {
    const { service, repo } = setup({ guestId: 'secret-hash' });
    expect((await service.assertAccess('capture')).guestId).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });
  test('owner view does not count', async () => {
    const { service, repo } = setup();
    await expect(service.recordQualifiedView('capture', 'session', 'owner')).resolves.toEqual({ counted: false });
    expect(repo.query).not.toHaveBeenCalled();
  });
  test('legacy ownerless captures cannot be claimed by link id', async () => {
    const { service, row } = setup({ user: null, guestId: null });
    expect(await service.claimRecordings('attacker', ['capture'])).toEqual({ claimed: [] });
    expect(row.user).toBeNull();
  });
  test('duplicate supplied id uses insert and returns a conflict', async () => {
    const { service, repo } = setup();
    repo.insert.mockRejectedValue({ code: '23505' });
    await expect(service.create({ id: 'capture', title: 'x', fileUrl: 'f', type: 'video' })).rejects.toThrow('already exists');
    expect(repo.save).not.toHaveBeenCalled();
  });
  test('failed media deletion retains metadata for retry', async () => {
    const { service, storage, repo } = setup();
    storage.deleteObject.mockRejectedValue(new Error('R2 unavailable'));
    await expect(service.delete('capture', 'owner')).rejects.toThrow('R2 unavailable');
    expect(repo.remove).not.toHaveBeenCalled();
  });
  test('request body cannot choose the authenticated owner', async () => {
    const recordings = { create: jest.fn() };
    const uploads = { assertOwned: jest.fn() };
    const controller = new RecordingsController({} as any, recordings as any, uploads as any);
    await controller.createRecording({ user: { id: 'real' } }, { title: 't', fileUrl: 'f', type: 'video', userId: 'victim' });
    expect(recordings.create.mock.calls[0][0].userId).toBe('real');
    expect(uploads.assertOwned).toHaveBeenCalledWith('f', 'user:real');
  });
  test('guest proof is hashed and malformed credentials are rejected', () => {
    expect(() => guestPrincipal({ headers: {} })).toThrow();
    expect(guestPrincipal({ headers: { 'x-snaprec-guest': 'a3a19e73-f8c9-499f-9e6a-7ad8fcd7f42e' } })).toMatch(/^guest:[a-f0-9]{64}$/);
  });
  test('upload rejects unsupported MIME and oversized files before signing', async () => {
    const storage = { getUploadPresignedUrl: jest.fn() };
    const policy = new UploadPolicyService({} as any, storage as any);
    await expect(policy.issue({ user: { id: 'owner' } }, 'text/html', 10)).rejects.toThrow('Unsupported');
    await expect(policy.issue({ user: { id: 'owner' } }, 'video/webm', 999999999999)).rejects.toThrow('Unsupported');
    expect(storage.getUploadPresignedUrl).not.toHaveBeenCalled();
  });
  test('uploaded objects cannot be attached by another owner', async () => {
    const policy = new UploadPolicyService({ query: jest.fn().mockResolvedValue([]) } as any, {} as any);
    await expect(policy.assertOwned('someone-elses.webm', 'user:attacker')).rejects.toThrow('does not belong');
  });
});

import { RecordingsService } from '../recordings.service';

/** PATCH /recordings/:id (and the video editor's newFileUrl, which goes
 * through update()) writes the columns it changes and nothing else.
 *
 * It used to save() the loaded row, writing every column of a possibly stale
 * copy back — views counted while the request was in flight were lost. */

const ID = '44444444-4444-4444-8444-444444444444';

function makeService() {
    const recording: any = { id: ID, title: 'Old', fileUrl: 'old.webm', views: 7, description: 'd', user: { supabaseId: 'sb-owner' } };
    const repo = {
        findOne: jest.fn().mockResolvedValue(recording),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const svc = new RecordingsService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { svc, repo };
}

describe('what PATCH writes', () => {
    it('a rename writes the title only', async () => {
        const { svc, repo } = makeService();
        const out = await svc.update(ID, { title: 'New' }, 'sb-owner');
        expect(repo.save).not.toHaveBeenCalled();
        expect(repo.update).toHaveBeenCalledWith(ID, { title: 'New' });
        expect(out).toMatchObject({ id: ID, title: 'New', views: 7 });
    });

    it('a new file and a cleared description write exactly those', async () => {
        const { svc, repo } = makeService();
        await svc.update(ID, { fileUrl: 'new.webm', description: '' }, 'sb-owner');
        expect(repo.update).toHaveBeenCalledWith(ID, { fileUrl: 'new.webm', description: '' });
    });

    it('nothing to change writes nothing', async () => {
        const { svc, repo } = makeService();
        await svc.update(ID, {}, 'sb-owner');
        expect(repo.update).not.toHaveBeenCalled();
        expect(repo.save).not.toHaveBeenCalled();
    });
});

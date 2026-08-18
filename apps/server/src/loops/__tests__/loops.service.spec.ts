import { ConfigService } from '@nestjs/config';
import { LoopsService } from '../loops.service';
import { LoopsContactSource } from '../loops.contacts';

function configWith(values: Record<string, string | undefined>): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function user(overrides: Partial<LoopsContactSource> = {}): LoopsContactSource {
    return {
        id: 'db-uuid-1',
        supabaseId: 'sb-123',
        email: 'ada@example.com',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ...overrides,
    };
}

describe('LoopsService', () => {
    it('is disabled and does not throw when the API key is missing', async () => {
        const service = new LoopsService(configWith({ LOOPS_MAILING_LIST_ID: 'list_1' }));

        await expect(service.upsertContact(user())).resolves.toBeUndefined();
    });

    it('is disabled and does not throw when the mailing list id is missing', async () => {
        const service = new LoopsService(configWith({ LOOPS_API_KEY: 'key' }));

        await expect(service.upsertContact(user())).resolves.toBeUndefined();
    });

    it('skips users without an email', async () => {
        const upsert = jest.fn();
        const service = new LoopsService(
            configWith({ LOOPS_API_KEY: 'key', LOOPS_MAILING_LIST_ID: 'list_1' }),
        );
        (service as any).client = { upsertContact: upsert };

        await expect(service.upsertContact(user({ email: null }))).resolves.toBeUndefined();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('skips internal addresses so they never reach the Loops API', async () => {
        const upsert = jest.fn();
        const service = new LoopsService(
            configWith({
                LOOPS_API_KEY: 'key',
                LOOPS_MAILING_LIST_ID: 'list_1',
                EXCLUDED_DOMAINS: 'codingcops.com',
            }),
        );
        (service as any).client = { upsertContact: upsert };

        await service.upsertContact(user({ email: 'gm@codingcops.com' }));

        expect(upsert).not.toHaveBeenCalled();
    });

    it('forwards a syncable user to the client', async () => {
        const upsert = jest.fn().mockResolvedValue('created');
        const service = new LoopsService(
            configWith({ LOOPS_API_KEY: 'key', LOOPS_MAILING_LIST_ID: 'list_1' }),
        );
        (service as any).client = { upsertContact: upsert };

        await service.upsertContact(user());

        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert.mock.calls[0][0].email).toBe('ada@example.com');
    });
});

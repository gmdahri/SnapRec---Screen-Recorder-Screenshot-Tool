import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { LoopsService } from '../loops.service';

describe('Loops contact sync on signup', () => {
    let usersService: UsersService;
    let loopsUpsert: jest.Mock;
    let repo: { findOne: jest.Mock; save: jest.Mock };

    beforeEach(async () => {
        loopsUpsert = jest.fn().mockResolvedValue(undefined);
        repo = {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation(async (u: User) => u),
        };

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: repo },
                { provide: MailService, useValue: { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) } },
                { provide: LoopsService, useValue: { upsertContact: loopsUpsert } },
            ],
        }).compile();

        usersService = moduleRef.get(UsersService);
    });

    it('syncs a newly created user to Loops', async () => {
        await usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com', fullName: 'A B' });

        expect(loopsUpsert).toHaveBeenCalledTimes(1);
        expect(loopsUpsert.mock.calls[0][0].email).toBe('a@gmail.com');
    });

    it('does not sync a user who has no email', async () => {
        await usersService.findOrCreateBySupabaseId('sb-1', { fullName: 'A B' });

        expect(loopsUpsert).not.toHaveBeenCalled();
    });

    it('still resolves when the Loops sync rejects — signup must never fail on Loops', async () => {
        loopsUpsert.mockRejectedValue(new Error('Loops is down'));

        await expect(
            usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com', fullName: 'A B' }),
        ).resolves.toBeDefined();
    });

    it('does not sync an existing user again', async () => {
        const existing = Object.assign(new User(), {
            id: 'db-1',
            supabaseId: 'sb-1',
            email: 'a@gmail.com',
            fullName: 'A B',
        });
        repo.findOne.mockResolvedValue(existing);

        await usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com' });

        expect(loopsUpsert).not.toHaveBeenCalled();
    });
});

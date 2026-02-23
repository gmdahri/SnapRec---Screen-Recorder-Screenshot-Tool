import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
        private readonly mailService: MailService,
    ) { }

    /**
     * Find a user by their Supabase ID, or create one if not exists.
     * Handles race conditions from concurrent requests.
     * Also backfills missing metadata on existing users.
     */
    async findOrCreateBySupabaseId(
        supabaseId: string,
        userMeta?: { email?: string; fullName?: string; avatarUrl?: string },
    ): Promise<User> {
        let user = await this.usersRepository.findOne({ where: { supabaseId } });

        if (!user) {
            try {
                user = new User();
                user.supabaseId = supabaseId;
                if (userMeta?.email) user.email = userMeta.email;
                if (userMeta?.fullName) user.fullName = userMeta.fullName;
                if (userMeta?.avatarUrl) user.avatarUrl = userMeta.avatarUrl;
                await this.usersRepository.save(user);
                this.logger.log(`Created new user with supabaseId: ${supabaseId}`);

                // Fire-and-forget: send welcome email without blocking user creation
                if (user.email) {
                    this.mailService.sendWelcomeEmail(user.email, user.fullName)
                        .catch(err => this.logger.error('Failed to queue welcome email', err));
                }
            } catch (error: any) {
                // Handle race condition - user might have been created by another request
                if (error.code === '23505') { // Postgres unique constraint violation
                    user = await this.usersRepository.findOne({ where: { supabaseId } });
                    if (!user) {
                        throw new Error('User not found after duplicate key error');
                    }
                } else {
                    throw error;
                }
            }
        } else if (userMeta) {
            // Backfill missing metadata on existing users
            let needsUpdate = false;
            if (userMeta.email && !user.email) { user.email = userMeta.email; needsUpdate = true; }
            if (userMeta.fullName && !user.fullName) { user.fullName = userMeta.fullName; needsUpdate = true; }
            if (userMeta.avatarUrl && !user.avatarUrl) { user.avatarUrl = userMeta.avatarUrl; needsUpdate = true; }
            if (needsUpdate) {
                await this.usersRepository.save(user);
                this.logger.log(`Updated metadata for user with supabaseId: ${supabaseId}`);
            }
        }

        return user;
    }

    async findBySupabaseId(supabaseId: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { supabaseId } });
    }

    async findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    /**
     * Find a user by their Supabase ID, or create one if not exists.
     * Handles race conditions from concurrent requests.
     */
    async findOrCreateBySupabaseId(supabaseId: string, email?: string): Promise<User> {
        let user = await this.usersRepository.findOne({ where: { supabaseId } });

        if (!user) {
            try {
                user = new User();
                user.supabaseId = supabaseId;
                if (email) user.email = email;
                await this.usersRepository.save(user);
                this.logger.log(`Created new user with supabaseId: ${supabaseId}`);
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

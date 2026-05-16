import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

/**
 * AdminGuard — Requires JwtAuthGuard to run first so req.user.id is the Supabase ID.
 * Looks up the User row and rejects unless isAdmin is true.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const supabaseId = req.user?.id;
        if (!supabaseId) throw new ForbiddenException('Authentication required');
        const user = await this.usersRepository.findOne({ where: { supabaseId } });
        if (!user?.isAdmin) {
            throw new ForbiddenException('Admin access required');
        }
        req.internalUser = user;
        return true;
    }
}

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PlanGuard implements CanActivate {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly usersService: UsersService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const supabaseId = req.user?.id;
        if (!supabaseId) {
            throw new ForbiddenException('Authentication required');
        }
        const user = await this.usersService.findBySupabaseId(supabaseId);
        if (!user) {
            throw new ForbiddenException('Pro plan required');
        }
        const plan = await this.subscriptionsService.getPlan(user.id);
        if (plan !== 'pro') {
            throw new ForbiddenException('Pro plan required');
        }
        // Attach the resolved internal user for downstream handlers
        req.internalUser = user;
        return true;
    }
}

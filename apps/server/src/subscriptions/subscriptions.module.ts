import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlanGuard } from './plan.guard';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([Subscription, User]), UsersModule],
    providers: [SubscriptionsService, PlanGuard],
    controllers: [SubscriptionsController],
    exports: [SubscriptionsService, PlanGuard],
})
export class SubscriptionsModule {}

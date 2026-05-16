import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Recording, Subscription])],
    controllers: [AdminController],
    providers: [AdminService, AdminGuard],
})
export class AdminModule {}

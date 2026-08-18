import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { LoopsModule } from '../loops/loops.module';

@Module({
    imports: [TypeOrmModule.forFeature([User]), MailModule, LoopsModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService, TypeOrmModule],
})
export class UsersModule { }

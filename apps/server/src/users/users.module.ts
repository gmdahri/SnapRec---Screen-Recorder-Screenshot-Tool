import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [TypeOrmModule.forFeature([User]), MailModule],
    providers: [UsersService],
    exports: [UsersService, TypeOrmModule],
})
export class UsersModule { }

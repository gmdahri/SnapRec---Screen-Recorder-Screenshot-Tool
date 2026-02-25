import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @UseGuards(JwtAuthGuard)
    @Post('sync')
    async syncUser(@Req() req: any) {
        const userMeta = {
            email: req.user.email,
            fullName: req.user.fullName,
            avatarUrl: req.user.avatarUrl
        };
        const user = await this.usersService.findOrCreateBySupabaseId(req.user.id, userMeta);
        return { success: true, user };
    }
}

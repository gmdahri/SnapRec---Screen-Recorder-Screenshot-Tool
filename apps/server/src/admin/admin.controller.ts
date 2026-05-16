import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('stats')
    async stats() {
        return this.adminService.getStats();
    }

    @Get('users')
    async users(@Query('limit') limit?: string, @Query('offset') offset?: string) {
        return this.adminService.listUsers(
            limit ? parseInt(limit, 10) : 50,
            offset ? parseInt(offset, 10) : 0,
        );
    }
}

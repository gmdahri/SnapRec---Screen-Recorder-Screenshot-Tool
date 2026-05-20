import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    UseGuards,
    Headers,
    HttpCode,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { UsersService } from '../users/users.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
    private readonly logger = new Logger(SubscriptionsController.name);

    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly usersService: UsersService,
    ) {}

    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async checkout(@Req() req: any, @Body() dto: CheckoutDto) {
        const user = await this.usersService.findOrCreateBySupabaseId(req.user.id, {
            email: req.user.email,
            fullName: req.user.fullName,
            avatarUrl: req.user.avatarUrl,
        });
        return this.subscriptionsService.createCheckoutSession(user.id, dto.successUrl, dto.cancelUrl);
    }

    @UseGuards(JwtAuthGuard)
    @Post('portal')
    async portal(@Req() req: any) {
        const user = await this.usersService.findBySupabaseId(req.user.id);
        if (!user) throw new BadRequestException('User not found');
        return this.subscriptionsService.createPortalSession(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('topup')
    async topup(@Req() req: any, @Body() dto: { packId: string; successUrl?: string; cancelUrl?: string }) {
        const user = await this.usersService.findOrCreateBySupabaseId(req.user.id, {
            email: req.user.email,
            fullName: req.user.fullName,
            avatarUrl: req.user.avatarUrl,
        });
        return this.subscriptionsService.createTopupSession(
            user.id,
            dto.packId,
            dto.successUrl,
            dto.cancelUrl,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async me(@Req() req: any) {
        const user = await this.usersService.findOrCreateBySupabaseId(req.user.id, {
            email: req.user.email,
            fullName: req.user.fullName,
            avatarUrl: req.user.avatarUrl,
        });
        return this.subscriptionsService.getSubscriptionInfo(user.id);
    }

    @Post('webhook')
    @HttpCode(200)
    async webhook(@Req() req: Request, @Headers('paddle-signature') signature: string) {
        const raw = (req as any).rawBody as string | undefined;
        if (!raw) {
            this.logger.error('Paddle webhook received without raw body — check main.ts raw-body wiring');
            throw new BadRequestException('Missing raw body');
        }
        if (!signature) throw new BadRequestException('Missing paddle-signature header');
        await this.subscriptionsService.handleWebhook(raw, signature);
        return { received: true };
    }
}

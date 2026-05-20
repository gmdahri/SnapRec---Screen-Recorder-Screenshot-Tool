import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paddle, Environment, EventName } from '@paddle/paddle-node-sdk';
import type {
    SubscriptionCreatedNotification,
    TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { Subscription, Plan } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';

const PRO_INCLUDED_MINUTES = 20 * 60;

export const TOPUP_PACKS: Record<string, { minutes: number; priceIdEnv: string; label: string }> = {
    '5h': { minutes: 5 * 60, priceIdEnv: 'PADDLE_PRICE_TOPUP_5H', label: '5 hours' },
    '10h': { minutes: 10 * 60, priceIdEnv: 'PADDLE_PRICE_TOPUP_10H', label: '10 hours' },
    '20h': { minutes: 20 * 60, priceIdEnv: 'PADDLE_PRICE_TOPUP_20H', label: '20 hours' },
};

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);
    private readonly paddle: Paddle | null;
    private readonly priceIdPro: string | undefined;
    private readonly webhookSecret: string | undefined;
    private readonly webBaseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Subscription)
        private readonly subscriptionsRepository: Repository<Subscription>,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {
        const apiKey = this.configService.get<string>('PADDLE_API_KEY');
        const env = this.configService.get<string>('PADDLE_ENV');
        this.paddle = apiKey
            ? new Paddle(apiKey, {
                  environment: env === 'production' ? Environment.production : Environment.sandbox,
              })
            : null;
        this.priceIdPro = this.configService.get<string>('PADDLE_PRICE_ID_PRO_MONTHLY');
        this.webhookSecret = this.configService.get<string>('PADDLE_WEBHOOK_SECRET');
        this.webBaseUrl =
            this.configService.get<string>('WEB_BASE_URL') || 'https://www.snaprecorder.org';
        if (!this.paddle) {
            this.logger.warn('PADDLE_API_KEY not configured — billing endpoints disabled');
        }
    }

    private requirePaddle(): Paddle {
        if (!this.paddle) {
            throw new BadRequestException('Billing is not configured on this server');
        }
        return this.paddle;
    }

    async findByUserId(userId: string): Promise<Subscription | null> {
        return this.subscriptionsRepository.findOne({ where: { userId } });
    }

    async getOrCreate(userId: string): Promise<Subscription> {
        let sub = await this.findByUserId(userId);
        if (!sub) {
            sub = this.subscriptionsRepository.create({
                userId,
                plan: 'free',
                status: 'inactive',
                aiMinutesIncluded: 0,
                aiMinutesUsedThisCycle: 0,
            });
            sub = await this.subscriptionsRepository.save(sub);
        }
        return sub;
    }

    async getPlan(userId: string): Promise<Plan> {
        const sub = await this.findByUserId(userId);
        if (!sub) return 'free';
        return sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing')
            ? 'pro'
            : 'free';
    }

    async getSubscriptionInfo(userId: string) {
        const sub = await this.findByUserId(userId);
        if (!sub) {
            return {
                plan: 'free' as Plan,
                status: 'inactive',
                currentPeriodEnd: null,
                trialEnd: null,
                aiMinutesUsedThisCycle: 0,
                aiMinutesIncluded: 0,
                aiMinutesPurchased: 0,
            };
        }
        return {
            plan: sub.plan,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEnd: sub.trialEnd,
            aiMinutesUsedThisCycle: sub.aiMinutesUsedThisCycle,
            aiMinutesIncluded: sub.aiMinutesIncluded,
            aiMinutesPurchased: sub.aiMinutesPurchased,
        };
    }

    private totalAvailableMinutes(sub: Subscription): number {
        return sub.aiMinutesIncluded + sub.aiMinutesPurchased;
    }

    async hasQuotaFor(userId: string, minutesNeeded: number): Promise<boolean> {
        const sub = await this.findByUserId(userId);
        if (!sub) return false;
        const isPro = sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing');
        if (!isPro && sub.aiMinutesPurchased <= 0) return false;
        return sub.aiMinutesUsedThisCycle + minutesNeeded <= this.totalAvailableMinutes(sub);
    }

    async recordUsage(userId: string, minutes: number): Promise<void> {
        const sub = await this.findByUserId(userId);
        if (!sub) return;
        sub.aiMinutesUsedThisCycle += Math.max(0, Math.ceil(minutes));
        await this.subscriptionsRepository.save(sub);
    }

    async createCheckoutSession(userId: string, successUrl?: string, cancelUrl?: string) {
        const paddle = this.requirePaddle();
        if (!this.priceIdPro) {
            throw new BadRequestException('PADDLE_PRICE_ID_PRO_MONTHLY not configured');
        }

        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const sub = await this.getOrCreate(userId);

        // Reuse existing Paddle customer or create one
        let customerId = sub.paddleCustomerId;
        if (!customerId) {
            const customer = await paddle.customers.create({
                email: user.email!,
                name: user.fullName || undefined,
                customData: { userId: user.id },
            });
            customerId = customer.id;
            sub.paddleCustomerId = customerId;
            await this.subscriptionsRepository.save(sub);
        }

        const transaction = await paddle.transactions.create({
            items: [{ priceId: this.priceIdPro, quantity: 1 }],
            customerId,
            customData: { userId: user.id },
        });

        return { url: transaction.checkout?.url };
    }

    async createTopupSession(userId: string, packId: string, successUrl?: string, cancelUrl?: string) {
        const paddle = this.requirePaddle();
        const pack = TOPUP_PACKS[packId];
        if (!pack) {
            throw new BadRequestException(`Unknown topup pack: ${packId}`);
        }
        const priceId = this.configService.get<string>(pack.priceIdEnv);
        if (!priceId) {
            throw new BadRequestException(`${pack.priceIdEnv} not configured`);
        }

        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const sub = await this.getOrCreate(userId);
        let customerId = sub.paddleCustomerId;
        if (!customerId) {
            const customer = await paddle.customers.create({
                email: user.email!,
                name: user.fullName || undefined,
                customData: { userId: user.id },
            });
            customerId = customer.id;
            sub.paddleCustomerId = customerId;
            await this.subscriptionsRepository.save(sub);
        }

        const transaction = await paddle.transactions.create({
            items: [{ priceId, quantity: 1 }],
            customerId,
            customData: { userId: user.id, kind: 'topup', packId, minutes: String(pack.minutes) },
        });

        return { url: transaction.checkout?.url };
    }

    async createPortalSession(userId: string) {
        const paddle = this.requirePaddle();
        const sub = await this.findByUserId(userId);
        if (!sub?.paddleCustomerId) {
            throw new BadRequestException('No active billing customer for this user');
        }
        const subscriptionIds = sub.paddleSubscriptionId ? [sub.paddleSubscriptionId] : [];
        const session = await paddle.customerPortalSessions.create(
            sub.paddleCustomerId,
            subscriptionIds,
        );
        return { url: session.urls.general.overview };
    }

    async handleWebhook(rawBody: string, signature: string): Promise<void> {
        const paddle = this.requirePaddle();
        if (!this.webhookSecret) {
            throw new BadRequestException('PADDLE_WEBHOOK_SECRET not configured');
        }

        let event: any;
        try {
            event = await paddle.webhooks.unmarshal(rawBody, this.webhookSecret, signature);
        } catch (err: any) {
            this.logger.error(`Paddle signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook signature failed: ${err.message}`);
        }

        this.logger.log(`Paddle event: ${event.eventType}`);

        switch (event.eventType) {
            case EventName.TransactionCompleted:
                await this.onTransactionCompleted(event.data as TransactionNotification);
                break;
            case EventName.SubscriptionCreated:
            case EventName.SubscriptionUpdated:
            case EventName.SubscriptionActivated:
            case EventName.SubscriptionTrialing:
                await this.onSubscriptionUpdated(event.data as SubscriptionCreatedNotification);
                break;
            case EventName.SubscriptionCanceled:
                await this.onSubscriptionCanceled(event.data as SubscriptionCreatedNotification);
                break;
            default:
                this.logger.debug(`Unhandled Paddle event: ${event.eventType}`);
        }
    }

    private async onTransactionCompleted(data: TransactionNotification): Promise<void> {
        const customData = data.customData as Record<string, string> | null;
        const userId = customData?.userId;
        if (!userId) {
            this.logger.warn('transaction.completed without userId in customData');
            return;
        }

        const sub = await this.getOrCreate(userId);
        if (data.customerId) sub.paddleCustomerId = data.customerId;
        if (data.subscriptionId) sub.paddleSubscriptionId = data.subscriptionId;

        // Top-up: one-time payment, credit purchased minutes
        if (customData?.kind === 'topup') {
            const minutes = parseInt(customData.minutes ?? '0', 10);
            if (minutes > 0) {
                sub.aiMinutesPurchased += minutes;
                this.logger.log(`Credited ${minutes} top-up minutes to user ${userId}`);
            }
            await this.subscriptionsRepository.save(sub);
            return;
        }

        // Recurring charge: reset cycle usage and re-grant included minutes
        if (data.origin === 'subscription_recurring') {
            sub.aiMinutesUsedThisCycle = 0;
            sub.aiMinutesIncluded = PRO_INCLUDED_MINUTES;
            await this.subscriptionsRepository.save(sub);
            return;
        }

        await this.subscriptionsRepository.save(sub);
    }

    private async onSubscriptionUpdated(data: SubscriptionCreatedNotification): Promise<void> {
        const customData = data.customData as Record<string, string> | null;
        const userId = customData?.userId;
        if (!userId) {
            this.logger.warn(`Subscription event for ${data.id} without userId in customData`);
            return;
        }

        const sub = await this.getOrCreate(userId);
        sub.paddleCustomerId = data.customerId;
        sub.paddleSubscriptionId = data.id;
        sub.status = data.status;
        sub.plan = data.status === 'active' || data.status === 'trialing' ? 'pro' : 'free';

        if (data.currentBillingPeriod?.endsAt) {
            sub.currentPeriodEnd = new Date(data.currentBillingPeriod.endsAt);
        }

        // Trial end is on the first subscription item's trialDates
        const trialDates = data.items?.[0]?.trialDates;
        sub.trialEnd = trialDates?.endsAt ? new Date(trialDates.endsAt) : null;

        if (sub.plan === 'pro' && sub.aiMinutesIncluded === 0) {
            sub.aiMinutesIncluded = PRO_INCLUDED_MINUTES;
        }

        await this.subscriptionsRepository.save(sub);
    }

    private async onSubscriptionCanceled(data: SubscriptionCreatedNotification): Promise<void> {
        const customData = data.customData as Record<string, string> | null;
        const userId = customData?.userId;
        if (!userId) return;
        const sub = await this.findByUserId(userId);
        if (!sub) return;
        sub.plan = 'free';
        sub.status = 'canceled';
        await this.subscriptionsRepository.save(sub);
    }
}

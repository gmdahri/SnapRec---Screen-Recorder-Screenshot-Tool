import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Subscription, Plan } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';

const PRO_INCLUDED_MINUTES = 20 * 60;

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);
    private readonly stripe: Stripe | null;
    private readonly priceIdPro: string | undefined;
    private readonly webBaseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Subscription)
        private readonly subscriptionsRepository: Repository<Subscription>,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {
        const key = this.configService.get<string>('STRIPE_SECRET_KEY');
        this.stripe = key ? new Stripe(key, { apiVersion: '2024-12-18.acacia' as any }) : null;
        this.priceIdPro = this.configService.get<string>('STRIPE_PRICE_ID_PRO_MONTHLY');
        this.webBaseUrl =
            this.configService.get<string>('WEB_BASE_URL') || 'https://www.snaprecorder.org';
        if (!this.stripe) {
            this.logger.warn('STRIPE_SECRET_KEY not configured — billing endpoints disabled');
        }
    }

    private requireStripe(): Stripe {
        if (!this.stripe) {
            throw new BadRequestException('Billing is not configured on this server');
        }
        return this.stripe;
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
            };
        }
        return {
            plan: sub.plan,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEnd: sub.trialEnd,
            aiMinutesUsedThisCycle: sub.aiMinutesUsedThisCycle,
            aiMinutesIncluded: sub.aiMinutesIncluded,
        };
    }

    /** Hard cap: returns false if adding the recording's minutes would exceed quota. */
    async hasQuotaFor(userId: string, minutesNeeded: number): Promise<boolean> {
        const sub = await this.findByUserId(userId);
        if (!sub || sub.plan !== 'pro' || sub.status !== 'active') return false;
        return sub.aiMinutesUsedThisCycle + minutesNeeded <= sub.aiMinutesIncluded;
    }

    async recordUsage(userId: string, minutes: number): Promise<void> {
        const sub = await this.findByUserId(userId);
        if (!sub) return;
        sub.aiMinutesUsedThisCycle += Math.max(0, Math.ceil(minutes));
        await this.subscriptionsRepository.save(sub);
    }

    async createCheckoutSession(userId: string, successUrl?: string, cancelUrl?: string) {
        const stripe = this.requireStripe();
        if (!this.priceIdPro) {
            throw new BadRequestException('STRIPE_PRICE_ID_PRO_MONTHLY not configured');
        }

        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const sub = await this.getOrCreate(userId);

        // Reuse existing customer if we have one
        let customerId = sub.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email || undefined,
                name: user.fullName || undefined,
                metadata: { userId: user.id },
            });
            customerId = customer.id;
            sub.stripeCustomerId = customerId;
            await this.subscriptionsRepository.save(sub);
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: this.priceIdPro, quantity: 1 }],
            success_url: successUrl || `${this.webBaseUrl}/settings/billing?checkout=success`,
            cancel_url: cancelUrl || `${this.webBaseUrl}/pricing?checkout=cancelled`,
            metadata: { userId: user.id },
            subscription_data: {
                metadata: { userId: user.id },
                trial_period_days: 7,
            },
            payment_method_collection: 'always',
        });

        return { url: session.url };
    }

    async createPortalSession(userId: string, returnUrl?: string) {
        const stripe = this.requireStripe();
        const sub = await this.findByUserId(userId);
        if (!sub?.stripeCustomerId) {
            throw new BadRequestException('No active billing customer for this user');
        }
        const portal = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: returnUrl || `${this.webBaseUrl}/settings/billing`,
        });
        return { url: portal.url };
    }

    async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
        const stripe = this.requireStripe();
        const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
        if (!secret) {
            throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
        }

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, secret);
        } catch (err: any) {
            this.logger.error(`Stripe signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook signature failed: ${err.message}`);
        }

        this.logger.log(`Stripe event: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed':
                await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.paid':
                await this.onInvoicePaid(event.data.object as Stripe.Invoice);
                break;
            case 'customer.subscription.trial_will_end':
                this.logger.log(`Trial ending soon for subscription ${(event.data.object as Stripe.Subscription).id}`);
                break;
            default:
                this.logger.debug(`Unhandled event type: ${event.type}`);
        }
    }

    private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
        const userId = session.metadata?.userId;
        if (!userId) {
            this.logger.warn('checkout.session.completed without userId metadata');
            return;
        }
        const sub = await this.getOrCreate(userId);
        if (typeof session.customer === 'string') sub.stripeCustomerId = session.customer;
        if (typeof session.subscription === 'string') sub.stripeSubscriptionId = session.subscription;
        await this.subscriptionsRepository.save(sub);
    }

    private async onSubscriptionUpdated(s: Stripe.Subscription): Promise<void> {
        const userId = s.metadata?.userId;
        if (!userId) {
            this.logger.warn(`subscription event for ${s.id} without userId metadata`);
            return;
        }
        const sub = await this.getOrCreate(userId);
        sub.stripeSubscriptionId = s.id;
        if (typeof s.customer === 'string') sub.stripeCustomerId = s.customer;
        sub.status = s.status;
        sub.plan = s.status === 'active' || s.status === 'trialing' ? 'pro' : 'free';
        if (s.current_period_end) {
            sub.currentPeriodEnd = new Date(s.current_period_end * 1000);
        }
        sub.trialEnd = s.trial_end ? new Date(s.trial_end * 1000) : null;
        if (sub.plan === 'pro' && sub.aiMinutesIncluded === 0) {
            sub.aiMinutesIncluded = PRO_INCLUDED_MINUTES;
        }
        await this.subscriptionsRepository.save(sub);
    }

    private async onSubscriptionDeleted(s: Stripe.Subscription): Promise<void> {
        const userId = s.metadata?.userId;
        if (!userId) return;
        const sub = await this.findByUserId(userId);
        if (!sub) return;
        sub.plan = 'free';
        sub.status = 'canceled';
        await this.subscriptionsRepository.save(sub);
    }

    private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (!subId) return;
        const sub = await this.subscriptionsRepository.findOne({
            where: { stripeSubscriptionId: subId },
        });
        if (!sub) return;
        // Reset cycle usage and re-grant included minutes
        sub.aiMinutesUsedThisCycle = 0;
        sub.aiMinutesIncluded = PRO_INCLUDED_MINUTES;
        await this.subscriptionsRepository.save(sub);
    }
}

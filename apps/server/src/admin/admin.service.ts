import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

// Variable cost estimates per minute of audio processed (USD).
// Whisper $0.006/min; Claude Haiku ~$0.0002/min after caching.
const COST_WHISPER_PER_MIN = 0.006;
const COST_CLAUDE_PER_MIN = 0.0002;
const COST_PER_MIN = COST_WHISPER_PER_MIN + COST_CLAUDE_PER_MIN;
const PRO_PRICE_USD = 19;

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        @InjectRepository(Subscription)
        private readonly subscriptionsRepository: Repository<Subscription>,
    ) {}

    async getStats() {
        const totalUsers = await this.usersRepository.count();
        const totalRecordings = await this.recordingsRepository.count();

        const subs = await this.subscriptionsRepository.find();
        const proSubs = subs.filter(
            (s) => s.plan === 'pro' && (s.status === 'active' || s.status === 'trialing'),
        );
        const trialing = subs.filter((s) => s.status === 'trialing');

        const totalMinutesProcessed = subs.reduce(
            (acc, s) => acc + (s.aiMinutesUsedThisCycle || 0),
            0,
        );

        const totalPurchasedMinutes = subs.reduce(
            (acc, s) => acc + (s.aiMinutesPurchased || 0),
            0,
        );

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const newUsers7d = await this.usersRepository.count({
            where: { createdAt: MoreThanOrEqual(sevenDaysAgo) },
        });
        const newRecordings7d = await this.recordingsRepository.count({
            where: { createdAt: MoreThanOrEqual(sevenDaysAgo) },
        });

        return {
            users: { total: totalUsers, newLast7Days: newUsers7d },
            recordings: { total: totalRecordings, newLast7Days: newRecordings7d },
            pro: {
                active: proSubs.length - trialing.length,
                trialing: trialing.length,
                total: proSubs.length,
            },
            usage: {
                totalMinutesProcessedThisCycle: totalMinutesProcessed,
                totalMinutesPurchasedLifetime: totalPurchasedMinutes,
                estimatedVariableCostThisCycleUsd: +(
                    totalMinutesProcessed * COST_PER_MIN
                ).toFixed(2),
                estimatedMrrUsd: (proSubs.length - trialing.length) * PRO_PRICE_USD,
            },
        };
    }

    async listUsers(limit = 50, offset = 0) {
        const users = await this.usersRepository.find({
            order: { createdAt: 'DESC' },
            take: Math.min(limit, 200),
            skip: offset,
        });

        if (users.length === 0) {
            return { users: [], total: await this.usersRepository.count() };
        }

        const userIds = users.map((u) => u.id);
        const subs = await this.subscriptionsRepository.find({ where: { userId: In(userIds) } });
        const subsByUser = new Map(subs.map((s) => [s.userId, s]));

        const rows = users.map((u) => {
            const sub = subsByUser.get(u.id);
            const minutesUsed = sub?.aiMinutesUsedThisCycle ?? 0;
            return {
                id: u.id,
                supabaseId: u.supabaseId,
                email: u.email,
                fullName: u.fullName,
                isAdmin: u.isAdmin,
                createdAt: u.createdAt,
                plan: sub?.plan ?? 'free',
                status: sub?.status ?? 'inactive',
                aiMinutesUsedThisCycle: minutesUsed,
                aiMinutesIncluded: sub?.aiMinutesIncluded ?? 0,
                aiMinutesPurchased: sub?.aiMinutesPurchased ?? 0,
                trialEnd: sub?.trialEnd,
                estimatedCostUsd: +(minutesUsed * COST_PER_MIN).toFixed(2),
            };
        });

        return { users: rows, total: await this.usersRepository.count() };
    }
}

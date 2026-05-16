import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type Plan = 'free' | 'pro';

@Entity('sr_subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'uuid' })
    userId: string;

    @Index()
    @Column({ type: 'varchar', nullable: true })
    stripeCustomerId: string | null;

    @Index()
    @Column({ type: 'varchar', nullable: true })
    stripeSubscriptionId: string | null;

    @Column({ type: 'enum', enum: ['free', 'pro'], default: 'free' })
    plan: Plan;

    @Column({ type: 'varchar', default: 'inactive' })
    status: string;

    @Column({ type: 'timestamptz', nullable: true })
    currentPeriodEnd: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    trialEnd: Date | null;

    @Column({ type: 'int', default: 0 })
    aiMinutesUsedThisCycle: number;

    @Column({ type: 'int', default: 0 })
    aiMinutesIncluded: number;

    @Column({ type: 'int', default: 0 })
    aiMinutesPurchased: number;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

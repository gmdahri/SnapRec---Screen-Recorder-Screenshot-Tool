import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Reaction } from './reaction.entity';
import { Comment } from './comment.entity';
import { Transcript } from '../../transcription/entities/transcript.entity';
import { Summary } from '../../ai/entities/summary.entity';

export type TranscriptStatus =
    | 'none'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'failed'
    | 'skipped_silent'
    | 'skipped_plan'
    | 'skipped_quota';

export type SummaryStatus =
    | 'none'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'failed'
    | 'skipped_short';

@Entity('sr_recordings')
export class Recording {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column()
    fileUrl: string;

    @Column({ nullable: true })
    thumbnailUrl: string;

    @Column({ type: 'enum', enum: ['video', 'screenshot'] })
    type: 'video' | 'screenshot';

    @Column({ default: 0 })
    views: number;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    location: string;

    @Column({ type: 'int', nullable: true })
    durationSec: number | null;

    @Column({ type: 'varchar', default: 'none' })
    transcriptStatus: TranscriptStatus;

    @Column({ type: 'varchar', default: 'none' })
    summaryStatus: SummaryStatus;

    @Column({ type: 'varchar', nullable: true })
    transcriptFailReason: string | null;

    @Column({ type: 'boolean', default: false })
    transcriptPublic: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @Index()
    @ManyToOne(() => User, (user) => user.recordings)
    user: User;

    @OneToMany(() => Reaction, (reaction) => reaction.recording)
    reactions: Reaction[];

    @OneToMany(() => Comment, (comment) => comment.recording)
    comments: Comment[];

    @OneToOne(() => Transcript, (t) => t.recording)
    transcript?: Transcript;

    @OneToOne(() => Summary, (s) => s.recording)
    summary?: Summary;
}

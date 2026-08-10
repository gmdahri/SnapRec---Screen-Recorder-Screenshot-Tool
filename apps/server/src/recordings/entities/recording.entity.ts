import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Reaction } from './reaction.entity';
import { Comment } from './comment.entity';

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

    /* NOTE: sr_recordings also has transcriptStatus, summaryStatus,
     * transcriptFailReason and transcriptPublic columns, and the sr_transcripts
     * and sr_summaries tables exist. None of them are mapped, read or written —
     * transcription was cut in August 2026. See docs/unused-schema.md before
     * assuming a pipeline exists behind them. */

    /** How long the recording runs, in whole seconds.
     *
     * The column has existed since an earlier migration but no entity mapped it
     * and nothing wrote it, so every client asked for a duration the API could
     * never return. Nullable because it is unknown for screenshots, for
     * recordings made before this was written, and for any file whose length
     * the uploader could not determine. */
    @Column({ type: 'int', nullable: true })
    durationSec: number | null;

    /** Frame size. Nullable: recordings made before anything measured this have
     * no honest value, and the viewer omits the line rather than guessing. */
    @Column({ type: 'int', nullable: true })
    widthPx: number | null;

    @Column({ type: 'int', nullable: true })
    heightPx: number | null;

    @Column({ default: 0 })
    views: number;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    location: string;

    /** Who made this while signed out. Lets a claim be scoped to recordings
     * this guest actually made, rather than to every recording nobody owns.
     * Null for anything uploaded signed-in, and for rows predating the column. */
    // `type` is explicit because the property is `string | null`, which
    // reflects as Object — TypeORM cannot infer a column type from a union and
    // fails to build metadata at all.
    @Index()
    @Column({ type: 'varchar', nullable: true })
    guestId: string | null;

    /** Defaults true: every recording uploaded before this column existed was
     * reachable by anyone holding the link, and backfilling false would
     * silently revoke every link already in circulation. */
    @Column({ type: 'boolean', default: true })
    isPublic: boolean;

    /** Set when the owner turns a link OFF. Distinct from never-public,
     * because the UI has to offer turning it back on. */
    @Column({ type: 'timestamptz', nullable: true })
    sharingDisabledAt: Date | null;

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
}

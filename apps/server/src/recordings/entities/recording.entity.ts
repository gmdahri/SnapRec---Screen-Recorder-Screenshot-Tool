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

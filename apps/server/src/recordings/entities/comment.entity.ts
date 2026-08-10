import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { Recording } from './recording.entity';
import { User } from '../../users/entities/user.entity';

@Entity('sr_comments')
export class Comment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text')
    content: string;

    @Column({ nullable: true })
    guestId: string;

    /** Video comments anchor to a moment. Null for image comments and for
     * comments about the capture as a whole — which is every existing row. */
    @Column({ type: 'int', nullable: true })
    timecodeMs: number | null;

    /** Image comments anchor to a place, NORMALISED 0–1 — not pixels. The same
     * screenshot renders at different widths on desktop, tablet and mobile,
     * and a pin has to land on the same feature at every size. */
    @Column({ type: 'double precision', nullable: true })
    anchorX: number | null;

    @Column({ type: 'double precision', nullable: true })
    anchorY: number | null;

    @Index()
    @ManyToOne(() => Recording, (recording) => recording.comments, { onDelete: 'CASCADE' })
    recording: Recording;

    @Index()
    @ManyToOne(() => User, { nullable: true })
    user: User;

    /** When the question was settled. A timestamp, not a flag: it also orders
     * activity and distinguishes a fresh reply from a stale resolve. */
    @Index()
    @Column({ type: 'timestamptz', nullable: true })
    resolvedAt: Date | null;

    /** Who settled it. Nullable — if the account is deleted the comment stays
     * resolved and only the attribution is lost. */
    @Column({ type: 'uuid', nullable: true })
    resolvedByUserId: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

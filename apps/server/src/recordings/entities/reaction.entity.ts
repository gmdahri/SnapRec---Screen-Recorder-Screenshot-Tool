import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Recording } from './recording.entity';
import { User } from '../../users/entities/user.entity';

@Entity('sr_reactions')
export class Reaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: ['like', 'love', 'celebrate', 'insightful', 'curious'], default: 'like' })
    type: string;

    @Column({ nullable: true })
    guestId: string;

    @ManyToOne(() => Recording, (recording) => recording.reactions, { onDelete: 'CASCADE' })
    recording: Recording;

    @ManyToOne(() => User, { nullable: true })
    user: User;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}

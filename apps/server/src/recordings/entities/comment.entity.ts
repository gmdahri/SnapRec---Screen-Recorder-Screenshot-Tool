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

    @Index()
    @ManyToOne(() => Recording, (recording) => recording.comments, { onDelete: 'CASCADE' })
    recording: Recording;

    @Index()
    @ManyToOne(() => User, { nullable: true })
    user: User;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

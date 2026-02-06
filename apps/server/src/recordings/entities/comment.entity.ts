import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
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

    @ManyToOne(() => Recording, (recording) => recording.comments, { onDelete: 'CASCADE' })
    recording: Recording;

    @ManyToOne(() => User, { nullable: true })
    user: User;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

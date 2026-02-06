import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
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

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @ManyToOne(() => User, (user) => user.recordings)
    user: User;

    @OneToMany(() => Reaction, (reaction) => reaction.recording)
    reactions: Reaction[];

    @OneToMany(() => Comment, (comment) => comment.recording)
    comments: Comment[];
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

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

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @ManyToOne(() => User, (user) => user.recordings)
    user: User;
}

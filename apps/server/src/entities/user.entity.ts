import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Recording } from './recording.entity';

@Entity('sr_users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, nullable: true })
    supabaseId: string;

    @Column({ unique: true, nullable: true })
    email: string;

    @Column({ nullable: true })
    fullName: string;

    @Column({ nullable: true })
    avatarUrl: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Recording, (recording: Recording) => recording.user)
    recordings: Recording[];
}

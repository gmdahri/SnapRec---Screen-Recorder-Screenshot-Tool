import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { Recording } from '../../recordings/entities/recording.entity';

export interface ActionItem {
    owner?: string | null;
    text: string;
    dueDate?: string | null;
}

export interface Chapter {
    startSec: number;
    title: string;
}

@Entity('sr_summaries')
export class Summary {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => Recording, (r) => r.summary, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'recordingId' })
    recording: Recording;

    @Column({ type: 'uuid' })
    recordingId: string;

    @Column({ type: 'text', default: '' })
    tldr: string;

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    bulletsJson: string[];

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    actionItemsJson: ActionItem[];

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    chaptersJson: Chapter[];

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    keyDecisionsJson: string[];

    @Column({ type: 'varchar' })
    model: string;

    @Column({ type: 'varchar', default: 'v1' })
    promptVersion: string;

    @CreateDateColumn({ type: 'timestamptz' })
    generatedAt: Date;
}

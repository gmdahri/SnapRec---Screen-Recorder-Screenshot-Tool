import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { Recording } from '../../recordings/entities/recording.entity';

export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
    confidence?: number;
    speaker?: number;
}

@Entity('sr_transcripts')
export class Transcript {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => Recording, (r) => r.transcript, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'recordingId' })
    recording: Recording;

    @Column({ type: 'uuid' })
    recordingId: string;

    @Column({ type: 'varchar', nullable: true })
    language: string | null;

    @Column({ type: 'int', nullable: true })
    durationSec: number | null;

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    segmentsJson: TranscriptSegment[];

    @Column({ type: 'jsonb', nullable: true })
    rawProviderResponse: unknown;

    @Column({ type: 'varchar' })
    model: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, Unique, UpdateDateColumn,
} from 'typeorm';
import { Recording } from './recording.entity';
import { User } from '../../users/entities/user.entity';

/** One viewer's progress through one recording (P7 V4).
 *
 * PRIVACY (plan O2): signed-in viewers only. There is no guestId here and there
 * must not be one — anonymous viewers are counted in `Recording.views` and get
 * no individual record. Adding a guest column would turn this into behavioural
 * tracking of people who never signed up, which is a different decision than
 * the one that was made.
 *
 * Coverage, not a high-water mark (plan O1): `watchedRanges` holds merged
 * second pairs, so someone who drags to the end reads as barely having watched
 * it. `coveredSec` is the same information denormalised, so the aggregate does
 * not have to parse every viewer's ranges. */
@Entity('sr_recording_views')
@Unique('UQ_sr_recording_views_recording_user', ['recording', 'user'])
export class RecordingView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Recording, { onDelete: 'CASCADE', nullable: false })
  recording: Recording;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user: User;

  /** Merged [startSec, endSec] pairs. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  watchedRangesJson: Array<{ startSec: number; endSec: number }>;

  @Column({ type: 'int', default: 0 })
  coveredSec: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastSeenAt: Date;
}

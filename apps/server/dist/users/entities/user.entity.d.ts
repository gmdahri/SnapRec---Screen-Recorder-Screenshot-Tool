import { Recording } from '../../recordings/entities/recording.entity';
export declare class User {
    id: string;
    supabaseId: string;
    email: string;
    fullName: string;
    avatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
    recordings: Recording[];
}

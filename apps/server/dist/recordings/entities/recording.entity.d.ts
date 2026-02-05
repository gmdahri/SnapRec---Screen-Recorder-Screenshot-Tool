import { User } from '../../users/entities/user.entity';
export declare class Recording {
    id: string;
    title: string;
    fileUrl: string;
    thumbnailUrl: string;
    type: 'video' | 'screenshot';
    createdAt: Date;
    updatedAt: Date;
    user: User;
}

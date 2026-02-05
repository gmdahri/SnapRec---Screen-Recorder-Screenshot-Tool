// Shared Recording type
export interface Recording {
    id: string;
    title: string;
    fileUrl: string;
    type: 'video' | 'screenshot';
    createdAt: string;
    duration?: number;
}

// User metadata from Supabase
export interface UserMetadata {
    avatar_url?: string;
    full_name?: string;
    email?: string;
}

export interface JwtPayload {
    sub: string; // Supabase user ID
    email: string;
    aud: string;
    role: string;
    iat: number;
    exp: number;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
        name?: string;
        picture?: string;
    };
}

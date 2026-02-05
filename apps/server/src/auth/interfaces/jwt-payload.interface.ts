export interface JwtPayload {
    sub: string; // Supabase user ID
    email: string;
    aud: string;
    role: string;
    iat: number;
    exp: number;
}

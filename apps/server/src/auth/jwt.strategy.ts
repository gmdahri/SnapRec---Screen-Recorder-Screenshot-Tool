import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { JwtPayload } from './interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(configService: ConfigService) {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        if (!supabaseUrl) {
            throw new Error('SUPABASE_URL is not configured');
        }

        const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: passportJwtSecret({
                cache: true,
                rateLimit: true,
                jwksRequestsPerMinute: 5,
                jwksUri: jwksUri,
            }),
            algorithms: ['ES256'],
        });
    }

    async validate(payload: JwtPayload) {
        if (!payload.sub) {
            throw new UnauthorizedException('Invalid token');
        }

        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}

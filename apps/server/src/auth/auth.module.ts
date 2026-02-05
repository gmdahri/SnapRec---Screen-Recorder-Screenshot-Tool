import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('SUPABASE_JWT_SECRET'),
                signOptions: { expiresIn: '1h' },
            }),
        }),
    ],
    providers: [JwtStrategy, JwtAuthGuard],
    exports: [JwtStrategy, JwtAuthGuard, PassportModule],
})
export class AuthModule { }

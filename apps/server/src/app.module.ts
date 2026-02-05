import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './entities/user.entity';
import { Recording } from './entities/recording.entity';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    StorageModule,
    AuthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, Recording],
        synchronize: true, // WARNING: Set to false in production
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
      }),
    }),
    TypeOrmModule.forFeature([User, Recording]),
  ],
  controllers: [AppController, RecordingsController],
  providers: [AppService, RecordingsService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private dataSource: DataSource) { }

  onModuleInit() {
    if (this.dataSource.isInitialized) {
      this.logger.log('Successfully connected to Supabase Database');
    } else {
      this.logger.error('Failed to connect to Supabase Database');
    }
  }
}

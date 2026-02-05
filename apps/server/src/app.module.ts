import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
<<<<<<< HEAD
import { User } from './users/entities/user.entity';
import { Recording } from './recordings/entities/recording.entity';
import { Reaction } from './recordings/entities/reaction.entity';
import { Comment } from './recordings/entities/comment.entity';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecordingsModule } from './recordings/recordings.module';
=======
import { User } from './entities/user.entity';
import { Recording } from './entities/recording.entity';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
<<<<<<< HEAD
=======
    StorageModule,
    AuthModule,
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
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
<<<<<<< HEAD
        entities: [User, Recording, Reaction, Comment],
        synchronize: false, // WARNING: Set to false in production
=======
        entities: [User, Recording],
        synchronize: true, // WARNING: Set to false in production
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
      }),
    }),
<<<<<<< HEAD
    StorageModule,
    AuthModule,
    UsersModule,
    RecordingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
=======
    TypeOrmModule.forFeature([User, Recording]),
  ],
  controllers: [AppController, RecordingsController],
  providers: [AppService, RecordingsService],
>>>>>>> 739ce20 (feat(editor): implement cropping, privacy tools polish, and persistent loading fixes)
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

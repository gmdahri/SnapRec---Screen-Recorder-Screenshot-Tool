import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Recording } from './recordings/entities/recording.entity';

export interface PublicStats {
  users: number;
  recordings: number;
  screenshots: number;
  videos: number;
}

@Injectable()
export class AppService {
  private cachedStats: PublicStats | null = null;
  private lastFetchedAt = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Recording)
    private readonly recordingsRepository: Repository<Recording>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getStats(): Promise<PublicStats> {
    const now = Date.now();
    if (this.cachedStats && now - this.lastFetchedAt < this.CACHE_TTL_MS) {
      return this.cachedStats;
    }

    const chromeStoreUsers = this.configService.get<number>('CHROME_STORE_USERS', 123);

    const [dbUsers, recordings, screenshots, videos] = await Promise.all([
      this.usersRepository.count(),
      this.recordingsRepository.count(),
      this.recordingsRepository.count({ where: { type: 'screenshot' } }),
      this.recordingsRepository.count({ where: { type: 'video' } }),
    ]);

    // Show the higher of Chrome Web Store installs vs signed-in DB users
    const users = Math.max(dbUsers, chromeStoreUsers);

    this.cachedStats = { users, recordings, screenshots, videos };
    this.lastFetchedAt = now;
    return this.cachedStats;
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';
import { Recording } from './recordings/entities/recording.entity';

/** The root route and the public stats the landing page shows.
 *
 * AppService reads two repositories and the config, so they are provided
 * here; the scaffold version of this test provided none and could not build
 * the module at all. */

describe('AppController', () => {
  let appController: AppController;
  let users: { count: jest.Mock };
  let recordings: { count: jest.Mock };
  let chromeStoreUsers: number;

  beforeEach(async () => {
    chromeStoreUsers = 5000;
    users = { count: jest.fn().mockResolvedValue(1200) };
    recordings = {
      count: jest.fn(async (opts?: { where?: { type?: string } }) =>
        opts?.where?.type === 'screenshot' ? 30 : opts?.where?.type === 'video' ? 70 : 100),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: ConfigService, useValue: { get: (_key: string, fallback: number) => chromeStoreUsers ?? fallback } },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Recording), useValue: recordings },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('answers the root route', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });

  describe('stats', () => {
    it('counts recordings by kind', async () => {
      expect(await appController.getStats()).toEqual({
        users: 5000, recordings: 100, screenshots: 30, videos: 70,
      });
    });

    it('shows the higher of Chrome Web Store installs and signed-in users', async () => {
      chromeStoreUsers = 900;
      expect((await appController.getStats()).users).toBe(1200);
    });

    it('is served from a five-minute cache rather than counted on every request', async () => {
      await appController.getStats();
      await appController.getStats();
      expect(users.count).toHaveBeenCalledTimes(1);
    });
  });
});

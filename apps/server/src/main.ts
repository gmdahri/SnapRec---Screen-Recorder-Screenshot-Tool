import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
// @ts-ignore
import * as pg from 'pg';

// Configure pg to parse timestamp (without time zone) as UTC
// OID 1114 is the OID for 'timestamp' in Postgres
(pg as any).types.setTypeParser(1114, (value: string) => {
  return value ? new Date(value + 'Z') : null;
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
    }),
  );

  const configService = app.get(ConfigService);
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');

  const origins = allowedOrigins
    ? allowedOrigins.split(',').map((o) => o.trim())
    : ['https://www.snaprecorder.org', 'https://snaprecorder.org', 'http://localhost:5173'];

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  const port = configService.get<number>('PORT', 3001);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

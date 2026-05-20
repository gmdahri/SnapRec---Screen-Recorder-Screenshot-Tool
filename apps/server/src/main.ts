import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bodyParser from 'body-parser';
import { Request } from 'express';
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

  // Paddle webhook needs the raw body as a string to verify signatures.
  // Mount the text parser only on that route; everything else gets the default JSON parser.
  app.use(
    '/subscriptions/webhook',
    bodyParser.text({
      type: 'application/json',
      verify: (req: Request, _res, buf) => {
        (req as any).rawBody = buf.toString('utf8');
      },
    }),
  );

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
    ? allowedOrigins.split(',').map((o) => o.trim().replace(/\/$/, ''))
    : [
          'https://www.snaprecorder.org',
          'https://snaprecorder.org',
          'http://localhost:5173',
          'https://3c74-2407-aa80-116-f827-6d93-ca66-b3c5-94e.ngrok-free.app',
          /\.ngrok-free\.app$/,
      ];

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'ngrok-skip-browser-warning'],
  });
  const port = configService.get<number>('PORT', 3001);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

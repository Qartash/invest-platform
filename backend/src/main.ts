import './logs/console-log-bridge'; // must patch console before anything else logs

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render terminates TLS at its own proxy and forwards the request on, so every
  // connection Express sees arrives from the same internal address. Left alone, the
  // rate limiter on /auth would count the entire internet into one bucket: one script
  // hammering the login would lock out every other visitor with it. Trusting a single
  // hop makes req.ip the address from X-Forwarded-For, which is what the limiter reads.
  // One hop and no more — a caller can put whatever it likes in that header, so trusting
  // the whole chain would let it invent a fresh address per request and never be counted.
  app.set('trust proxy', 1);
  app.enableCors();
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

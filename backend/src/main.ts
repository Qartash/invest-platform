import './logs/console-log-bridge'; // must patch console before anything else logs

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

/**
 * Origins allowed to call the API from a browser, from WEB_ORIGINS as a comma-separated
 * list. Left unset, any origin is answered — which is where this started and what the
 * deployed web build still relies on, so it stays the fallback rather than a hard failure.
 *
 * The exposure is small either way: the token travels in an Authorization header the browser
 * only attaches when our own code asks it to, there are no cookies, and CORS never stopped a
 * request that was not made by a browser. Setting the list closes the case where somebody
 * else's page drives the API with a token it already has.
 */
function corsOrigins(): string[] | boolean {
  const configured = process.env.WEB_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  new Logger('Bootstrap').warn('WEB_ORIGINS is not set — answering CORS for any origin');
  return true;
}

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

  // Says which Express version is answering, to anybody who asks. Free reconnaissance.
  app.disable('x-powered-by');

  app.use((_req: Request, res: Response, next: NextFunction) => {
    // The API answers JSON, and a browser that decides otherwise is a browser running
    // something. None of these need a package: they are three headers with one meaning
    // each — do not guess the type, do not frame this, do not leak the URL onward.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.enableCors({ origin: corsOrigins() });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
    // Uploads are user files served off the API's own origin. Even with SVG refused at the
    // door (see upload-storage.ts), these say plainly what a browser may do with them:
    // trust the declared type and nothing else, run nothing, load nothing, and stay
    // readable from the web build, which is a different origin.
    setHeaders: (res: Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
    // No directory listings and no serving of anything beginning with a dot.
    index: false,
    dotfiles: 'deny',
  });

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

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// The controller with a stand-in service and nothing else — no database, no bcrypt. The
// limits are the subject here, and a real AuthService would only make the test slow and
// tie it to whether the credentials happen to be valid, which the limiter does not care
// about: a wrong password is counted the same as a right one, and has to be, or guessing
// would be free.
async function bootAuthApp(): Promise<INestApplication> {
  const authService = {
    register: jest.fn().mockResolvedValue({ accessToken: 'token' }),
    login: jest.fn().mockResolvedValue({ accessToken: 'token' }),
    loginWithGoogle: jest.fn().mockResolvedValue({ accessToken: 'token' }),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60 * 1000, limit: 60 }])],
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: authService }],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('auth rate limits', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await bootAuthApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // Ten attempts a minute: enough for someone who mistyped a password twice and then
  // remembered it, useless for a dictionary.
  it('lets ten sign-in attempts through and refuses the eleventh', async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'someone', password: 'whatever' })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'someone', password: 'whatever' })
      .expect(429);
  });

  // Registering is a once-in-a-lifetime act for a person and a cheap way to fill the
  // users table for a script, so this ceiling is the low one.
  it('allows five registrations before refusing', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `a${attempt}@example.com`, password: 'password123' })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a6@example.com', password: 'password123' })
      .expect(429);
  });

  // Each route counts on its own. Without this, a browser tab retrying a Google sign-in
  // could spend the allowance the person needs to type their password with.
  it('counts each route separately', async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'someone', password: 'whatever' })
        .expect(201);
    }

    await request(app.getHttpServer()).post('/auth/google').send({ idToken: 'token' }).expect(201);
  });
});

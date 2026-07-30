import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleVerifier } from './google-verifier';
import { UsersModule } from '../users/users.module';
import { WalletsModule } from '../wallets/wallets.module';
import { InviteEligibilityModule } from '../referrals/invite-eligibility.module';

@Module({
  imports: [
    UsersModule,
    WalletsModule,
    InviteEligibilityModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleVerifier],
  // AuthService is exported for the demo seeder, which creates its accounts through
  // registration rather than by inserting rows — a hand-built row misses the wallet,
  // the referral code and the password hashing that registering does for you.
  exports: [JwtModule, AuthService],
})
export class AuthModule {}

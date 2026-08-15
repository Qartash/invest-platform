import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  fullName?: string;
}

@Injectable()
export class GoogleVerifier {
  private readonly logger = new Logger(GoogleVerifier.name);
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  // Every platform gets its own OAuth client, and the id_token's `aud` carries
  // whichever one issued it — so all of them are accepted as an audience.
  private get audience(): string[] {
    return ['GOOGLE_WEB_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID']
      .map((key) => this.configService.get<string>(key))
      .filter((id): id is string => Boolean(id));
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    const audience = this.audience;
    if (audience.length === 0) {
      // Without an audience list `verifyIdToken` would accept a token minted for
      // any other Google app, so refuse outright instead of degrading silently.
      this.logger.error('No GOOGLE_*_CLIENT_ID configured — refusing Google sign-in');
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.warn(`Rejected Google id_token: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }
    // An unverified address could belong to someone else, and we key accounts on
    // email — accepting it would hand over the matching local account.
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account has no verified email');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      fullName: payload.name,
    };
  }
}

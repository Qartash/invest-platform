import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';

/**
 * These three are the only routes an anonymous caller can reach that make the server do
 * expensive work: signing in and registering each run a bcrypt round, which costs real
 * milliseconds of the single shared CPU this instance is given. Unlimited, that is two
 * problems wearing one coat — a password-guessing oracle that answers as fast as it can,
 * and the cheapest way to take the whole API down, since a few hundred parallel logins
 * leave nothing to serve everybody else with.
 *
 * Counted per IP, so the ceilings are set where a household or an office behind one
 * address never notices them and a script does immediately. The counters live in memory:
 * one instance runs, and a restart forgetting them is a fair trade for not putting a
 * Redis in front of a free plan.
 *
 * The guard sits on this controller alone. Everything else needs a token, and a global
 * ceiling picked without first measuring what the app asks for on a normal screen would
 * be as likely to lock out real users as to stop anyone.
 */
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Registration is invite-only and something a person does once, so the hourly ceiling
  // is low on purpose: it is the route that mints rows in three tables and hashes a
  // password, and nobody legitimate needs a sixth account within the hour.
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Ten a minute leaves room for a forgotten password and a few honest retries while
  // making a dictionary run useless — at this rate a four-word list takes a day.
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Nothing to guess here — the caller either holds a token Google signed or it does not,
  // and the cost is an outbound call rather than a hash. The limit is only there so a
  // loop cannot spend our request budget at Google's endpoint.
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken, dto.referralCode);
  }
}

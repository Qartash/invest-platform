import { IsString, MinLength } from 'class-validator';

export class WipeDataDto {
  // The wipe password, checked against ADMIN_WIPE_PASSWORD. Not a user credential:
  // an admin token alone must not be enough to empty the platform, so this is a
  // second, separately-held secret that only the operator knows.
  @IsString()
  @MinLength(1)
  password: string;
}

import { IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken: string;

  // The invite code a first-time Google user arrived with. Ignored for someone who
  // already has an account — attribution only happens at account creation.
  @IsString()
  @IsOptional()
  referralCode?: string;
}

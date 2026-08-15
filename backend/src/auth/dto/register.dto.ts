import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // The sign-up form no longer asks for one — it's derived from the email when
  // absent. Kept accepted so scripts and seeds can pin a readable handle.
  @IsString()
  @IsOptional()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username can only contain letters, numbers and underscores' })
  username?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  languagePref?: string;

  // The code the new user arrived with, from a shared link or typed by hand.
  //
  // Still `@IsOptional()` on purpose, even though registration now requires one: the check
  // that a code exists lives in AuthService alongside the checks that it is real and that
  // its owner may invite, so all three failures come back as their own message. A
  // class-validator rejection here would collapse the first of the three into a generic
  // "referralCode must be a string" that the sign-up form cannot say anything useful about.
  @IsString()
  @IsOptional()
  referralCode?: string;
}

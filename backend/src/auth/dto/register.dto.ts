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
}

import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username can only contain letters, numbers and underscores' })
  username: string;

  @IsString()
  @MinLength(3)
  password: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  languagePref?: string;
}

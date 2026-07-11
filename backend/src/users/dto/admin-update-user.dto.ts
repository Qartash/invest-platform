import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { KycStatus, UserRole } from '../../common/enums';

export class AdminUpdateUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @MinLength(3)
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(KycStatus)
  @IsOptional()
  kycStatus?: KycStatus;
}

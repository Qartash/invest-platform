import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender } from '../../common/enums';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  telegram?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsBoolean()
  @IsOptional()
  shareContactsPublicly?: boolean;

  @IsString()
  @IsOptional()
  avatarEmoji?: string;
}

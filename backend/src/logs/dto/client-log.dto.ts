import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientLogDto {
  @IsString()
  @MaxLength(100)
  category: string;

  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsIn(['info', 'warn', 'error'])
  level?: 'info' | 'warn' | 'error';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

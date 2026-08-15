import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const MAX_UPDATE_TITLE_LENGTH = 120;
export const MAX_UPDATE_BODY_LENGTH = 2000;
export const MAX_UPDATE_PHOTOS = 6;

export class CreateUpdateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_UPDATE_TITLE_LENGTH)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(MAX_UPDATE_BODY_LENGTH)
  body: string;

  // URLs of images already uploaded through the attachments endpoint. The post
  // itself never takes file data — it references what is on disk.
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(MAX_UPDATE_PHOTOS)
  @IsString({ each: true })
  photos?: string[];

  // Off means the post lands in the feed without ringing anyone's bell. Useful
  // for a small correction; on by default, because a post nobody is told about
  // is a post nobody reads.
  @IsOptional()
  notifyHolders?: boolean;
}

export class EditUpdateDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(MAX_UPDATE_TITLE_LENGTH)
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10)
  @MaxLength(MAX_UPDATE_BODY_LENGTH)
  body?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(MAX_UPDATE_PHOTOS)
  @IsString({ each: true })
  photos?: string[];
}

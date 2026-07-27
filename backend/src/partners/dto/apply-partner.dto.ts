import { IsInt, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class ApplyPartnerDto {
  @IsString()
  @MaxLength(40)
  channelType: string;

  @IsUrl()
  @MaxLength(300)
  channelUrl: string;

  @IsInt()
  @Min(0)
  audienceSize: number;

  @IsString()
  @MaxLength(400)
  topic: string;

  // Long enough to be an actual answer: a reviewer can't judge intent from a
  // sentence, and this is the field the decision turns on.
  @IsString()
  @MaxLength(2000)
  plan: string;
}

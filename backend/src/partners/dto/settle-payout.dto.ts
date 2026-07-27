import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

// Records that a partner's matured earnings were actually transferred. Nothing
// here moves money — it marks what a person already paid outside the platform.
export class SettlePayoutDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  earningIds: string[];
}

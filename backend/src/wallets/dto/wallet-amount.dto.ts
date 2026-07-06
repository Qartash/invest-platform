import { IsNumber, IsPositive } from 'class-validator';

export class WalletAmountDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

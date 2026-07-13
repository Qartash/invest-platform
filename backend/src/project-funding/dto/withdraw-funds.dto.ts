import { IsNumber, IsPositive } from 'class-validator';

export class WithdrawFundsDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}

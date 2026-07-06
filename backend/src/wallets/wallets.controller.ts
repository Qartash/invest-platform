import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletAmountDto } from './dto/wallet-amount.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionType } from '../common/enums';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  getWallet(@CurrentUser() user: User) {
    return this.walletsService.findByUserId(user.id);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: User) {
    return this.transactionsService.findByUser(user.id);
  }

  @Post('deposit')
  async deposit(@CurrentUser() user: User, @Body() dto: WalletAmountDto) {
    const wallet = await this.walletsService.deposit(user.id, dto.amount);
    await this.transactionsService.record({
      userId: user.id,
      type: TransactionType.DEPOSIT,
      amount: dto.amount,
    });
    return wallet;
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: User, @Body() dto: WalletAmountDto) {
    const wallet = await this.walletsService.withdraw(user.id, dto.amount);
    await this.transactionsService.record({
      userId: user.id,
      type: TransactionType.WITHDRAW,
      amount: dto.amount,
    });
    return wallet;
  }
}

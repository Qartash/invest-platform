import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WalletAmountDto } from './dto/wallet-amount.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionType } from '../common/enums';
import { User } from '../users/entities/user.entity';
import { ReferralEarningsService } from '../referrals/referral-earnings.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
    private readonly referralEarningsService: ReferralEarningsService,
  ) {}

  @Get()
  getWallet(@CurrentUser() user: User) {
    return this.walletsService.findByUserId(user.id);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: User, @Query() query: QueryTransactionsDto) {
    return this.transactionsService.findByUser(user.id, query.page ?? 1, query.pageSize ?? 10);
  }

  @Post('deposit')
  async deposit(@CurrentUser() user: User, @Body() dto: WalletAmountDto) {
    const wallet = await this.walletsService.deposit(user.id, dto.amount);
    const tx = await this.transactionsService.record({
      userId: user.id,
      type: TransactionType.DEPOSIT,
      amount: dto.amount,
    });
    // A deposit qualifies the depositor's referral chain and, if it's their
    // first, pays the direct referrer 1%. The accrual is a held ledger entry, not
    // money moving now, so it stays out of the wallet lock above.
    await this.referralEarningsService.handleDeposit(user.id, dto.amount, tx.id);
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

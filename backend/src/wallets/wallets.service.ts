import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { lockWallet } from '../common/row-locks';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    private readonly dataSource: DataSource,
  ) {}

  createForUser(userId: string, currency = 'AMD'): Promise<Wallet> {
    const wallet = this.walletsRepository.create({ userId, balance: '0', currency });
    return this.walletsRepository.save(wallet);
  }

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  // Both of these hold the wallet row for the whole read-modify-write (see row-locks.ts):
  // concurrent calls used to read the same balance and overwrite each other, so ten parallel
  // deposits credited two and ten parallel withdrawals debited one — while answering success
  // to every one of them.
  deposit(userId: string, amount: number): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await lockWallet(manager, userId);
      wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
      return manager.save(wallet);
    });
  }

  withdraw(userId: string, amount: number): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await lockWallet(manager, userId);
      // Invest credit is deliberately not part of this sum — it is not withdrawable.
      const newBalance = parseFloat(wallet.balance) - amount;
      if (newBalance < 0) {
        throw new BadRequestException('Insufficient funds');
      }
      wallet.balance = newBalance.toFixed(2);
      return manager.save(wallet);
    });
  }
}

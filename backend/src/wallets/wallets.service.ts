import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
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

  async deposit(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.findByUserId(userId);
    wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
    return this.walletsRepository.save(wallet);
  }

  async withdraw(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.findByUserId(userId);
    const newBalance = parseFloat(wallet.balance) - amount;
    if (newBalance < 0) {
      throw new BadRequestException('Insufficient funds');
    }
    wallet.balance = newBalance.toFixed(2);
    return this.walletsRepository.save(wallet);
  }
}

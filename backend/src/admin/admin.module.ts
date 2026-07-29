import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { LogsModule } from '../logs/logs.module';
import { QuestsModule } from '../quests/quests.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wallet]), LogsModule, QuestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

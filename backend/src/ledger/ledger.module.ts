import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoneyMovement } from './entities/money-movement.entity';
import { PlatformAccount } from './entities/platform-account.entity';
import { LedgerService } from './ledger.service';
import { LedgerQueryService } from './ledger-query.service';
import { PlatformAccountService } from './platform-account.service';
import { LedgerController } from './ledger.controller';

/**
 * Imported by every module that moves money. It deliberately depends on nothing
 * of theirs — the ledger records movements, it does not know what a project or a
 * work is beyond an id — so wiring it in everywhere creates no import cycles.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MoneyMovement, PlatformAccount])],
  providers: [LedgerService, LedgerQueryService, PlatformAccountService],
  controllers: [LedgerController],
  exports: [LedgerService, PlatformAccountService],
})
export class LedgerModule {}

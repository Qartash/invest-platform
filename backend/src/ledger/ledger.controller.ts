import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerService, external, platform } from './ledger.service';
import { PlatformAccountService } from './platform-account.service';
import { FundPlatformDto } from './dto/fund-platform.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MovementKind, UserRole } from '../common/enums';

/**
 * Every movement of money on the platform, and the pool behind the rewards.
 *
 * Admin-only, like the rest of moderation: this is a by-name feed of what
 * everyone did with their money, which is nobody else's business.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly query: LedgerQueryService,
    private readonly ledger: LedgerService,
    private readonly platformAccount: PlatformAccountService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('summary')
  getSummary() {
    return this.query.summary();
  }

  @Get('by-kind')
  getByKind() {
    return this.query.byKind();
  }

  @Get('movements')
  getMovements(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('kind') kind?: MovementKind,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.query.feed({ page, kind, projectId, userId });
  }

  /**
   * Puts money into the platform pool.
   *
   * Recorded as coming from EXTERNAL, which is the truthful description while
   * there is no payment provider: this is an admin declaring that money entered
   * the platform from outside. Naming that source is the whole point — the pool
   * used to fill up through an ordinary wallet deposit, so the marketing budget
   * appeared out of nowhere with nothing to distinguish it from an investor's
   * own money.
   */
  @Post('fund')
  async fund(@CurrentUser() admin: User, @Body() dto: FundPlatformDto) {
    const balance = await this.dataSource.transaction(async (manager) => {
      const updated = await this.platformAccount.credit(manager, dto.amount);
      await this.ledger.record(manager, {
        kind: MovementKind.PLATFORM_FUNDING,
        amount: dto.amount,
        from: external(),
        to: platform(),
        description: dto.note?.trim() || `Funded by ${admin.fullName || admin.username || admin.email}`,
      });
      return updated;
    });
    return { balance };
  }
}

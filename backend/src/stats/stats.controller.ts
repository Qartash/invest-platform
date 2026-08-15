import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Platform-wide figures: turnover across every account, the registration feed, and a money
// history that names the user behind each deposit and withdrawal. These were admin-only for
// a while, on the reasoning that one investor has no business reading another's funding
// activity by name. Opening them to every signed-in account is a deliberate product call —
// the platform shows its own numbers to the people it asks for money. Signing in is still
// required, and registration is invite-only, so this is visible to members and not the
// public web.
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('users')
  getUsers() {
    return this.statsService.getUsersStats();
  }

  @Get('users/latest')
  getLatestUsers(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.statsService.getLatestUsers(page);
  }

  @Get('money')
  getMoney() {
    return this.statsService.getMoneyStats();
  }

  @Get('series')
  getSeries(@Query('range') range = 'month') {
    return this.statsService.getSeries(range);
  }

  @Get('money/history')
  getMoneyHistory(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.statsService.getMoneyHistory(page);
  }
}

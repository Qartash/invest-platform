import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

// Platform-wide moderation figures, not per-user ones: turnover across every account, the
// registration feed, and a money history that names the user behind each deposit and
// withdrawal. Authentication alone used to be the only gate, so any investor could read
// every other user's funding activity by name.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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

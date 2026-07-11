import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  @Get('money/history')
  getMoneyHistory(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.statsService.getMoneyHistory(page);
  }
}

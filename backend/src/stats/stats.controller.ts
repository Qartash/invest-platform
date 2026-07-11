import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get('money')
  getMoney() {
    return this.statsService.getMoneyStats();
  }
}

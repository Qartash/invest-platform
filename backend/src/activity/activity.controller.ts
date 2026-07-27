import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { DailyDrawService } from './daily-draw.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { ymd } from './streak';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly dailyDrawService: DailyDrawService,
  ) {}

  // Called by the app on launch/foreground. Marks today, returns the streak, and
  // pays the weekly reward / qualifies the chain when a week completes.
  @Post('checkin')
  checkIn(@CurrentUser() user: User) {
    return this.activityService.checkIn(user.id);
  }

  // Streak for display, without recording a visit.
  @Get('streak')
  getStreak(@CurrentUser() user: User) {
    return this.activityService.getStreak(user.id);
  }

  // Today's draw as it concerns this user: the pot, one share, and whether they
  // won. Zero when the draw hasn't run or they weren't picked.
  @Get('daily-bonus')
  getDailyBonus(@CurrentUser() user: User) {
    return this.dailyDrawService.todayFor(user.id);
  }

  // Runs today's draw now instead of waiting for the evening job — for testing
  // the flow and for rescuing a day the scheduler missed. Idempotent: a day that
  // already paid out does nothing.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/run-daily-draw')
  runDraw() {
    return this.dailyDrawService.draw(ymd(new Date()));
  }
}

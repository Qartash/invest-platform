import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';

@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // Code, headline counts, and earnings totals for the profile row and the
  // invites screen header.
  @Get('summary')
  getSummary(@CurrentUser() user: User) {
    return this.referralsService.getSummary(user.id);
  }

  // Who invited the viewer, or null if they started their own branch.
  @Get('referrer')
  getReferrer(@CurrentUser() user: User) {
    return this.referralsService.getReferrer(user.id);
  }

  // The nested community tree. `depth` bounds one response; the chain itself is
  // unbounded and deeper levels are pulled on demand.
  @Get('tree')
  getTree(
    @CurrentUser() user: User,
    @Query('depth', new DefaultValuePipe(4), ParseIntPipe) depth: number,
  ) {
    return this.referralsService.getTree(user.id, Math.min(Math.max(depth, 1), 12));
  }

  // The earnings ledger — bonuses and their status (held / paid / cancelled).
  @Get('earnings')
  getEarnings(@CurrentUser() user: User) {
    return this.referralsService.getEarningsHistory(user.id);
  }

  // Refund / fraud handling: void an invitee's still-held earnings across every
  // ancestor. Already-paid rows are left untouched.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/void/:inviteeId')
  async voidForInvitee(@Param('inviteeId', ParseUUIDPipe) inviteeId: string) {
    const cancelled = await this.referralsService.cancelForInvitee(inviteeId);
    return { cancelled };
  }
}

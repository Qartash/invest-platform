import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PartnerApplicationStatus, UserRole } from '../common/enums';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { ReviewPartnerDto } from './dto/review-partner.dto';
import { SettlePayoutDto } from './dto/settle-payout.dto';

@UseGuards(JwtAuthGuard)
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // Terms, the viewer's application if any, and their partner earnings. One call
  // drives all three states of the partner screen.
  @Get('me')
  myStatus(@CurrentUser() user: User) {
    return this.partnersService.myStatus(user.id);
  }

  @Post('apply')
  apply(@CurrentUser() user: User, @Body() dto: ApplyPartnerDto) {
    return this.partnersService.apply(user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/applications')
  list(@Query('status') status?: PartnerApplicationStatus) {
    return this.partnersService.listForReview(status);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/applications/:id/review')
  review(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPartnerDto,
  ) {
    return this.partnersService.review(id, admin.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:userId/revoke')
  revoke(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.partnersService.revoke(userId);
  }

  // What is owed to partners in cash, grouped per partner.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/payouts-due')
  payoutsDue() {
    return this.partnersService.duePayouts();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/payouts/settle')
  async settle(@Body() dto: SettlePayoutDto) {
    const settled = await this.partnersService.settle(dto.earningIds);
    return { settled };
  }
}

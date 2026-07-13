import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectFundingService } from './project-funding.service';
import { RequestReleaseDto } from './dto/request-release.dto';
import { DecideReleaseDto } from './dto/decide-release.dto';
import { WithdrawFundsDto } from './dto/withdraw-funds.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/release-requests')
export class ProjectReleaseController {
  constructor(private readonly fundingService: ProjectFundingService) {}

  @Get()
  list(@Param('id') projectId: string) {
    return this.fundingService.listForProject(projectId);
  }

  @Post()
  request(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: RequestReleaseDto) {
    return this.fundingService.requestRelease(projectId, user.id, dto);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/funds')
export class ProjectFundsController {
  constructor(private readonly fundingService: ProjectFundingService) {}

  @Post('withdraw')
  withdraw(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: WithdrawFundsDto) {
    return this.fundingService.withdrawToWallet(projectId, user.id, dto.amount);
  }
}

// Moderator queue for reviewing release requests across all projects.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('funding/release-requests')
export class FundReleaseModerationController {
  constructor(private readonly fundingService: ProjectFundingService) {}

  @Get()
  pending() {
    return this.fundingService.listPending();
  }

  @Post(':reqId/decide')
  decide(@CurrentUser() user: User, @Param('reqId') reqId: string, @Body() dto: DecideReleaseDto) {
    return this.fundingService.decide(reqId, user.id, dto);
  }
}

// Moderator marks a project failed and refunds the treasury to holders.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('funding/projects')
export class ProjectRefundController {
  constructor(private readonly fundingService: ProjectFundingService) {}

  @Post(':id/refund')
  refund(@Param('id') projectId: string) {
    return this.fundingService.refundProject(projectId);
  }
}

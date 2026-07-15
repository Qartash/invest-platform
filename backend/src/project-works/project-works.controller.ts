import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectWorksService } from './project-works.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { ApplyWorkDto } from './dto/apply-work.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { SelectApplicantDto } from './dto/select-applicant.dto';
import { ReviewWorkDto } from './dto/review-work.dto';
import { AddMilestonesDto } from './dto/add-milestones.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/works')
export class ProjectWorksController {
  constructor(private readonly worksService: ProjectWorksService) {}

  @Get()
  list(@CurrentUser() user: User, @Param('id') projectId: string) {
    return this.worksService.listWorks(projectId, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: CreateWorkDto) {
    return this.worksService.createWork(projectId, user.id, dto);
  }

  @Patch(':workId')
  update(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Body() dto: CreateWorkDto,
  ) {
    return this.worksService.updateWork(projectId, workId, user.id, dto);
  }

  @Delete(':workId')
  async remove(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    await this.worksService.deleteWork(projectId, workId, user.id);
    return { success: true };
  }

  @Post(':workId/apply')
  apply(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Body() dto: ApplyWorkDto,
  ) {
    return this.worksService.apply(projectId, workId, user.id, dto);
  }

  @Patch(':workId/apply')
  updateApplication(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Body() dto: ApplyWorkDto,
  ) {
    return this.worksService.updateApplication(projectId, workId, user.id, dto);
  }

  @Get(':workId/applications')
  applications(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.listApplications(projectId, workId, user.id);
  }

  @Post(':workId/applications/:appId/reject')
  rejectApplication(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Param('appId') appId: string,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.worksService.rejectApplication(projectId, workId, appId, user.id, dto.reason);
  }

  @Post(':workId/applications/:appId/select')
  select(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Param('appId') appId: string,
    @Body() dto: SelectApplicantDto,
  ) {
    return this.worksService.selectApplicant(projectId, workId, appId, user.id, dto.agreedAmount);
  }

  @Post(':workId/submit')
  submit(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.submit(projectId, workId, user.id);
  }

  @Post(':workId/accept')
  accept(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.accept(projectId, workId, user.id);
  }

  @Post(':workId/cancel')
  cancel(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.cancel(projectId, workId, user.id);
  }

  @Post(':workId/dispute')
  dispute(@CurrentUser() user: User, @Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.dispute(projectId, workId, user.id);
  }

  @Post(':workId/review')
  review(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Body() dto: ReviewWorkDto,
  ) {
    return this.worksService.reviewWork(projectId, workId, user.id, dto.rating, dto.comment);
  }

  @Get(':workId/milestones')
  milestones(@Param('id') projectId: string, @Param('workId') workId: string) {
    return this.worksService.getMilestones(workId);
  }

  @Post(':workId/milestones')
  addMilestones(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Body() dto: AddMilestonesDto,
  ) {
    return this.worksService.addMilestones(projectId, workId, user.id, dto.items);
  }

  @Post(':workId/milestones/:mId/submit')
  submitMilestone(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Param('mId') mId: string,
  ) {
    return this.worksService.submitMilestone(projectId, workId, mId, user.id);
  }

  @Post(':workId/milestones/:mId/accept')
  acceptMilestone(
    @CurrentUser() user: User,
    @Param('id') projectId: string,
    @Param('workId') workId: string,
    @Param('mId') mId: string,
  ) {
    return this.worksService.acceptMilestone(projectId, workId, mId, user.id);
  }
}

// Moderator arbitration of disputed works.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('works/disputed')
export class WorkDisputesController {
  constructor(private readonly worksService: ProjectWorksService) {}

  @Get()
  list() {
    return this.worksService.listDisputed();
  }

  @Post(':workId/resolve')
  resolve(@Param('workId') workId: string, @Body() dto: ResolveDisputeDto) {
    return this.worksService.resolveDispute(workId, dto.releaseToWorker);
  }
}

@UseGuards(JwtAuthGuard)
@Controller()
export class WorksMiscController {
  constructor(private readonly worksService: ProjectWorksService) {}

  @Get('works/mine')
  mine(@CurrentUser() user: User) {
    return this.worksService.listMine(user.id);
  }

  @Get('users/:userId/works')
  userWorks(@Param('userId') userId: string) {
    return this.worksService.userWorks(userId);
  }
}

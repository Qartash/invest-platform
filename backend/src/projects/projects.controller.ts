import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { TicketsService } from '../tickets/tickets.service';
import { ProjectWorksService } from '../project-works/project-works.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetRiskDto } from './dto/set-risk.dto';
import { SetPriorityDto } from './dto/set-priority.dto';
import { ReviewProjectDto } from './dto/review-project.dto';
import { UpdateBudgetItemStatusDto } from './dto/update-budget-item-status.dto';
import { AddBudgetItemsDto } from './dto/add-budget-items.dto';
import { SetTeamMembersDto } from './dto/set-team-members.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Project } from './entities/project.entity';
import { KycStatus, ProjectStatus, UserRole } from '../common/enums';
import { toProjectResponse } from './project-response';
import { cached } from '../common/response-cache';
import {
  ATTACHMENT_UPLOAD_TYPES,
  IMAGE_UPLOAD_TYPES,
  displayFileName,
  uploadOptions,
} from '../common/upload-storage';

// Matches the client's own cache window, so a figure never looks stale on one side and
// fresh on the other.
const PROJECT_LIST_TTL_MS = 30_000;

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ticketsService: TicketsService,
    private readonly worksService: ProjectWorksService,
  ) {}

  // Three counts ride along with every project so the cards can show how many people are in,
  // what is up for resale and whether there is work to look at — without them the app would
  // need a request per card to know. They are fetched for the whole list in three queries
  // rather than three per project: the list used to cost sixty round trips on a page of
  // twenty, every one of them paid at full price against a database waking from sleep.
  private async withInvestorCounts(projects: Project[]) {
    const ids = projects.map((project) => project.id);
    const [investorCounts, resaleStats, worksCounts] = await Promise.all([
      this.ticketsService.countInvestorsByProject(ids),
      this.ticketsService.getResaleStatsByProject(ids),
      this.worksService.countWorksByProject(ids),
    ]);

    return projects.map((project) => {
      // Resale figures belong to projects that allow resale; the others get zeros rather
      // than whatever rows happen to exist from before the setting was turned off.
      const resale = project.resaleEnabled
        ? resaleStats.get(project.id) ?? { listingsCount: 0, ticketsCount: 0 }
        : { listingsCount: 0, ticketsCount: 0 };
      return {
        ...toProjectResponse(project),
        investorCount: investorCounts.get(project.id) ?? 0,
        resaleListingsCount: resale.listingsCount,
        resaleTicketsCount: resale.ticketsCount,
        worksCount: worksCounts.get(project.id) ?? 0,
      };
    });
  }

  private async withInvestorCount(project: Project) {
    const [withCounts] = await this.withInvestorCounts([project]);
    return withCounts;
  }

  // The only endpoint here that is the same for everyone, and the one every visitor hits
  // first, so it is worth holding briefly in memory — see response-cache.ts. Writes that
  // could move it clear it immediately (ProjectCacheInterceptor); the half minute is the
  // ceiling on how stale it can get when nothing is written at all.
  @Get()
  async findActive(@Query('status') status?: 'active' | 'funded') {
    const wanted = status === 'funded' ? ProjectStatus.FUNDED : ProjectStatus.ACTIVE;
    return cached(`projects:list:${wanted}`, PROJECT_LIST_TTL_MS, async () => {
      const projects = await this.projectsService.findByStatus(wanted);
      return this.withInvestorCounts(projects);
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async findMine(@CurrentUser() user: User) {
    const projects = await this.projectsService.findByFounder(user.id);
    return this.withInvestorCounts(projects);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending')
  async findPending() {
    const projects = await this.projectsService.findPendingReview();
    return projects.map(toProjectResponse);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending-deletions')
  async findPendingDeletions() {
    const projects = await this.projectsService.findPendingDeletions();
    return this.withInvestorCounts(projects);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('all')
  async findAllForModeration() {
    const projects = await this.projectsService.findAllForModeration();
    return projects.map(toProjectResponse);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const project = await this.projectsService.findOne(id);
    return this.withInvestorCount(project);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/purchases')
  findPurchases(@Param('id') id: string) {
    return this.ticketsService.findPurchasesByProject(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/listings')
  findListings(@Param('id') id: string) {
    return this.ticketsService.findListingsByProject(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  async findHistory(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.findOne(id);
    if (project.founderId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    return this.projectsService.getHistory(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  async approve(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReviewProjectDto) {
    const project = await this.projectsService.approve(id, dto.comment, user.id, user.fullName || user.username || user.email || 'Unknown');
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  async reject(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReviewProjectDto) {
    const project = await this.projectsService.reject(id, dto.comment, user.id, user.fullName || user.username || user.email || 'Unknown');
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/risk')
  async setRisk(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SetRiskDto) {
    const project = await this.projectsService.setRisk(id, dto, user.id, user.fullName || user.username || user.email || 'Unknown');
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/priority')
  async setPriority(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SetPriorityDto) {
    const project = await this.projectsService.setPriority(id, dto, {
      id: user.id,
      role: user.role,
      name: user.fullName || user.username || user.email || 'Unknown',
    });
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    // Investing needs no verification, but publishing a project (taking other
    // people's money) requires a verified identity.
    if (user.kycStatus !== KycStatus.APPROVED) {
      throw new ForbiddenException('You must be verified to create a project');
    }
    const project = await this.projectsService.create(user.id, dto);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    const project = await this.projectsService.update(id, user.id, dto);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/admin-edit')
  async adminUpdate(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    const project = await this.projectsService.adminUpdate(
      id,
      dto,
      user.id,
      user.fullName || user.username || user.email || 'Unknown',
    );
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel-review')
  async cancelReview(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.cancelReview(id, user.id);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/request-deletion')
  async requestDeletion(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.requestDeletion(id, user.id);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel-deletion')
  async cancelDeletion(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.cancelDeletionRequest(id, user.id);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/restore')
  async restore(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.restoreProject(id, user.id);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve-deletion')
  async approveDeletion(@CurrentUser() user: User, @Param('id') id: string) {
    const project = await this.projectsService.approveDeletion(id, user.id, user.fullName || user.username || user.email || 'Unknown');
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reject-deletion')
  async rejectDeletion(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReviewProjectDto) {
    const project = await this.projectsService.rejectDeletion(id, dto.comment, user.id, user.fullName || user.username || user.email || 'Unknown');
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cover-image')
  @UseInterceptors(
    FileInterceptor(
      'file',
      uploadOptions({ destination: './uploads/projects', accept: IMAGE_UPLOAD_TYPES, maxBytes: 5 * 1024 * 1024 }),
    ),
  )
  async uploadCoverImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const project = await this.projectsService.setCoverImage(id, user.id, `/uploads/projects/${file.filename}`, user.role);
    return toProjectResponse(project);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/attachments')
  findAttachments(@Param('id') id: string) {
    return this.projectsService.listAttachments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor(
      'file',
      uploadOptions({
        destination: './uploads/attachments',
        accept: ATTACHMENT_UPLOAD_TYPES,
        maxBytes: 20 * 1024 * 1024,
      }),
    ),
  )
  async uploadAttachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.projectsService.addAttachment(
      id,
      user.id,
      {
        // What the uploader called it, kept for the download link and shown as-is in the
        // attachment list — so it is flattened first (see displayFileName).
        fileName: displayFileName(file.originalname),
        fileUrl: `/uploads/attachments/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype ?? null,
      },
      user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/attachments/:attachmentId')
  async deleteAttachment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.projectsService.deleteAttachment(id, attachmentId, user.id, user.role);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/team')
  findTeamMembers(@Param('id') id: string) {
    return this.projectsService.listTeamMembers(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/team')
  setTeamMembers(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SetTeamMembersDto) {
    return this.projectsService.setTeamMembers(id, user.id, user.role, dto.members);
  }

  // Uploads a photo and hands back its URL, without touching any team row. Keeping the two
  // apart is what lets a founder attach photos while composing the roster — the members do
  // not exist yet at that point, and on a brand-new project neither does anything to key on.
  @UseGuards(JwtAuthGuard)
  @Post(':id/team-photo')
  @UseInterceptors(
    FileInterceptor(
      'file',
      uploadOptions({ destination: './uploads/team', accept: IMAGE_UPLOAD_TYPES, maxBytes: 5 * 1024 * 1024 }),
    ),
  )
  async uploadTeamPhoto(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    await this.projectsService.assertCanEditTeam(id, user.id, user.role);
    return { url: `/uploads/team/${file.filename}` };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/budget-items')
  findBudgetItems(@Param('id') id: string) {
    return this.projectsService.listBudgetItems(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/budget-items')
  addBudgetItems(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: AddBudgetItemsDto) {
    return this.projectsService.addBudgetItems(id, user.id, user.role, dto.items);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/budget-items/:itemId/status')
  updateBudgetItemStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBudgetItemStatusDto,
  ) {
    return this.projectsService.updateBudgetItemStatus(id, itemId, user.id, user.role, dto.status);
  }
}

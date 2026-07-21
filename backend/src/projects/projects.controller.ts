import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ticketsService: TicketsService,
    private readonly worksService: ProjectWorksService,
  ) {}

  private async withInvestorCount(project: Project) {
    const investorCount = await this.ticketsService.countInvestors(project.id);
    const resaleStats = project.resaleEnabled
      ? await this.ticketsService.getResaleStats(project.id)
      : { listingsCount: 0, ticketsCount: 0 };
    // Rides along with the other counts so the project cards can offer a jump straight to
    // the works list — without it the app would need one request per card to know.
    const worksCount = await this.worksService.countWorks(project.id);
    return {
      ...toProjectResponse(project),
      investorCount,
      resaleListingsCount: resaleStats.listingsCount,
      resaleTicketsCount: resaleStats.ticketsCount,
      worksCount,
    };
  }

  private withInvestorCounts(projects: Project[]) {
    return Promise.all(projects.map((project) => this.withInvestorCount(project)));
  }

  @Get()
  async findActive(@Query('status') status?: 'active' | 'funded') {
    const projects = await this.projectsService.findByStatus(
      status === 'funded' ? ProjectStatus.FUNDED : ProjectStatus.ACTIVE,
    );
    return this.withInvestorCounts(projects);
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
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/projects',
        filename: (req, file, cb) => {
          cb(null, `${req.params.id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
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
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/attachments',
        filename: (req, file, cb) => {
          cb(null, `${req.params.id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
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
        fileName: file.originalname,
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
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/team',
        filename: (req, file, cb) => {
          cb(null, `${req.params.id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
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

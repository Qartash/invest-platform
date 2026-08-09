import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMAGE_UPLOAD_TYPES, uploadOptions } from '../common/upload-storage';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ContentReportStatus, ContentTarget, UserRole } from '../common/enums';
import { QuestionsService } from './questions.service';
// Type-only: a bare type in a decorated signature is not something the
// decorator metadata emitter can resolve at runtime.
import type { QuestionSort } from './questions.service';
import { UpdatesService } from './updates.service';
import { VotesService } from './votes.service';
import { ModerationService } from './moderation.service';
import {
  AnswerQuestionDto,
  AskQuestionDto,
  ReportContentDto,
  ResolveReportDto,
  VoteDto,
} from './dto/question.dto';
import { CreateUpdateDto, EditUpdateDto } from './dto/update.dto';

/**
 * Everything public about a project that is written by people rather than by the
 * finance flows: questions, answers, the updates feed, and the votes and reports
 * that sit on all three.
 *
 * Signed in throughout, including the reads. Registration is invite-only, so
 * there is no anonymous audience to serve — and a question carrying a real name
 * to an audience of accounts is a different thing from one posted to the open
 * internet.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectSocialController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly updates: UpdatesService,
    private readonly votes: VotesService,
    private readonly moderation: ModerationService,
  ) {}

  // ── Questions ──────────────────────────────────────────────────────────────

  @Get('projects/:projectId/questions')
  list(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('sort') sort?: QuestionSort,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.questions.listForProject(projectId, user, {
      sort,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // Ahead of asking, not after: this is what stops the fifth copy of the same
  // question reaching the founder.
  @Get('projects/:projectId/questions/similar')
  similar(@Param('projectId', ParseUUIDPipe) projectId: string, @Query('q') text = '') {
    return this.questions.findSimilar(projectId, text);
  }

  @Post('projects/:projectId/questions')
  ask(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AskQuestionDto,
  ) {
    return this.questions.ask(user, projectId, dto);
  }

  @Get('questions/:id')
  thread(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.getThread(id, user);
  }

  @Patch('questions/:id')
  edit(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AskQuestionDto,
  ) {
    return this.questions.editQuestion(user, id, dto.body);
  }

  @Delete('questions/:id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.deleteQuestion(user, id);
  }

  // The founder answering, or anyone adding a follow-up — the service decides
  // which of the two this is from who is asking.
  @Post('questions/:id/answers')
  answer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.questions.answer(user, id, dto);
  }

  @Post('questions/:id/follow')
  follow(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.follow(user.id, id, true);
  }

  @Delete('questions/:id/follow')
  unfollow(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.follow(user.id, id, false);
  }

  // ── Votes ──────────────────────────────────────────────────────────────────
  //
  // One route for casting and taking back: the button is a toggle, so the
  // request is one too.

  @Post('questions/:id/vote')
  voteQuestion(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
  ) {
    return this.votes.toggle(user.id, ContentTarget.QUESTION, id, dto.kind);
  }

  @Post('answers/:id/vote')
  voteAnswer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
  ) {
    return this.votes.toggle(user.id, ContentTarget.ANSWER, id, dto.kind);
  }

  @Post('updates/:id/vote')
  voteUpdate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
  ) {
    return this.votes.toggle(user.id, ContentTarget.UPDATE, id, dto.kind);
  }

  // ── Updates feed ───────────────────────────────────────────────────────────

  @Get('projects/:projectId/updates')
  listUpdates(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.updates.listForProject(
      projectId,
      user,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post('projects/:projectId/updates')
  createUpdate(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateUpdateDto,
  ) {
    return this.updates.create(user, projectId, dto);
  }

  @Patch('updates/:id')
  editUpdate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditUpdateDto,
  ) {
    return this.updates.edit(user, id, dto);
  }

  /**
   * A photo for a post, uploaded before the post itself exists — the create call
   * takes URLs, not file data.
   *
   * Deliberately not the project attachments endpoint: those are the documents
   * shown under "About", and a photo of a delivery arriving does not belong in a
   * list next to the lease agreement.
   */
  @Post('projects/:projectId/updates/photo')
  @UseInterceptors(
    FileInterceptor(
      'file',
      uploadOptions({
        destination: './uploads/updates',
        accept: IMAGE_UPLOAD_TYPES,
        maxBytes: 5 * 1024 * 1024,
      }),
    ),
  )
  uploadUpdatePhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/updates/${file.filename}` };
  }

  @Post('updates/:id/read')
  readUpdate(@Param('id', ParseUUIDPipe) id: string) {
    return this.updates.markRead(id).then(() => ({ ok: true }));
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  @Post('questions/:id/report')
  reportQuestion(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportContentDto,
  ) {
    return this.moderation.report(user, ContentTarget.QUESTION, id, dto);
  }

  @Post('answers/:id/report')
  reportAnswer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportContentDto,
  ) {
    return this.moderation.report(user, ContentTarget.ANSWER, id, dto);
  }

  @Post('updates/:id/report')
  reportUpdate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportContentDto,
  ) {
    return this.moderation.report(user, ContentTarget.UPDATE, id, dto);
  }

  // ── Moderation ─────────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('moderation/reports')
  reports(@Query('status') status?: ContentReportStatus) {
    return this.moderation.listReports(status ?? ContentReportStatus.PENDING);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('moderation/neglected-projects')
  neglected() {
    return this.moderation.listNeglectedProjects();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('moderation/:targetType/:targetId/resolve')
  resolve(
    @CurrentUser() moderator: User,
    @Param('targetType') targetType: ContentTarget,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderation.resolve(moderator, targetType, targetId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('moderation/:targetType/:targetId/unhide')
  unhide(
    @Param('targetType') targetType: ContentTarget,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.moderation.unhide(targetType, targetId);
  }
}

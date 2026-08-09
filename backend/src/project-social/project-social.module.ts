import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectQuestion } from './entities/project-question.entity';
import { ProjectAnswer } from './entities/project-answer.entity';
import { ProjectUpdate } from './entities/project-update.entity';
import { UpdateRead } from './entities/update-read.entity';
import { ContentVote } from './entities/content-vote.entity';
import { ContentReport } from './entities/content-report.entity';
import { QuestionFollow } from './entities/question-follow.entity';
import { Project } from '../projects/entities/project.entity';
import { QuestionsService } from './questions.service';
import { UpdatesService } from './updates.service';
import { VotesService } from './votes.service';
import { ModerationService } from './moderation.service';
import { ProjectSocialController } from './project-social.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectQuestion,
      ProjectAnswer,
      ProjectUpdate,
      UpdateRead,
      ContentVote,
      ContentReport,
      QuestionFollow,
      Project,
    ]),
    NotificationsModule,
    // For holderIds: an update is addressed to whoever holds tickets in the
    // project, which is a question only the tickets side can answer.
    TicketsModule,
  ],
  providers: [QuestionsService, UpdatesService, VotesService, ModerationService],
  controllers: [ProjectSocialController],
  // UpdatesService is exported for the finance flow, which posts to the feed
  // when a report is published.
  exports: [UpdatesService, QuestionsService],
})
export class ProjectSocialModule {}

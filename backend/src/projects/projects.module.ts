import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectReviewLog } from './entities/project-review-log.entity';
import { ProjectAttachment } from './entities/project-attachment.entity';
import { ProjectBudgetItem } from './entities/project-budget-item.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectReviewLog, ProjectAttachment, ProjectBudgetItem]),
    TicketsModule,
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}

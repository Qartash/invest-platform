import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectWork } from './entities/project-work.entity';
import { WorkApplication } from './entities/work-application.entity';
import { WorkReview } from './entities/work-review.entity';
import { WorkMilestone } from './entities/work-milestone.entity';
import { Project } from '../projects/entities/project.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ProjectWorksService } from './project-works.service';
import { ProjectWorksController, WorksMiscController, WorkDisputesController } from './project-works.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectWork, WorkApplication, WorkReview, WorkMilestone, Project, Wallet]),
    NotificationsModule,
    LedgerModule,
  ],
  providers: [ProjectWorksService],
  controllers: [ProjectWorksController, WorksMiscController, WorkDisputesController],
  exports: [ProjectWorksService],
})
export class ProjectWorksModule {}

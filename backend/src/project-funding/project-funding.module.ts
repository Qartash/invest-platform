import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundReleaseRequest } from './entities/fund-release-request.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectBudgetItem } from '../projects/entities/project-budget-item.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { ProjectFundingService } from './project-funding.service';
import {
  ProjectReleaseController,
  ProjectFundsController,
  FundReleaseModerationController,
  ProjectRefundController,
} from './project-funding.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FundReleaseRequest, Project, ProjectBudgetItem, Wallet, Ticket]),
    TicketsModule,
    NotificationsModule,
  ],
  providers: [ProjectFundingService],
  controllers: [ProjectReleaseController, ProjectFundsController, FundReleaseModerationController, ProjectRefundController],
  exports: [ProjectFundingService],
})
export class ProjectFundingModule {}

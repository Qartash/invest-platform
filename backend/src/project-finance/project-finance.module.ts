import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectExpense } from './entities/project-expense.entity';
import { ProjectIncome } from './entities/project-income.entity';
import { ProjectFinancialReport } from './entities/project-financial-report.entity';
import { ReportPayout } from './entities/report-payout.entity';
import { ProjectFinanceService } from './project-finance.service';
import {
  ProjectExpensesController,
  ProjectIncomesController,
  ProjectFinancialReportsController,
} from './project-finance.controller';
import { ProjectsModule } from '../projects/projects.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ProjectSocialModule } from '../project-social/project-social.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectExpense, ProjectIncome, ProjectFinancialReport, ReportPayout]),
    ProjectsModule,
    TicketsModule,
    NotificationsModule,
    LedgerModule,
    // Publishing a report also posts it to the project's feed.
    ProjectSocialModule,
  ],
  providers: [ProjectFinanceService],
  exports: [ProjectFinanceService],
  controllers: [ProjectExpensesController, ProjectIncomesController, ProjectFinancialReportsController],
})
export class ProjectFinanceModule {}

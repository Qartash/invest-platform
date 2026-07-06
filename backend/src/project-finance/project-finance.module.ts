import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectExpense } from './entities/project-expense.entity';
import { ProjectIncome } from './entities/project-income.entity';
import { ProjectFinancialReport } from './entities/project-financial-report.entity';
import { ProjectFinanceService } from './project-finance.service';
import {
  ProjectExpensesController,
  ProjectIncomesController,
  ProjectFinancialReportsController,
} from './project-finance.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectExpense, ProjectIncome, ProjectFinancialReport]), ProjectsModule],
  providers: [ProjectFinanceService],
  controllers: [ProjectExpensesController, ProjectIncomesController, ProjectFinancialReportsController],
})
export class ProjectFinanceModule {}

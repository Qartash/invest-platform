import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectFinanceService } from './project-finance.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateFinancialReportDto } from './dto/create-financial-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/expenses')
export class ProjectExpensesController {
  constructor(private readonly financeService: ProjectFinanceService) {}

  @Get()
  list(@Param('id') projectId: string) {
    return this.financeService.listExpenses(projectId);
  }

  @Post()
  create(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: CreateExpenseDto) {
    return this.financeService.addExpense(projectId, user.id, user.role, dto);
  }

  @Delete(':expenseId')
  async remove(@CurrentUser() user: User, @Param('id') projectId: string, @Param('expenseId') expenseId: string) {
    await this.financeService.deleteExpense(projectId, expenseId, user.id, user.role);
    return { success: true };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/incomes')
export class ProjectIncomesController {
  constructor(private readonly financeService: ProjectFinanceService) {}

  @Get()
  list(@Param('id') projectId: string) {
    return this.financeService.listIncomes(projectId);
  }

  @Post()
  create(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: CreateIncomeDto) {
    return this.financeService.addIncome(projectId, user.id, user.role, dto);
  }

  @Delete(':incomeId')
  async remove(@CurrentUser() user: User, @Param('id') projectId: string, @Param('incomeId') incomeId: string) {
    await this.financeService.deleteIncome(projectId, incomeId, user.id, user.role);
    return { success: true };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('projects/:id/financial-reports')
export class ProjectFinancialReportsController {
  constructor(private readonly financeService: ProjectFinanceService) {}

  @Get()
  list(@CurrentUser() user: User, @Param('id') projectId: string) {
    return this.financeService.listReports(projectId, user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Param('id') projectId: string, @Body() dto: CreateFinancialReportDto) {
    return this.financeService.addReport(projectId, user.id, user.role, dto);
  }

  @Post(':reportId/payout')
  pay(@CurrentUser() user: User, @Param('id') projectId: string, @Param('reportId') reportId: string) {
    return this.financeService.payReport(projectId, reportId, user.id);
  }

  @Get(':reportId/payouts')
  listPayouts(@Param('id') projectId: string, @Param('reportId') reportId: string) {
    return this.financeService.listPayouts(projectId, reportId);
  }

  @Delete(':reportId')
  async remove(@CurrentUser() user: User, @Param('id') projectId: string, @Param('reportId') reportId: string) {
    await this.financeService.deleteReport(projectId, reportId, user.id, user.role);
    return { success: true };
  }
}

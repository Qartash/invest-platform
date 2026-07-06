import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectExpense } from './entities/project-expense.entity';
import { ProjectIncome } from './entities/project-income.entity';
import { ProjectFinancialReport } from './entities/project-financial-report.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateFinancialReportDto } from './dto/create-financial-report.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class ProjectFinanceService {
  constructor(
    @InjectRepository(ProjectExpense)
    private readonly expensesRepository: Repository<ProjectExpense>,
    @InjectRepository(ProjectIncome)
    private readonly incomesRepository: Repository<ProjectIncome>,
    @InjectRepository(ProjectFinancialReport)
    private readonly reportsRepository: Repository<ProjectFinancialReport>,
    private readonly projectsService: ProjectsService,
  ) {}

  private async assertCanEdit(projectId: string, userId: string, userRole: UserRole) {
    const project = await this.projectsService.findOne(projectId);
    if (project.founderId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    return project;
  }

  listExpenses(projectId: string) {
    return this.expensesRepository.find({ where: { projectId }, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async addExpense(projectId: string, userId: string, userRole: UserRole, dto: CreateExpenseDto) {
    await this.assertCanEdit(projectId, userId, userRole);
    const expense = this.expensesRepository.create({ ...dto, projectId, amount: dto.amount.toFixed(2) });
    return this.expensesRepository.save(expense);
  }

  async deleteExpense(projectId: string, expenseId: string, userId: string, userRole: UserRole) {
    await this.assertCanEdit(projectId, userId, userRole);
    const expense = await this.expensesRepository.findOne({ where: { id: expenseId, projectId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    await this.expensesRepository.remove(expense);
  }

  listIncomes(projectId: string) {
    return this.incomesRepository.find({ where: { projectId }, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async addIncome(projectId: string, userId: string, userRole: UserRole, dto: CreateIncomeDto) {
    await this.assertCanEdit(projectId, userId, userRole);
    const income = this.incomesRepository.create({ ...dto, projectId, amount: dto.amount.toFixed(2) });
    return this.incomesRepository.save(income);
  }

  async deleteIncome(projectId: string, incomeId: string, userId: string, userRole: UserRole) {
    await this.assertCanEdit(projectId, userId, userRole);
    const income = await this.incomesRepository.findOne({ where: { id: incomeId, projectId } });
    if (!income) {
      throw new NotFoundException('Income not found');
    }
    await this.incomesRepository.remove(income);
  }

  private periodBounds(period: string) {
    const [year, month] = period.split('-').map(Number);
    const start = `${period}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${period}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }

  private async sumForPeriod(
    repository: Repository<ProjectExpense> | Repository<ProjectIncome>,
    alias: string,
    projectId: string,
    period: string,
  ): Promise<number> {
    const { start, end } = this.periodBounds(period);
    const result = await repository
      .createQueryBuilder(alias)
      .select(`COALESCE(SUM(${alias}.amount), 0)`, 'sum')
      .where(`${alias}.project_id = :projectId`, { projectId })
      .andWhere(`${alias}.date BETWEEN :start AND :end`, { start, end })
      .getRawOne<{ sum: string }>();
    return parseFloat(result?.sum ?? '0');
  }

  private expensesForPeriod(projectId: string, period: string): Promise<number> {
    return this.sumForPeriod(this.expensesRepository, 'expense', projectId, period);
  }

  private incomeForPeriod(projectId: string, period: string): Promise<number> {
    return this.sumForPeriod(this.incomesRepository, 'income', projectId, period);
  }

  async listReports(projectId: string) {
    const reports = await this.reportsRepository.find({ where: { projectId }, order: { period: 'DESC' } });
    return Promise.all(
      reports.map(async (report) => {
        const [turnoverAmount, expensesAmount] = await Promise.all([
          this.incomeForPeriod(projectId, report.period),
          this.expensesForPeriod(projectId, report.period),
        ]);
        return {
          id: report.id,
          projectId: report.projectId,
          period: report.period,
          turnoverAmount,
          expensesAmount,
          netProfit: turnoverAmount - expensesAmount,
          createdAt: report.createdAt,
        };
      }),
    );
  }

  async addReport(projectId: string, userId: string, userRole: UserRole, dto: CreateFinancialReportDto) {
    await this.assertCanEdit(projectId, userId, userRole);
    const existing = await this.reportsRepository.findOne({ where: { projectId, period: dto.period } });
    if (existing) {
      throw new ConflictException('A report for this period already exists');
    }
    const report = this.reportsRepository.create({ projectId, period: dto.period });
    await this.reportsRepository.save(report);
    const [turnoverAmount, expensesAmount] = await Promise.all([
      this.incomeForPeriod(projectId, report.period),
      this.expensesForPeriod(projectId, report.period),
    ]);
    return {
      id: report.id,
      projectId: report.projectId,
      period: report.period,
      turnoverAmount,
      expensesAmount,
      netProfit: turnoverAmount - expensesAmount,
      createdAt: report.createdAt,
    };
  }

  async deleteReport(projectId: string, reportId: string, userId: string, userRole: UserRole) {
    await this.assertCanEdit(projectId, userId, userRole);
    const report = await this.reportsRepository.findOne({ where: { id: reportId, projectId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    await this.reportsRepository.remove(report);
  }
}

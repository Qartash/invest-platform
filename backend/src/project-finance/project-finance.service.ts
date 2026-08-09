import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectExpense } from './entities/project-expense.entity';
import { ProjectIncome } from './entities/project-income.entity';
import { ProjectFinancialReport } from './entities/project-financial-report.entity';
import { ReportPayout } from './entities/report-payout.entity';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { lockWallets } from '../common/row-locks';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateFinancialReportDto } from './dto/create-financial-report.dto';
import {
  FinancialReportStatus,
  MovementKind,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../common/enums';
import { LedgerService, userBalance } from '../ledger/ledger.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotifyInput } from '../notifications/notification-types';
import { UpdatesService } from '../project-social/updates.service';

// More tickets held than the project ever issued — the state that puts a
// dividend run on hold until a person has looked at it.
interface LedgerMismatch {
  ticketsIssued: number;
  ticketsHeld: number;
}

@Injectable()
export class ProjectFinanceService {
  constructor(
    @InjectRepository(ProjectExpense)
    private readonly expensesRepository: Repository<ProjectExpense>,
    @InjectRepository(ProjectIncome)
    private readonly incomesRepository: Repository<ProjectIncome>,
    @InjectRepository(ProjectFinancialReport)
    private readonly reportsRepository: Repository<ProjectFinancialReport>,
    @InjectRepository(ReportPayout)
    private readonly payoutsRepository: Repository<ReportPayout>,
    private readonly projectsService: ProjectsService,
    private readonly ticketsService: TicketsService,
    private readonly notifications: NotificationsService,
    private readonly ledger: LedgerService,
    // Posts the published report to the project feed — see addReport.
    private readonly updates: UpdatesService,
    private readonly dataSource: DataSource,
  ) {}

  private async assertCanEdit(projectId: string, userId: string, userRole: UserRole) {
    const project = await this.projectsService.findOne(projectId);
    if (project.founderId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Not your project');
    }
    return project;
  }

  // Once a report is published for a month, that month's books are frozen:
  // no entries may be added to or removed from it.
  private async assertPeriodOpen(projectId: string, date: string) {
    const period = date.slice(0, 7);
    const report = await this.reportsRepository.findOne({ where: { projectId, period } });
    if (report) {
      throw new ConflictException('This month is closed by a published report');
    }
  }

  listExpenses(projectId: string) {
    return this.expensesRepository.find({ where: { projectId }, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async addExpense(projectId: string, userId: string, userRole: UserRole, dto: CreateExpenseDto) {
    await this.assertCanEdit(projectId, userId, userRole);
    await this.assertPeriodOpen(projectId, dto.date);
    const expense = this.expensesRepository.create({ ...dto, projectId, amount: dto.amount.toFixed(2) });
    return this.expensesRepository.save(expense);
  }

  async deleteExpense(projectId: string, expenseId: string, userId: string, userRole: UserRole, reason: string) {
    await this.assertCanEdit(projectId, userId, userRole);
    const expense = await this.expensesRepository.findOne({ where: { id: expenseId, projectId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.deletedAt) {
      throw new ConflictException('This entry is already deleted');
    }
    await this.assertPeriodOpen(projectId, expense.date);
    // Soft delete: keep the entry in the books as visible history with a reason.
    expense.deletedAt = new Date();
    expense.deletedReason = reason;
    return this.expensesRepository.save(expense);
  }

  listIncomes(projectId: string) {
    return this.incomesRepository.find({ where: { projectId }, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async addIncome(projectId: string, userId: string, userRole: UserRole, dto: CreateIncomeDto) {
    await this.assertCanEdit(projectId, userId, userRole);
    await this.assertPeriodOpen(projectId, dto.date);
    const income = this.incomesRepository.create({ ...dto, projectId, amount: dto.amount.toFixed(2) });
    return this.incomesRepository.save(income);
  }

  async deleteIncome(projectId: string, incomeId: string, userId: string, userRole: UserRole, reason: string) {
    await this.assertCanEdit(projectId, userId, userRole);
    const income = await this.incomesRepository.findOne({ where: { id: incomeId, projectId } });
    if (!income) {
      throw new NotFoundException('Income not found');
    }
    if (income.deletedAt) {
      throw new ConflictException('This entry is already deleted');
    }
    await this.assertPeriodOpen(projectId, income.date);
    // Soft delete: keep the entry in the books as visible history with a reason.
    income.deletedAt = new Date();
    income.deletedReason = reason;
    return this.incomesRepository.save(income);
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
      .andWhere(`${alias}.deleted_at IS NULL`)
      .getRawOne<{ sum: string }>();
    return parseFloat(result?.sum ?? '0');
  }

  private expensesForPeriod(projectId: string, period: string): Promise<number> {
    return this.sumForPeriod(this.expensesRepository, 'expense', projectId, period);
  }

  private incomeForPeriod(projectId: string, period: string): Promise<number> {
    return this.sumForPeriod(this.incomesRepository, 'income', projectId, period);
  }

  private toReportView(report: ProjectFinancialReport, myDividend: number | null) {
    return {
      id: report.id,
      projectId: report.projectId,
      period: report.period,
      status: report.status,
      turnoverAmount: parseFloat(report.incomeTotal),
      expensesAmount: parseFloat(report.expensesTotal),
      netProfit: parseFloat(report.netProfit),
      payoutTotal: report.payoutTotal === null ? null : parseFloat(report.payoutTotal),
      publishedAt: report.publishedAt,
      paidAt: report.paidAt,
      myDividend,
      createdAt: report.createdAt,
    };
  }

  // Reports created before totals were snapshotted have publishedAt = null;
  // compute and freeze their totals on first read.
  private async backfillLegacyReport(report: ProjectFinancialReport) {
    const [incomeTotal, expensesTotal] = await Promise.all([
      this.incomeForPeriod(report.projectId, report.period),
      this.expensesForPeriod(report.projectId, report.period),
    ]);
    report.incomeTotal = incomeTotal.toFixed(2);
    report.expensesTotal = expensesTotal.toFixed(2);
    report.netProfit = (incomeTotal - expensesTotal).toFixed(2);
    report.publishedAt = report.createdAt;
    return this.reportsRepository.save(report);
  }

  async listReports(projectId: string, currentUserId: string) {
    let reports = await this.reportsRepository.find({ where: { projectId }, order: { period: 'DESC' } });
    reports = await Promise.all(
      reports.map((report) => (report.publishedAt ? Promise.resolve(report) : this.backfillLegacyReport(report))),
    );

    const myPayouts = reports.length
      ? await this.payoutsRepository
          .createQueryBuilder('payout')
          .where('payout.user_id = :currentUserId', { currentUserId })
          .andWhere('payout.report_id IN (:...reportIds)', { reportIds: reports.map((r) => r.id) })
          .getMany()
      : [];
    const myPayoutByReport = new Map(myPayouts.map((payout) => [payout.reportId, parseFloat(payout.amount)]));

    return reports.map((report) => this.toReportView(report, myPayoutByReport.get(report.id) ?? null));
  }

  async addReport(projectId: string, userId: string, userRole: UserRole, dto: CreateFinancialReportDto) {
    const project = await this.assertCanEdit(projectId, userId, userRole);
    const currentPeriod = new Date().toISOString().slice(0, 7);
    if (dto.period > currentPeriod) {
      throw new BadRequestException('Cannot publish a report for a future month');
    }
    const existing = await this.reportsRepository.findOne({ where: { projectId, period: dto.period } });
    if (existing) {
      throw new ConflictException('A report for this period already exists');
    }
    const [incomeTotal, expensesTotal] = await Promise.all([
      this.incomeForPeriod(projectId, dto.period),
      this.expensesForPeriod(projectId, dto.period),
    ]);
    const report = this.reportsRepository.create({
      projectId,
      period: dto.period,
      status: FinancialReportStatus.PUBLISHED,
      incomeTotal: incomeTotal.toFixed(2),
      expensesTotal: expensesTotal.toFixed(2),
      netProfit: (incomeTotal - expensesTotal).toFixed(2),
      publishedAt: new Date(),
    });
    const saved = await this.reportsRepository.save(report);
    // Investors are told a month's books are closed, not what they will be paid:
    // publishing a report and paying its dividends are two separate acts, and the
    // founder may never take the second one.
    const holders = await this.ticketsService.holderIds(projectId);
    await this.notifications.notifyMany(
      holders
        .filter((holderId) => holderId !== project.founderId)
        .map((holderId) => ({
          userId: holderId,
          type: NotificationType.FINANCIAL_REPORT_PUBLISHED,
          payload: {
            projectId,
            projectTitle: project.title,
            period: saved.period,
            netProfit: parseFloat(saved.netProfit),
          },
        })),
    );
    // And the same event as a post in the project's feed. The founder writes
    // nothing for it: closing the books is the one piece of news every holder
    // reliably wants, so the flow that produces it says so itself. Failing to
    // post must never undo a published report, which is why the call swallows
    // its own errors rather than being awaited for a result.
    await this.updates.postReportPublished(projectId, {
      id: saved.id,
      periodLabel: saved.period,
      revenue: parseFloat(saved.incomeTotal),
      holders: holders.length,
    });
    return this.toReportView(saved, null);
  }

  async deleteReport(projectId: string, reportId: string, userId: string, userRole: UserRole) {
    await this.assertCanEdit(projectId, userId, userRole);
    const report = await this.reportsRepository.findOne({ where: { id: reportId, projectId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (report.status === FinancialReportStatus.PAID) {
      throw new ConflictException('Dividends for this report were already paid; it cannot be deleted');
    }
    await this.reportsRepository.remove(report);
  }

  async listPayouts(projectId: string, reportId: string) {
    const report = await this.reportsRepository.findOne({ where: { id: reportId, projectId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const payouts = await this.payoutsRepository.find({
      where: { reportId },
      relations: { user: true },
      order: { amount: 'DESC' },
    });
    return payouts.map((payout) => ({
      id: payout.id,
      userId: payout.userId,
      fullName: payout.user.fullName,
      username: payout.user.username,
      tickets: payout.tickets,
      sharePercent: parseFloat(payout.sharePercent),
      amount: parseFloat(payout.amount),
    }));
  }

  // Pays the investors' share of a published report's net profit out of the
  // founder's wallet, proportionally to the equity their tickets carry right now.
  // The share base is totalTickets scaled by equityOfferedPercent, so both the
  // unsold tickets and the equity the founder never offered stay with the founder.
  // Cent remainders from flooring also stay with the founder.
  async payReport(projectId: string, reportId: string, userId: string) {
    // Set inside the transaction, read after it has rolled back: the mismatch
    // below is refused, so the only way to tell anyone about it is to carry the
    // fact out past the exception.
    let ledgerMismatch: LedgerMismatch | null = null;
    const run = () =>
      this.dataSource.transaction(async (manager) => {
      const report = await manager.findOne(ProjectFinancialReport, {
        where: { id: reportId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!report) {
        throw new NotFoundException('Report not found');
      }
      if (report.status === FinancialReportStatus.PAID) {
        throw new ConflictException('Dividends for this report were already paid');
      }

      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      // Only the founder can pay: the money leaves their personal wallet.
      if (project.founderId !== userId) {
        throw new ForbiddenException('Only the project founder can pay dividends');
      }

      const netProfit = parseFloat(report.netProfit);
      if (netProfit <= 0) {
        throw new BadRequestException('No profit to distribute for this period');
      }

      const tickets = await manager.find(Ticket, { where: { projectId } });
      const ticketsByOwner = new Map<string, number>();
      for (const ticket of tickets) {
        if (ticket.ownerId === project.founderId) continue;
        ticketsByOwner.set(ticket.ownerId, (ticketsByOwner.get(ticket.ownerId) ?? 0) + ticket.quantity);
      }

      const netCents = BigInt(Math.round(netProfit * 100));
      const totalTickets = BigInt(project.totalTickets);
      // All totalTickets together carry equityOfferedPercent of the company, not all of
      // it, so a holder's cut of the profit is scaled down by that share. Counted in
      // hundredths of a percent to stay in integers; at the default 100% this is a
      // multiply and divide by the same 10000 and the split is unchanged.
      const equityHundredths = BigInt(Math.round(parseFloat(project.equityOfferedPercent) * 100));
      const holders = [...ticketsByOwner.entries()]
        .map(([ownerId, quantity]) => ({
          ownerId,
          quantity,
          // One division at the end: dividing per factor would floor twice and lose cents.
          amountCents: (netCents * BigInt(quantity) * equityHundredths) / (totalTickets * 10000n),
        }))
        .filter((holder) => holder.amountCents > 0n);

      const payoutTotalCents = holders.reduce((sum, holder) => sum + holder.amountCents, 0n);
      const payoutTotal = Number(payoutTotalCents) / 100;

      // The shares are computed against totalTickets, so they can only add up to more than the
      // offered slice of the profit if more tickets exist than the project ever issued. That
      // should be impossible now the purchase path locks the project row, but paying out of a
      // ledger that says otherwise takes real money out of the founder's wallet — a five-ticket
      // project carrying twelve tickets billed 2.4x the whole profit. Refuse and let a human
      // reconcile instead of overpaying.
      const maxPayableCents = (netCents * equityHundredths) / 10000n;
      if (payoutTotalCents > maxPayableCents) {
        ledgerMismatch = {
          ticketsIssued: project.totalTickets,
          ticketsHeld: [...ticketsByOwner.values()].reduce((sum, quantity) => sum + quantity, 0),
        };
        throw new ConflictException(
          'Ticket holdings for this project exceed its issued tickets; dividends are on hold until the ledger is reconciled',
        );
      }

      if (payoutTotalCents > 0n) {
        // Founder and every holder taken together, in one fixed order, before any of them is
        // touched: the payout is a read-modify-write on each balance, and a holder being paid
        // by two projects at once would otherwise lose one of the two credits.
        const wallets = await lockWallets(manager, [project.founderId, ...holders.map((h) => h.ownerId)]);
        const founderWallet = wallets.get(project.founderId)!;
        const founderBalance = parseFloat(founderWallet.balance);
        if (founderBalance < payoutTotal) {
          throw new BadRequestException('Insufficient wallet balance to pay dividends');
        }
        founderWallet.balance = (founderBalance - payoutTotal).toFixed(2);
        await manager.save(founderWallet);

        for (const holder of holders) {
          const amount = Number(holder.amountCents) / 100;

          const wallet = wallets.get(holder.ownerId)!;
          wallet.balance = (parseFloat(wallet.balance) + amount).toFixed(2);
          await manager.save(wallet);

          const payout = await manager.save(
            manager.create(Transaction, {
              userId: holder.ownerId,
              type: TransactionType.DIVIDEND,
              amount: amount.toFixed(2),
              quantity: holder.quantity,
              status: TransactionStatus.COMPLETED,
            }),
          );

          // Both ends, at last. The holder's side had a transaction row; the
          // founder's side was a wallet quietly dropping by the size of the whole
          // run, with nothing anywhere to say the money had been paid out.
          await this.ledger.record(manager, {
            kind: MovementKind.DIVIDEND,
            amount,
            from: userBalance(project.founderId),
            to: userBalance(holder.ownerId),
            transactionId: payout.id,
            description: `Dividend on ${holder.quantity} ticket(s)`,
          });

          await manager.save(
            manager.create(ReportPayout, {
              reportId: report.id,
              userId: holder.ownerId,
              tickets: holder.quantity,
              // Share of the company, not of the ticket pool: what the holder owns.
              sharePercent: (
                (holder.quantity / project.totalTickets) *
                parseFloat(project.equityOfferedPercent)
              ).toFixed(4),
              amount: amount.toFixed(2),
            }),
          );
        }
      }

      report.status = FinancialReportStatus.PAID;
      report.paidAt = new Date();
      report.payoutTotal = payoutTotal.toFixed(2);
      const saved = await manager.save(report);
        return {
          view: this.toReportView(saved, null),
          period: saved.period,
          projectTitle: project.title,
          paid: holders.map((holder) => ({
            ownerId: holder.ownerId,
            amount: Number(holder.amountCents) / 100,
          })),
        };
      });

    let outcome: Awaited<ReturnType<typeof run>>;
    try {
      outcome = await run();
    } catch (err) {
      // A project whose ticket ledger says more tickets exist than were ever
      // issued is a moderation problem, not the founder's: they tapped pay and
      // were refused, and nobody else would ever hear about it.
      // Re-stated rather than read straight: the compiler follows the assignment
      // no further than the closure it happens in, and reads the variable here as
      // the null it was declared with.
      const mismatch = ledgerMismatch as LedgerMismatch | null;
      if (mismatch) {
        await this.notifications.notifyAdmins(NotificationType.MOD_DIVIDEND_LEDGER_MISMATCH, {
          projectId,
          ...mismatch,
        });
      }
      throw err;
    }

    const messages: NotifyInput[] = outcome.paid.map((holder) => ({
      userId: holder.ownerId,
      type: NotificationType.DIVIDENDS_RECEIVED,
      payload: {
        projectId,
        projectTitle: outcome.projectTitle,
        period: outcome.period,
        amount: holder.amount,
      },
    }));
    await this.notifications.notifyMany(messages);
    return outcome.view;
  }
}

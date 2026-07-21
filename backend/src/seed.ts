import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { WalletsService } from './wallets/wallets.service';
import { ProjectsService } from './projects/projects.service';
import { TicketsService } from './tickets/tickets.service';
import { ProjectFinanceService } from './project-finance/project-finance.service';
import { User } from './users/entities/user.entity';
import { Project } from './projects/entities/project.entity';
import { ExpenseCategory, FinancialReportStatus, KycStatus, UserRole } from './common/enums';
import { hashPassword, isHashed, verifyPassword } from './auth/password';

const LEGACY_PASSWORD = 'password123';

async function ensureUser(
  usersRepo: Repository<User>,
  authService: AuthService,
  walletsService: WalletsService,
  opts: { username: string; password: string; fullName: string; role: UserRole; deposit?: number },
) {
  let user = await usersRepo.findOne({ where: { username: opts.username } });
  const isNew = !user;
  if (!user) {
    await authService.register({
      username: opts.username,
      // Registration is email-keyed now; demo accounts get a placeholder so they
      // can still be created by handle.
      email: `${opts.username}@demo.local`,
      password: opts.password,
      fullName: opts.fullName,
      languagePref: 'ru',
    });
    user = await usersRepo.findOneOrFail({ where: { username: opts.username } });
    console.log(`Created user ${opts.username}`);
  }
  // `!isHashed` also drags rows seeded before hashing landed over to bcrypt,
  // so a plain `npm run seed` is enough to clear the plaintext out of the DB.
  const passwordOk = (await verifyPassword(opts.password, user.passwordHash)) && isHashed(user.passwordHash);
  if (user.role !== opts.role || user.kycStatus !== KycStatus.APPROVED || !passwordOk) {
    await usersRepo.update(user.id, {
      role: opts.role,
      kycStatus: KycStatus.APPROVED,
      passwordHash: await hashPassword(opts.password),
    });
    user = await usersRepo.findOneOrFail({ where: { username: opts.username } });
  }
  if (isNew && opts.deposit) {
    await walletsService.deposit(user.id, opts.deposit);
  }
  return user;
}

// One-time upgrade path: accounts created before the switch to username-based
// login are keyed by email only — attach the requested short username to them
// (without touching their existing projects/tickets) so ensureUser() above
// finds them by username on this and every future run.
async function attachUsernameByEmail(usersRepo: Repository<User>, email: string, username: string) {
  const user = await usersRepo.findOne({ where: { email } });
  if (user && !user.username) {
    await usersRepo.update(user.id, { username });
    console.log(`Attached username "${username}" to ${email}`);
  }
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const projectsRepo = app.get<Repository<Project>>(getRepositoryToken(Project));
  const authService = app.get(AuthService);
  const walletsService = app.get(WalletsService);
  const projectsService = app.get(ProjectsService);
  const ticketsService = app.get(TicketsService);
  const financeService = app.get(ProjectFinanceService);

  await attachUsernameByEmail(usersRepo, 'admin@test.com', 'admin');
  await attachUsernameByEmail(usersRepo, 'founder@test.com', 'founder');
  await attachUsernameByEmail(usersRepo, 'investor1@test.com', 'user');

  // Backfill any other pre-existing account (other real registrations,
  // investor2, etc.) so nobody loses access after the switch to username login.
  // Done in JS rather than one SQL statement so a collision (two emails with
  // the same local part) gets disambiguated instead of violating the unique
  // constraint.
  const orphans = await usersRepo
    .createQueryBuilder('u')
    .where('u.username IS NULL AND u.email IS NOT NULL')
    .getMany();
  for (const orphan of orphans) {
    const base = orphan.email!.split('@')[0];
    let candidate = base;
    let suffix = 1;
    while (await usersRepo.findOne({ where: { username: candidate } })) {
      candidate = `${base}${++suffix}`;
    }
    await usersRepo.update(orphan.id, { username: candidate });
    console.log(`Backfilled username "${candidate}" for ${orphan.email}`);
  }

  const admin = await ensureUser(usersRepo, authService, walletsService, {
    username: 'admin',
    password: 'admin',
    fullName: 'Admin Test',
    role: UserRole.ADMIN,
  });
  await ensureUser(usersRepo, authService, walletsService, {
    username: 'moder',
    password: 'moder',
    fullName: 'Moderator Test',
    role: UserRole.ADMIN,
  });
  const founder = await ensureUser(usersRepo, authService, walletsService, {
    username: 'founder',
    password: 'founder',
    fullName: 'Grigor Karamyan',
    role: UserRole.FOUNDER,
  });
  const investor1 = await ensureUser(usersRepo, authService, walletsService, {
    username: 'user',
    password: 'user',
    fullName: 'Anna Investor',
    role: UserRole.INVESTOR,
    deposit: 5_000_000,
  });
  const investor2 = await ensureUser(usersRepo, authService, walletsService, {
    username: 'investor2',
    password: LEGACY_PASSWORD,
    fullName: 'Levon Sargsyan',
    role: UserRole.INVESTOR,
    deposit: 3_000_000,
  });

  const founderProjects = await projectsRepo.find({ where: { founderId: founder.id } });
  const hasProject = (titleEn: string) => founderProjects.some((p) => p.title?.en === titleEn);

  // 1. Active project with purchases and a resale listing
  const activeTitle = 'Coffee Roastery Yerevan';
  if (!hasProject(activeTitle)) {
    let activeProject = await projectsService.create(founder.id, {
      title: { hy: 'Սուրճի բովարան Երևան', ru: 'Кофейная обжарка Ереван', en: activeTitle },
      description: {
        hy: 'Փոքր սուրճի բովարան՝ տեղական շուկայի համար',
        ru: 'Небольшая кофейная обжарка для местного рынка',
        en: 'A small coffee roastery for the local market',
      },
      targetAmount: 5_000_000,
      totalTickets: 100,
      priceTierCount: 4,
      resaleEnabled: true,
      equityOfferedPercent: 40,
      expectedAnnualReturnPercent: 24,
      payoutStartDays: 30,
    } as any);
    activeProject = await projectsService.setRisk(
      activeProject.id,
      { riskLevel: 'medium', reason: 'Стабильный локальный спрос, умеренная конкуренция.' } as any,
      admin.id,
      admin.fullName ?? admin.username,
    );
    await projectsService.approve(
      activeProject.id,
      'Проект проверен, документы в порядке.',
      admin.id,
      admin.fullName ?? admin.username,
    );
    console.log(`Created active project "${activeTitle}"`);

    const ticket1 = await ticketsService.buyTicket(investor1.id, { projectId: activeProject.id, quantity: 5 });
    await ticketsService.buyTicket(investor2.id, { projectId: activeProject.id, quantity: 3 });
    await ticketsService.listForSale([ticket1.id], investor1.id, ticket1.quantity, 300_000);
    console.log('Created test purchases and a resale listing');
  }

  // 2. Pending review project (for moderation testing)
  const pendingTitle = 'Urban Vertical Farm';
  if (!hasProject(pendingTitle)) {
    await projectsService.create(founder.id, {
      title: { hy: 'Քաղաքային ուղղահայաց ֆերմա', ru: 'Городская вертикальная ферма', en: pendingTitle },
      description: {
        hy: 'Բանջարեղենի աճեցում քաղաքի կենտրոնում',
        ru: 'Выращивание зелени в центре города',
        en: 'Growing greens in the city center',
      },
      targetAmount: 8_000_000,
      totalTickets: 100,
      priceTierCount: 4,
      resaleEnabled: false,
      equityOfferedPercent: 25,
      expectedAnnualReturnPercent: 18,
      payoutStartDays: 45,
    } as any);
    console.log(`Created pending-review project "${pendingTitle}"`);
  }

  // 3. Rejected project (for resubmit testing)
  const rejectedTitle = 'Downtown Car Wash';
  if (!hasProject(rejectedTitle)) {
    const rejectedProject = await projectsService.create(founder.id, {
      title: { hy: 'Ավտոլվացում կենտրոնում', ru: 'Автомойка в центре', en: rejectedTitle },
      description: {
        hy: 'Ինքնասպասարկվող ավտոլվացում',
        ru: 'Автомойка самообслуживания',
        en: 'Self-service car wash',
      },
      targetAmount: 3_000_000,
      totalTickets: 100,
      priceTierCount: 4,
      resaleEnabled: false,
      equityOfferedPercent: 30,
      expectedAnnualReturnPercent: 15,
      payoutStartDays: 30,
    } as any);
    await projectsService.reject(
      rejectedProject.id,
      'Не хватает документов о разрешении на землю. Дополните и отправьте повторно.',
      admin.id,
      admin.fullName ?? admin.username,
    );
    console.log(`Created rejected project "${rejectedTitle}"`);
  }

  // 4. Finance history for the active project: a paid month, a published
  //    (still payable) month and the open current month — the full report
  //    lifecycle is visible and the "pay dividends" step stays testable.
  const activeProject = (await projectsRepo.find({ where: { founderId: founder.id } })).find(
    (p) => p.title?.en === activeTitle,
  );
  if (activeProject) {
    const period = (monthsAgo: number) => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const asFounder = [activeProject.id, founder.id, UserRole.FOUNDER] as const;

    const seedMonthEntries = async (p: string, scale: number, daysCap = 31) => {
      const entries = [
        { kind: 'income', amount: 620_000, description: 'Продажи обжаренного кофе (опт)', day: 5 },
        { kind: 'income', amount: 280_000, description: 'Розничные продажи в кофейне', day: 18 },
        { kind: 'income', amount: 150_000, description: 'Кейтеринг и мероприятия', day: 26 },
        { kind: 'expense', amount: 310_000, description: 'Закупка зелёного кофе', day: 3, category: ExpenseCategory.DAILY },
        { kind: 'expense', amount: 120_000, description: 'Аренда и коммунальные', day: 10, category: ExpenseCategory.DAILY },
        { kind: 'expense', amount: 45_000, description: 'Упаковка и этикетки', day: 15, category: ExpenseCategory.ONE_TIME },
        { kind: 'expense', amount: 60_000, description: 'Реклама в соцсетях', day: 21, category: ExpenseCategory.OTHER },
      ] as const;
      for (const entry of entries) {
        if (entry.day > daysCap) continue;
        const date = `${p}-${String(entry.day).padStart(2, '0')}`;
        const amount = Math.round(entry.amount * scale);
        if (entry.kind === 'income') {
          await financeService.addIncome(...asFounder, { amount, description: entry.description, date });
        } else {
          await financeService.addExpense(...asFounder, {
            amount,
            description: entry.description,
            date,
            category: entry.category,
          });
        }
      }
    };

    // Each step checks its own state so an interrupted earlier run gets
    // completed instead of skipped. Entries first, reports after — a
    // published report freezes its month.
    if ((await financeService.listExpenses(activeProject.id)).length === 0) {
      await seedMonthEntries(period(2), 1);
      await seedMonthEntries(period(1), 1.15);
      await seedMonthEntries(period(0), 0.6, new Date().getDate());
      console.log('Seeded finance entries for three months');
    }

    const reports = await financeService.listReports(activeProject.id, founder.id);
    let paidReport = reports.find((r) => r.period === period(2));
    if (!paidReport) {
      paidReport = await financeService.addReport(...asFounder, { period: period(2) });
    }
    if (paidReport.status !== FinancialReportStatus.PAID) {
      // Top up the founder's wallet so the seeded dividend payment succeeds
      // and there is balance left to pay last month's report from the app.
      await walletsService.deposit(founder.id, 500_000);
      await financeService.payReport(activeProject.id, paidReport.id, founder.id);
      console.log(`Paid dividends for the ${paidReport.period} report`);
    }
    if (!reports.find((r) => r.period === period(1))) {
      await financeService.addReport(...asFounder, { period: period(1) });
      console.log(`Published the ${period(1)} report (left payable)`);
    }
  }

  console.log('\nTest accounts:');
  console.log('  admin    / admin    — admin');
  console.log('  moder    / moder    — admin (moderation testing)');
  console.log('  founder  / founder  — founder (owns the seeded projects)');
  console.log('  user     / user     — investor (balance 5,000,000, owns tickets incl. one resale listing)');
  console.log('  investor2 / password123 — investor (balance 3,000,000, owns tickets)');

  await app.close();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

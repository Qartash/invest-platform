import { promises as fs } from 'fs';
import { join } from 'path';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { WalletsService } from '../wallets/wallets.service';
import { ProjectsService } from '../projects/projects.service';
import { TicketsService } from '../tickets/tickets.service';
import { ProjectFinanceService } from '../project-finance/project-finance.service';
import { ProjectWorksService } from '../project-works/project-works.service';
import { ProjectFundingService } from '../project-funding/project-funding.service';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { ExpenseCategory, KycStatus, UserRole, WorkPaymentType } from '../common/enums';
import { hashPassword } from '../auth/password';
import { invalidateAllCached } from '../common/response-cache';
import { gradientPng } from './demo-image';

/**
 * Builds one project that exercises the whole platform, and the cast of accounts around it.
 *
 * This exists because the wipe next to it leaves nothing behind, and a blank platform is
 * not testable: half the screens only have something to show once a project has investors,
 * a treasury, released stages, hired workers and a couple of months of books. Doing that by
 * hand is twenty minutes of clicking through four different roles.
 *
 * Everything is created through the real services rather than by inserting rows, so the
 * result is reachable by the same state machine the app would have walked: tickets actually
 * move money into the treasury, a stage release actually unfreezes it, and a work's escrow
 * actually comes out of what was released. A hand-written fixture drifts from those rules
 * the first time one of them changes; this cannot.
 */

// The title is the marker for "already seeded" — see `seed` below.
const PROJECT_TITLE_EN = 'Coffee Roastery Yerevan';

const DEMO_PASSWORD = 'demo1234';

interface DemoAccount {
  username: string;
  password: string;
  role: string;
}

export interface DemoSeedResult {
  projectId: string;
  accounts: DemoAccount[];
}

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Project) private readonly projectsRepository: Repository<Project>,
    private readonly authService: AuthService,
    private readonly walletsService: WalletsService,
    private readonly projectsService: ProjectsService,
    private readonly ticketsService: TicketsService,
    private readonly financeService: ProjectFinanceService,
    private readonly worksService: ProjectWorksService,
    private readonly fundingService: ProjectFundingService,
  ) {}

  async seed(adminId: string, adminName: string): Promise<DemoSeedResult> {
    // Refuses rather than building a second copy. Two demo projects with the same title
    // and the same books would make every "is this figure right?" question unanswerable.
    const existing = await this.findDemoProject();
    if (existing) {
      throw new ConflictException('The demo project already exists — wipe the data first');
    }

    const founder = await this.ensureUser('demofounder', 'Գրիգոր Կարամյան', UserRole.FOUNDER);
    // The two investors and the worker arrive through the founder's referral code, so the
    // referral tree has a shape to show instead of four unrelated roots.
    const investor1 = await this.ensureUser('demoinvestor', 'Աննա Հակոբյան', UserRole.INVESTOR, founder.referralCode);
    const investor2 = await this.ensureUser('demoinvestor2', 'Լևոն Սարգսյան', UserRole.INVESTOR, investor1.referralCode);
    const worker = await this.ensureUser('demoworker', 'Դավիթ Պետրոսյան', UserRole.INVESTOR, investor1.referralCode);

    // Enough for the ticket purchases below, plus a remainder so the wallet screens are
    // not all showing zero. The founder's is for paying dividends out of pocket.
    await this.walletsService.deposit(investor1.id, 3_000_000);
    await this.walletsService.deposit(investor2.id, 2_000_000);
    await this.walletsService.deposit(founder.id, 1_500_000);

    const project = await this.createProject(founder.id, adminId, adminName);
    await this.addTeamAndFiles(project.id, founder.id);
    await this.sellTickets(project.id, investor1.id, investor2.id);
    await this.releaseStages(project.id, founder.id, adminId);
    await this.runWorks(project.id, founder.id, worker.id, investor2.id);
    await this.seedBooks(project.id, founder.id);

    invalidateAllCached();
    this.logger.log(`Demo project seeded by admin ${adminId}: ${project.id}`);

    return {
      projectId: project.id,
      accounts: [
        { username: 'demofounder', password: DEMO_PASSWORD, role: 'founder' },
        { username: 'demoinvestor', password: DEMO_PASSWORD, role: 'investor' },
        { username: 'demoinvestor2', password: DEMO_PASSWORD, role: 'investor' },
        { username: 'demoworker', password: DEMO_PASSWORD, role: 'worker' },
      ],
    };
  }

  private async findDemoProject(): Promise<Project | null> {
    const all = await this.projectsRepository.find();
    return all.find((p) => p.title?.en === PROJECT_TITLE_EN) ?? null;
  }

  /**
   * Registers the account if it is missing, then forces the role and an approved KYC —
   * registration always produces an unverified investor, and a founder who cannot pass
   * verification cannot own a project.
   */
  private async ensureUser(
    username: string,
    fullName: string,
    role: UserRole,
    referralCode?: string | null,
  ): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { username } });
    if (existing) return existing;

    await this.authService.register({
      username,
      email: `${username}@demo.local`,
      password: DEMO_PASSWORD,
      fullName,
      languagePref: 'ru',
      referralCode: referralCode ?? undefined,
    });
    const user = await this.usersRepository.findOneOrFail({ where: { username } });
    await this.usersRepository.update(user.id, {
      role,
      kycStatus: KycStatus.APPROVED,
      // Re-hashed rather than reused, so this stays correct if registration ever stops
      // being the thing that sets the hash.
      passwordHash: await hashPassword(DEMO_PASSWORD),
    });
    return this.usersRepository.findOneOrFail({ where: { id: user.id } });
  }

  private async createProject(founderId: string, adminId: string, adminName: string): Promise<Project> {
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + 6);

    let project = await this.projectsService.create(founderId, {
      title: {
        hy: 'Սուրճի բովարան Երևան',
        ru: 'Кофейная обжарка Ереван',
        en: PROJECT_TITLE_EN,
      },
      description: {
        hy: 'Փոքր բովարան՝ շաբաթական 400 կգ հզորությամբ, տեղական սրճարանների և մանրածախի համար։ Հումքը՝ ուղիղ ներկրում Եթովպիայից և Կոլումբիայից։',
        ru: 'Небольшая обжарка мощностью 400 кг в неделю для локальных кофеен и розницы. Зерно — прямой импорт из Эфиопии и Колумбии. Уже подписаны предварительные договоры с четырьмя кофейнями в центре Еревана.',
        en: 'A small roastery doing 400 kg a week for local cafés and retail, sourcing green beans direct from Ethiopia and Colombia. Four cafés in central Yerevan have signed letters of intent.',
      },
      targetAmount: 5_000_000,
      totalTickets: 100,
      category: 'food',
      priceTierCount: 4,
      priceTierIncrementPercent: 20,
      equityOfferedPercent: 40,
      expectedAnnualReturnPercent: 24,
      payoutStartDays: 30,
      resaleEnabled: true,
      deadline: deadline.toISOString().slice(0, 10),
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      // Four stages, because the release queue and the works below both hang off them:
      // a work is paid from a stage that a moderator has actually unfrozen.
      budgetItems: [
        { title: 'Обжарочное оборудование (ростер 15 кг)', amount: 900_000 },
        { title: 'Ремонт и вентиляция помещения', amount: 300_000 },
        { title: 'Первая закупка зелёного зерна', amount: 700_000 },
        { title: 'Маркетинг и запуск продаж', amount: 400_000 },
      ],
    });

    project = await this.projectsService.setRisk(
      project.id,
      { riskLevel: 'medium', reason: 'Стабильный локальный спрос, умеренная конкуренция, понятная себестоимость.' },
      adminId,
      adminName,
    );
    return this.projectsService.approve(
      project.id,
      'Документы в порядке, помещение проверено. Проект допущен к сбору.',
      adminId,
      adminName,
    );
  }

  /** The roster, a cover image and a couple of documents — everything the project page shows. */
  private async addTeamAndFiles(projectId: string, founderId: string): Promise<void> {
    await this.projectsService.setTeamMembers(
      projectId,
      founderId,
      UserRole.FOUNDER,
      [
        { name: 'Григор Карамян', role: 'Основатель, обжарщик', bio: '8 лет в спешелти-кофе, Q Grader. До этого — шеф-обжарщик в местной сети кофеен.' },
        { name: 'Мариам Аванесян', role: 'Операции и закупки', bio: 'Отвечает за прямые контракты с фермами и логистику зелёного зерна.' },
        { name: 'Ашот Гевокян', role: 'Продажи B2B', bio: 'Ведёт переговоры с кофейнями и розничными сетями Еревана.' },
      ],
    );

    const cover = await this.writeUpload('projects', 'demo-cover.png', gradientPng(960, 540, [88, 44, 20], [201, 137, 74]));
    await this.projectsService.setCoverImage(projectId, founderId, cover.url, UserRole.FOUNDER);

    const docs: Array<{ name: string; body: string }> = [
      {
        name: 'business-plan.txt',
        body: 'ДЕМО-ДОКУМЕНТ\n\nБизнес-план «Кофейная обжарка Ереван»\n\n1. Рынок и спрос\n2. Себестоимость килограмма\n3. Каналы продаж\n4. План на 24 месяца\n\nЭто тестовый файл, созданный сидером демо-данных.\n',
      },
      {
        name: 'lease-agreement.txt',
        body: 'ДЕМО-ДОКУМЕНТ\n\nДоговор аренды помещения, 120 кв. м, ул. Пушкина.\nСрок 5 лет, с опцией продления.\n\nЭто тестовый файл, созданный сидером демо-данных.\n',
      },
    ];
    for (const doc of docs) {
      const file = await this.writeUpload('attachments', `demo-${doc.name}`, Buffer.from(doc.body, 'utf8'));
      await this.projectsService.addAttachment(
        projectId,
        founderId,
        { fileName: doc.name, fileUrl: file.url, fileSize: file.size, mimeType: 'text/plain' },
        UserRole.FOUNDER,
      );
    }
  }

  /**
   * Two investors buy 40 of the 100 tickets between them, which is what fills the treasury
   * everything downstream spends from. One of them lists part of their holding for resale,
   * so the secondary market has something on it.
   */
  private async sellTickets(projectId: string, investor1Id: string, investor2Id: string): Promise<void> {
    await this.ticketsService.buyTicket(investor1Id, { projectId, quantity: 12 });
    await this.ticketsService.buyTicket(investor2Id, { projectId, quantity: 15 });
    const second = await this.ticketsService.buyTicket(investor1Id, { projectId, quantity: 13 });
    // Priced above what they paid — a listing at a loss reads like a bug when you find it.
    await this.ticketsService.listForSale([second.id], investor1Id, 5, 60_000);
  }

  /**
   * The founder asks for two stages; the moderator approves the first and leaves the second
   * in the queue. That gives the works below money to be paid from, and leaves the release
   * screen with one real decision waiting on it.
   */
  private async releaseStages(projectId: string, founderId: string, adminId: string): Promise<void> {
    const items = await this.projectsService.listBudgetItems(projectId);
    const [equipment, renovation] = items;

    const approved = await this.fundingService.requestRelease(projectId, founderId, {
      budgetItemId: equipment.id,
      note: 'Ростер выбран, поставщик готов отгрузить на этой неделе.',
    });
    await this.fundingService.decide(approved.id, adminId, {
      approve: true,
      note: 'Счёт от поставщика проверен.',
    });

    await this.fundingService.requestRelease(projectId, founderId, {
      budgetItemId: renovation.id,
      note: 'Смета от подрядчика приложена, нужна вентиляция под ростер.',
    });
  }

  /**
   * Four works, one in each state that matters: paid and rated, mid-way through its
   * milestones, still taking applications, and stuck in a dispute for the moderator.
   */
  private async runWorks(
    projectId: string,
    founderId: string,
    workerId: string,
    otherApplicantId: string,
  ): Promise<void> {
    const asFounder = [projectId, founderId] as const;

    // 1. Done: applied for, assigned, delivered, accepted, paid and rated five stars.
    const branding = await this.worksService.createWork(...asFounder, {
      title: 'Дизайн упаковки и логотипа',
      brief: 'Логотип, два размера пакета (250 г и 1 кг), наклейки для партий. Исходники в векторе.',
      price: 200_000,
      paymentType: WorkPaymentType.CASH,
    });
    // No offeredPrice: this work does not accept counter-offers, and `apply` refuses one
    // outright rather than quietly ignoring it. Applying at the listed price is the path.
    const brandingApp = await this.worksService.apply(projectId, branding.id, workerId, {
      coverLetter: 'Делал упаковку для двух местных обжарщиков, портфолио пришлю.',
    });
    await this.worksService.selectApplicant(projectId, branding.id, brandingApp.id, founderId);
    await this.worksService.submit(projectId, branding.id, workerId);
    await this.worksService.accept(projectId, branding.id, founderId);
    await this.worksService.reviewWork(projectId, branding.id, founderId, 5, 'Сделал раньше срока, правки принял без споров.');

    // 2. In progress, split into milestones: the first is accepted and paid, the second is
    //    still pending — which is the only way to see a part-paid escrow on screen.
    const website = await this.worksService.createWork(...asFounder, {
      title: 'Сайт с онлайн-заказом',
      brief: 'Одностраничник с каталогом, корзиной и оплатой. Плюс подписка на регулярную доставку.',
      price: 300_000,
      paymentType: WorkPaymentType.EITHER,
      allowCounterOffers: true,
      ticketPremiumPercent: 10,
    });
    await this.worksService.addMilestones(projectId, website.id, founderId, [
      { title: 'Вёрстка и каталог', amount: 150_000 },
      { title: 'Корзина, оплата, подписка', amount: 150_000 },
    ]);
    const websiteApp = await this.worksService.apply(projectId, website.id, workerId, {
      coverLetter: 'Возьму часть тикетами — верю в проект.',
      offeredPrice: 300_000,
      preferredPayment: WorkPaymentType.CASH,
    });
    await this.worksService.selectApplicant(projectId, website.id, websiteApp.id, founderId);
    const milestones = await this.worksService.getMilestones(website.id);
    await this.worksService.submitMilestone(projectId, website.id, milestones[0].id, workerId);
    await this.worksService.acceptMilestone(projectId, website.id, milestones[0].id, founderId);

    // 3. Open, with two applications the founder has yet to choose between.
    const smm = await this.worksService.createWork(...asFounder, {
      title: 'SMM на месяц',
      brief: 'Instagram и Telegram: 12 постов, съёмка процесса обжарки, ответы в комментариях.',
      price: 150_000,
      paymentType: WorkPaymentType.CASH,
      allowCounterOffers: true,
    });
    await this.worksService.apply(projectId, smm.id, workerId, {
      coverLetter: 'Веду два аккаунта в еде, покажу метрики.',
      offeredPrice: 150_000,
    });
    await this.worksService.apply(projectId, smm.id, otherApplicantId, {
      coverLetter: 'Могу дешевле, но без съёмки — только монтаж из ваших материалов.',
      offeredPrice: 110_000,
    });

    // 4. Disputed, so the moderation queue has a case in it. Last, because it eats escrow
    //    and the works above must get theirs first.
    const photo = await this.worksService.createWork(...asFounder, {
      title: 'Фотосъёмка продукта',
      brief: 'Съёмка упаковки и процесса, 30 обработанных кадров.',
      price: 120_000,
      paymentType: WorkPaymentType.CASH,
    });
    const photoApp = await this.worksService.apply(projectId, photo.id, workerId, {
      coverLetter: 'Студия своя, свет есть.',
    });
    await this.worksService.selectApplicant(projectId, photo.id, photoApp.id, founderId);
    await this.worksService.submit(projectId, photo.id, workerId);
    await this.worksService.dispute(projectId, photo.id, founderId);
  }

  /**
   * Three months of books: two closed months, one of them with dividends already paid and
   * one still payable, plus the current month left open. That is the whole report lifecycle
   * on one project, which is what makes the finance screens worth opening.
   */
  private async seedBooks(projectId: string, founderId: string): Promise<void> {
    const period = (monthsAgo: number) => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const asFounder = [projectId, founderId, UserRole.FOUNDER] as const;

    const entries = [
      { kind: 'income', amount: 620_000, description: 'Оптовые продажи обжаренного зерна', day: 5 },
      { kind: 'income', amount: 280_000, description: 'Розница и самовывоз', day: 18 },
      { kind: 'income', amount: 150_000, description: 'Кейтеринг и мероприятия', day: 26 },
      { kind: 'expense', amount: 310_000, description: 'Закупка зелёного зерна', day: 3, category: ExpenseCategory.DAILY },
      { kind: 'expense', amount: 120_000, description: 'Аренда и коммунальные', day: 10, category: ExpenseCategory.DAILY },
      { kind: 'expense', amount: 45_000, description: 'Упаковка и этикетки', day: 15, category: ExpenseCategory.ONE_TIME },
      { kind: 'expense', amount: 60_000, description: 'Реклама в соцсетях', day: 21, category: ExpenseCategory.OTHER },
    ] as const;

    const seedMonth = async (p: string, scale: number, dayCap = 31) => {
      for (const entry of entries) {
        if (entry.day > dayCap) continue;
        const date = `${p}-${String(entry.day).padStart(2, '0')}`;
        const amount = Math.round(entry.amount * scale);
        if (entry.kind === 'income') {
          await this.financeService.addIncome(...asFounder, { amount, description: entry.description, date });
        } else {
          await this.financeService.addExpense(...asFounder, {
            amount,
            description: entry.description,
            date,
            category: entry.category,
          });
        }
      }
    };

    // Entries before reports: publishing a report freezes its month.
    await seedMonth(period(2), 1);
    await seedMonth(period(1), 1.15);
    await seedMonth(period(0), 0.6, new Date().getDate());

    const paid = await this.financeService.addReport(...asFounder, { period: period(2) });
    await this.financeService.payReport(projectId, paid.id, founderId);
    await this.financeService.addReport(...asFounder, { period: period(1) });
  }

  /** Writes a file where the upload endpoints put theirs, and returns the URL they would return. */
  private async writeUpload(
    subdir: string,
    fileName: string,
    contents: Buffer,
  ): Promise<{ url: string; size: number }> {
    const dir = join(process.cwd(), 'uploads', subdir);
    await fs.mkdir(dir, { recursive: true });
    // Prefixed like multer's own names so two seedings never fight over one path.
    const stored = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${fileName}`;
    await fs.writeFile(join(dir, stored), contents);
    return { url: `/uploads/${subdir}/${stored}`, size: contents.length };
  }
}

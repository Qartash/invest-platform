import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { ProjectsModule } from './projects/projects.module';
import { TicketsModule } from './tickets/tickets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { EarningsModule } from './earnings/earnings.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ProjectFinanceModule } from './project-finance/project-finance.module';
import { StatsModule } from './stats/stats.module';
import { LogsModule } from './logs/logs.module';
import { DbQueryLogger } from './logs/db-query-logger';
import { ProjectCacheInterceptor } from './common/project-cache.interceptor';
import { SystemLog } from './logs/entities/system-log.entity';
import { LogSettings } from './logs/entities/log-settings.entity';
import { User } from './users/entities/user.entity';
import { Wallet } from './wallets/entities/wallet.entity';
import { Project } from './projects/entities/project.entity';
import { ProjectReviewLog } from './projects/entities/project-review-log.entity';
import { ProjectAttachment } from './projects/entities/project-attachment.entity';
import { ProjectBudgetItem } from './projects/entities/project-budget-item.entity';
import { ProjectTeamMember } from './projects/entities/project-team-member.entity';
import { Ticket } from './tickets/entities/ticket.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { EarningsSnapshot } from './earnings/entities/earnings-snapshot.entity';
import { ProjectExpense } from './project-finance/entities/project-expense.entity';
import { ProjectIncome } from './project-finance/entities/project-income.entity';
import { ProjectFinancialReport } from './project-finance/entities/project-financial-report.entity';
import { ReportPayout } from './project-finance/entities/report-payout.entity';
import { FundReleaseRequest } from './project-funding/entities/fund-release-request.entity';
import { ProjectWork } from './project-works/entities/project-work.entity';
import { WorkApplication } from './project-works/entities/work-application.entity';
import { WorkReview } from './project-works/entities/work-review.entity';
import { WorkMilestone } from './project-works/entities/work-milestone.entity';
import { ReferralEarning } from './referrals/entities/referral-earning.entity';
import { DailyCheckin } from './activity/entities/daily-checkin.entity';
import { DailyDrawAward } from './activity/entities/daily-draw-award.entity';
import { Quest } from './quests/entities/quest.entity';
import { QuestCompletion } from './quests/entities/quest-completion.entity';
import { PartnerApplication } from './partners/entities/partner-application.entity';
import { Notification } from './notifications/entities/notification.entity';
import { MoneyMovement } from './ledger/entities/money-movement.entity';
import { PlatformAccount } from './ledger/entities/platform-account.entity';
import { LedgerModule } from './ledger/ledger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectFundingModule } from './project-funding/project-funding.module';
import { ProjectWorksModule } from './project-works/project-works.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ActivityModule } from './activity/activity.module';
import { QuestsModule } from './quests/quests.module';
import { PartnersModule } from './partners/partners.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // .env.local stays out of git and wins over .env, so real credentials never
    // sit next to the placeholder ones the repo ships.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // A hosted database (Neon) hands out a single URL and refuses plaintext
        // connections; locally we still assemble it from the discrete vars.
        const url = configService.get<string>('DATABASE_URL');
        const connection = url
          ? { url, ssl: { rejectUnauthorized: false } }
          : {
              host: configService.get<string>('DB_HOST', 'localhost'),
              port: configService.get<number>('DB_PORT', 5432),
              username: configService.get<string>('DB_USERNAME', 'postgres'),
              password: configService.get<string>('DB_PASSWORD', 'postgres'),
              database: configService.get<string>('DB_NAME', 'invest_platform'),
            };

        return {
          type: 'postgres' as const,
          ...connection,
          entities: [
            User,
            Wallet,
            Project,
            ProjectReviewLog,
            ProjectAttachment,
            ProjectBudgetItem,
            ProjectTeamMember,
            Ticket,
            Transaction,
            EarningsSnapshot,
            ProjectExpense,
            ProjectIncome,
            ProjectFinancialReport,
            ReportPayout,
            FundReleaseRequest,
            ProjectWork,
            WorkApplication,
            WorkReview,
            WorkMilestone,
            ReferralEarning,
            DailyCheckin,
            DailyDrawAward,
            Quest,
            QuestCompletion,
            PartnerApplication,
            Notification,
            MoneyMovement,
            PlatformAccount,
            SystemLog,
            LogSettings,
          ],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          logging: true,
          logger: new DbQueryLogger(),
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    WalletsModule,
    ProjectsModule,
    TicketsModule,
    TransactionsModule,
    EarningsModule,
    PortfolioModule,
    ProjectFinanceModule,
    ProjectFundingModule,
    ProjectWorksModule,
    ReferralsModule,
    ActivityModule,
    QuestsModule,
    PartnersModule,
    NotificationsModule,
    LedgerModule,
    AdminModule,
    StatsModule,
    LogsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: ProjectCacheInterceptor }],
})
export class AppModule {}

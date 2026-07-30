import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Project } from '../projects/entities/project.entity';
import { AdminService } from './admin.service';
import { DemoSeedService } from './demo-seed.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { LogsModule } from '../logs/logs.module';
import { QuestsModule } from '../quests/quests.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ProjectsModule } from '../projects/projects.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ProjectFinanceModule } from '../project-finance/project-finance.module';
import { ProjectWorksModule } from '../project-works/project-works.module';
import { ProjectFundingModule } from '../project-funding/project-funding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Wallet, Project]),
    AuthModule,
    LogsModule,
    QuestsModule,
    WalletsModule,
    ProjectsModule,
    TicketsModule,
    ProjectFinanceModule,
    ProjectWorksModule,
    ProjectFundingModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, DemoSeedService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerApplication } from './entities/partner-application.entity';
import { User } from '../users/entities/user.entity';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerApplication, User]), ReferralsModule],
  providers: [PartnersService],
  controllers: [PartnersController],
  exports: [PartnersService],
})
export class PartnersModule {}

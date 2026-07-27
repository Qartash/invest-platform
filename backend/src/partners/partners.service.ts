import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PartnerApplication } from './entities/partner-application.entity';
import { User } from '../users/entities/user.entity';
import { PartnerApplicationStatus } from '../common/enums';
import { ReferralEarningsService } from '../referrals/referral-earnings.service';
import { PARTNER_FLAT, PARTNER_PERCENT, PARTNER_PERCENT_CAP } from '../referrals/ladder';
import { ApplyPartnerDto } from './dto/apply-partner.dto';
import { ReviewPartnerDto } from './dto/review-partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(PartnerApplication)
    private readonly applicationsRepository: Repository<PartnerApplication>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly earningsService: ReferralEarningsService,
  ) {}

  // The rates a partner is offered, served from the same constants the earnings
  // are computed with, so the screen can never advertise a number the ledger
  // doesn't pay.
  static terms() {
    return {
      flat: PARTNER_FLAT,
      percent: PARTNER_PERCENT,
      percentCap: PARTNER_PERCENT_CAP,
      levels: 1,
      paidTo: 'card' as const,
    };
  }

  async apply(userId: string, dto: ApplyPartnerDto) {
    const open = await this.applicationsRepository.findOne({
      where: [
        { userId, status: PartnerApplicationStatus.PENDING },
        { userId, status: PartnerApplicationStatus.APPROVED },
      ],
    });
    if (open) throw new ConflictException('You already have an application in progress');

    return this.applicationsRepository.save(this.applicationsRepository.create({ ...dto, userId }));
  }

  // The viewer's own state: the offer's terms, their latest application, and — if
  // they are a partner — what they've earned.
  async myStatus(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const application = await this.applicationsRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const isPartner = !!user.partnerSince;
    return {
      terms: PartnersService.terms(),
      isPartner,
      partnerSince: user.partnerSince,
      application: application
        ? {
            id: application.id,
            status: application.status,
            reviewerNote: application.reviewerNote,
            createdAt: application.createdAt,
            reviewedAt: application.reviewedAt,
          }
        : null,
      earnings: isPartner ? await this.earningsService.partnerTotals(userId) : null,
    };
  }

  // ── Moderation ────────────────────────────────────────────────────────────

  async listForReview(status?: PartnerApplicationStatus) {
    const applications = await this.applicationsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
    return applications.map((a) => ({
      id: a.id,
      status: a.status,
      channelType: a.channelType,
      channelUrl: a.channelUrl,
      audienceSize: a.audienceSize,
      topic: a.topic,
      plan: a.plan,
      reviewerNote: a.reviewerNote,
      createdAt: a.createdAt,
      applicant: {
        id: a.user?.id,
        name: a.user?.fullName || a.user?.username,
        memberSince: a.user?.createdAt,
      },
    }));
  }

  // Approving is what makes someone a partner; every other outcome leaves their
  // ordinary referral standing untouched, so a rejection costs them nothing.
  async review(applicationId: string, adminId: string, dto: ReviewPartnerDto) {
    const application = await this.applicationsRepository.findOne({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('Application not found');

    application.status = dto.status;
    application.reviewerNote = dto.note ?? null;
    application.reviewedById = adminId;
    application.reviewedAt = new Date();
    await this.applicationsRepository.save(application);

    if (dto.status === PartnerApplicationStatus.APPROVED) {
      await this.usersRepository.update(application.userId, { partnerSince: new Date() });
    }
    return application;
  }

  // Withdrawing partner status: future invitees go back to the ordinary ladder,
  // and anything already earned stays owed.
  async revoke(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepository.update(userId, { partnerSince: null });
    return { userId, isPartner: false };
  }

  // What the platform owes partners right now, and the call that records a
  // transfer once it has been made.
  //
  // The ledger only knows beneficiary ids — it has no reason to. Whoever is about
  // to send money to a card needs to read a name, so the names are attached here
  // rather than leaving a screen full of uuids.
  async duePayouts() {
    const due = await this.earningsService.duePartnerPayouts();
    if (due.length === 0) return [];

    const users = await this.usersRepository.find({
      where: { id: In(due.map((row) => row.beneficiaryId)) },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName || u.username]));

    return due.map((row) => ({
      userId: row.beneficiaryId,
      // A partner who has since been deleted still shows up owed money, and that
      // is worth seeing rather than hiding behind a blank.
      name: nameById.get(row.beneficiaryId) ?? row.beneficiaryId,
      amount: row.amount,
      earningIds: row.earningIds,
    }));
  }

  settle(earningIds: string[]) {
    return this.earningsService.settlePartnerEarnings(earningIds);
  }
}

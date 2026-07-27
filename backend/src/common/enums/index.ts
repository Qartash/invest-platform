export enum UserRole {
  INVESTOR = 'investor',
  FOUNDER = 'founder',
  ADMIN = 'admin',
}

export enum KycStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  FUNDED = 'funded',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export enum TicketStatus {
  ACTIVE = 'active',
  LISTED_FOR_SALE = 'listed_for_sale',
  SOLD = 'sold',
}

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  DIVIDEND = 'dividend',
  WORK_PAYMENT = 'work_payment',
  // Referral reward credited to the recipient's invest credit, funded from the
  // admin account. Non-withdrawable — it can only buy tickets.
  REFERRAL_BONUS = 'referral_bonus',
  // Reward for a completed quest or activity streak, same invest-credit bucket
  // and same admin funding, kept a distinct type so the two read apart in history.
  QUEST_REWARD = 'quest_reward',
}

// Who is paying for a quest, which is also what decides where it is shown.
export enum QuestScope {
  PLATFORM = 'platform',
  PROJECT = 'project',
}

// How a completion is proven. `auto` is checked against the database, `client`
// is reported by the app (watching a video through), `admin` needs a moderator
// to confirm it — that last one is what keeps a bug bounty from paying itself.
export enum QuestVerification {
  AUTO = 'auto',
  CLIENT = 'client',
  ADMIN = 'admin',
}

// The two things a matured invitee earns for their chain: the flat per-level
// ladder (paid to every ancestor once the invitee qualifies), and the one-time
// 1% of the invitee's first deposit (paid only to the direct referrer).
export enum ReferralEarningType {
  LEVEL_BONUS = 'level_bonus',
  DEPOSIT_PERCENT = 'deposit_percent',
}

// Where a matured earning is paid. Ordinary referral bonuses land in invest
// credit and can only buy tickets; a partner's are real money on a card, paid
// monthly against an invoice — which is exactly why partners sign a contract and
// ordinary users don't.
export enum EarningChannel {
  INVEST = 'invest',
  CARD = 'card',
}

export enum PartnerApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

// PENDING sits in the 14-day hold; PAID has been moved from the admin account
// into the beneficiary's invest credit; CANCELLED was voided before payout
// (refund or fraud) and never reaches the wallet.
export enum ReferralEarningStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Which side of the wallet a transaction credited/debited: the withdrawable
// cash balance, or the invest-credit (tickets) balance.
export enum TransactionAccount {
  BALANCE = 'balance',
  INVEST = 'invest',
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum FinancialReportStatus {
  PUBLISHED = 'published',
  PAID = 'paid',
}

export enum ExpenseCategory {
  INVESTMENT_SPEND = 'investment_spend',
  DAILY = 'daily',
  ONE_TIME = 'one_time',
  WORK = 'work',
  OTHER = 'other',
}

export enum BudgetItemStatus {
  NOT_STARTED = 'not_started',
  AWAITING_PAYMENT = 'awaiting_payment',
  COMPLETED = 'completed',
}

export enum FundReleaseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum WorkStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum WorkPaymentType {
  CASH = 'cash',
  TICKETS = 'tickets',
  EITHER = 'either',
}

export enum WorkApplicationStatus {
  PENDING = 'pending',
  SELECTED = 'selected',
  REJECTED = 'rejected',
}

export enum MilestoneStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
}

export enum LogSource {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  ERROR = 'error',
  DATABASE = 'database',
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum ProjectReviewAction {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  DELETION_REQUESTED = 'deletion_requested',
  DELETION_APPROVED = 'deletion_approved',
  DELETION_REJECTED = 'deletion_rejected',
  DELETED = 'deleted',
  RESTORED = 'restored',
  PRIORITY_CHANGED = 'priority_changed',
  ADMIN_EDITED = 'admin_edited',
}

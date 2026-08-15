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

/**
 * What a vote or a report points at. Kept as one column plus an id rather than
 * three nullable foreign keys, because the list will keep growing (a vote on an
 * update today, on a comment tomorrow) and every addition would otherwise be a
 * schema change. The cost is that the database cannot enforce the reference —
 * the service checks the row exists before writing the vote, and a delete of the
 * target leaves its votes behind, which the counters on the target make harmless.
 */
export enum ContentTarget {
  QUESTION = 'question',
  ANSWER = 'answer',
  UPDATE = 'update',
}

/**
 * The three things a person can say about a piece of content, and the reason
 * they are one enum rather than a boolean.
 *
 * UP sits on a question and means "I want this answered too" — it is what sorts
 * the list and what tells a founder where to start. HELPFUL and NOT_ANSWER sit
 * on an answer (HELPFUL also on an update) and are deliberately separate from
 * UP: an answer that dodges the question can be popular and useless at once, and
 * without NOT_ANSWER that dodge is invisible.
 */
export enum ContentVoteKind {
  UP = 'up',
  HELPFUL = 'helpful',
  NOT_ANSWER = 'not_answer',
}

// What a moderator did with a report. PENDING is the queue.
export enum ContentReportStatus {
  PENDING = 'pending',
  HIDDEN = 'hidden',
  DISMISSED = 'dismissed',
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

/**
 * The kinds of place money can sit on this platform. Every movement in the
 * ledger names one of these on each side, which is what makes "where did this
 * come from" a question the database can answer.
 *
 * EXTERNAL is the outside world. Until a payment provider exists, a deposit is
 * money appearing and a withdrawal is money leaving, with nothing on the other
 * side — pointing both at EXTERNAL says exactly that, rather than letting the
 * sum arrive from nowhere.
 *
 * WORK_ESCROW is an account in all but name: the amount frozen for one job lives
 * on the work row itself, so a movement into it names the work rather than a
 * balance column.
 */
export enum LedgerAccount {
  EXTERNAL = 'external',
  PLATFORM = 'platform',
  USER_BALANCE = 'user_balance',
  USER_INVEST = 'user_invest',
  PROJECT_TREASURY = 'project_treasury',
  PROJECT_SPENDABLE = 'project_spendable',
  WORK_ESCROW = 'work_escrow',
}

/**
 * Why money moved. Deliberately finer-grained than TransactionType: the ledger
 * has to tell a stage release apart from a founder's withdrawal even though
 * neither of them is a transaction any user sees in their wallet history.
 */
export enum MovementKind {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TICKET_PURCHASE = 'ticket_purchase',
  TICKET_RESALE = 'ticket_resale',
  STAGE_RELEASE = 'stage_release',
  FOUNDER_WITHDRAWAL = 'founder_withdrawal',
  PROJECT_REFUND = 'project_refund',
  WORK_ESCROW_HOLD = 'work_escrow_hold',
  WORK_PAYMENT = 'work_payment',
  WORK_ESCROW_RETURN = 'work_escrow_return',
  DIVIDEND = 'dividend',
  REWARD = 'reward',
  REFERRAL_BONUS = 'referral_bonus',
  PARTNER_SETTLEMENT = 'partner_settlement',
  PLATFORM_FUNDING = 'platform_funding',
}

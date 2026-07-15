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

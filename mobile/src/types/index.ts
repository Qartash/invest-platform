export type UserRole = 'investor' | 'founder' | 'admin';
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type ProjectStatus = 'draft' | 'pending_review' | 'active' | 'funded' | 'closed' | 'rejected';
export type Gender = 'male' | 'female' | 'other';

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string;
  phone?: string | null;
  telegram?: string | null;
  birthDate?: string | null;
  role: UserRole;
  languagePref: string;
  kycStatus: KycStatus;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  gender?: Gender | null;
  bio?: string | null;
  occupation?: string | null;
  linkedin?: string | null;
  shareContactsPublicly?: boolean;
  showFullName?: boolean;
  bannedAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
}

export interface InvestorProfileProject {
  id: string;
  title: LocalizedText;
  coverImageUrl: string | null;
  status: ProjectStatus;
}

export interface InvestorProfile {
  id: string;
  role: UserRole;
  fullName?: string;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  age: number | null;
  gender: Gender | null;
  verified: boolean;
  bio: string | null;
  occupation: string | null;
  memberSince: string;
  telegram: string | null;
  linkedin: string | null;
  projects: InvestorProfileProject[];
}

export type LocalizedText = Record<string, string>;

export interface TicketPriceTier {
  tier: number;
  ticketsFrom: number;
  ticketsTo: number;
  price: number;
}

export interface TicketPricing {
  currentTicketPrice: number;
  currentTier: number;
  totalTiers: number;
  tierSize: number;
  tiers: TicketPriceTier[];
}

export interface Project {
  id: string;
  founderId: string;
  founderName?: string;
  investorCount?: number;
  title: LocalizedText;
  description: LocalizedText;
  targetAmount: string;
  collectedAmount: string;
  treasuryBalance?: string;
  spendableBalance?: string;
  ticketPrice: string;
  totalTickets: number;
  ticketsSold: number;
  priceTierCount: number;
  priceTierIncrementPercent?: string;
  equityOfferedPercent: string;
  youtubeUrl?: string | null;
  resaleEnabled: boolean;
  resaleListingsCount?: number;
  resaleTicketsCount?: number;
  worksCount?: number;
  expectedAnnualReturnPercent: string;
  payoutStartDays: number;
  status: ProjectStatus;
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  riskReason?: string | null;
  riskSetByName?: string | null;
  riskSetByUserId?: string | null;
  riskSetAt?: string | null;
  reviewComment?: string | null;
  priority: 'low' | 'medium' | 'high';
  pendingChanges?: Record<string, any> | null;
  pendingChangeReason?: string | null;
  deletionRequestedAt?: string | null;
  deletedAt?: string | null;
  coverImageUrl?: string;
  createdAt: string;
  deadline?: string | null;
  daysLeft?: number | null;
  pricing: TicketPricing;
}

export type ExpenseCategory = 'investment_spend' | 'daily' | 'one_time' | 'work' | 'other';

export interface ProjectExpense {
  id: string;
  projectId: string;
  amount: string;
  category: ExpenseCategory;
  description: string;
  date: string;
  attachmentUrl: string | null;
  deletedAt: string | null;
  deletedReason: string | null;
  createdAt: string;
}

export interface ProjectIncome {
  id: string;
  projectId: string;
  amount: string;
  description: string;
  date: string;
  deletedAt: string | null;
  deletedReason: string | null;
  createdAt: string;
}

export type FinancialReportStatus = 'published' | 'paid';

export interface ProjectFinancialReport {
  id: string;
  projectId: string;
  period: string;
  status: FinancialReportStatus;
  turnoverAmount: number;
  expensesAmount: number;
  netProfit: number;
  payoutTotal: number | null;
  publishedAt: string | null;
  paidAt: string | null;
  myDividend: number | null;
  createdAt: string;
}

export interface ReportPayoutEntry {
  id: string;
  userId: string;
  fullName: string | null;
  username: string | null;
  tickets: number;
  sharePercent: number;
  amount: number;
}

export type BudgetItemStatus = 'not_started' | 'awaiting_payment' | 'completed';

export interface ProjectBudgetItem {
  id: string;
  projectId: string;
  title: string;
  amount: string;
  status: BudgetItemStatus;
  released: boolean;
  order: number;
  createdAt: string;
}

export type FundReleaseStatus = 'pending' | 'approved' | 'rejected';

export interface FundReleaseRequest {
  id: string;
  projectId: string;
  budgetItemId: string;
  amount: string;
  status: FundReleaseStatus;
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface PendingReleaseRequest {
  id: string;
  projectId: string;
  projectTitle: LocalizedText;
  budgetItemId: string;
  stageTitle: string;
  amount: number;
  treasuryBalance: number;
  note: string | null;
  createdAt: string;
}

export type WorkStatus = 'open' | 'assigned' | 'submitted' | 'accepted' | 'disputed' | 'cancelled';
export type WorkPaymentType = 'cash' | 'tickets' | 'either';
export type WorkApplicationStatus = 'pending' | 'selected' | 'rejected';

export interface ProjectWork {
  id: string;
  projectId: string;
  budgetItemId: string | null;
  title: string;
  brief: string;
  price: number;
  paymentType: WorkPaymentType;
  allowCounterOffers: boolean;
  ticketPremiumPercent: number;
  status: WorkStatus;
  assigneeId: string | null;
  assigneePayment: WorkPaymentType | null;
  escrowAmount: number | null;
  deadline: string | null;
  applicationsCount: number;
  myApplication: MyApplication | null;
  review: WorkReview | null;
  createdAt: string;
}

export interface WorkReview {
  rating: number;
  comment: string | null;
}

export interface MyApplication {
  status: WorkApplicationStatus;
  coverLetter: string | null;
  offeredPrice: number | null;
  preferredPayment: WorkPaymentType;
  decisionReason: string | null;
}

export interface WorkApplication {
  id: string;
  applicantId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  coverLetter: string | null;
  offeredPrice: number | null;
  preferredPayment: WorkPaymentType;
  status: WorkApplicationStatus;
  decisionReason: string | null;
  createdAt: string;
}

export interface UserWorks {
  completedCount: number;
  averageRating: number | null;
  reviewsCount: number;
  items: Array<{
    id: string;
    projectId: string;
    projectTitle: LocalizedText;
    title: string;
    price: number;
    acceptedAt: string | null;
  }>;
}

export type MilestoneStatus = 'pending' | 'submitted' | 'accepted';

export interface WorkMilestone {
  id: string;
  workId: string;
  title: string;
  amount: string;
  paidAmount: string | null;
  order: number;
  status: MilestoneStatus;
}

export interface DisputedWork {
  id: string;
  projectId: string;
  projectTitle: LocalizedText;
  title: string;
  brief: string;
  escrowAmount: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface ProjectAttachment {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  createdAt: string;
}

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  name: string;
  role: string;
  bio: string | null;
  photoUrl: string | null;
  order: number;
  createdAt: string;
}

/** What the founder is composing. No `id`: the roster is saved whole, not patched. */
export interface TeamMemberInput {
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
}

/**
 * A holding in a project as it stands now, not a record of a sale. Once a ticket is
 * resold, this row reports the new owner and the secondary price they paid — money that
 * went to the previous holder, never to the project. Sum these for "who owns what", but
 * take what the project actually raised from Project.collectedAmount.
 */
export interface ProjectPurchase {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  /** Bought off another investor rather than from the project. */
  isResale?: boolean;
}

export type ProjectReviewAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'deletion_requested'
  | 'deletion_approved'
  | 'deletion_rejected'
  | 'deleted'
  | 'restored'
  | 'priority_changed';

export interface ProjectReviewLogEntry {
  id: string;
  projectId: string;
  action: ProjectReviewAction;
  comment: string | null;
  moderatorId: string | null;
  moderatorName: string | null;
  changes: Record<string, any> | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  projectId: string;
  ownerId: string;
  quantity: number;
  purchasePrice: string;
  askingPrice?: string | null;
  status: string;
  purchaseDate: string;
  project?: Project;
}

export interface TicketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  askingPrice: number;
  unitPrice: number;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: string;
  investCredit?: string;
  currency: string;
}

export interface HoldingLot {
  ticketId: string;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  returnAmount: number;
  purchaseDate: string;
}

export interface Holding {
  ticketId: string;
  ticketIds: string[];
  projectId: string;
  projectTitle: LocalizedText;
  quantity: number;
  purchasePrice: number;
  currentValue: number;
  dividendsReceived: number;
  returnAmount: number;
  returnPercent: number;
  status: string;
  askingPrice: number | null;
  resaleEnabled: boolean;
  purchaseDate: string;
  lastPurchaseDate: string;
  lotsCount: number;
  lots: HoldingLot[];
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalDividends: number;
  totalReturnAmount: number;
  totalReturnPercent: number;
  todayReturn: number;
  monthReturn: number;
}

export interface Portfolio {
  holdings: Holding[];
  summary: PortfolioSummary;
}

export type LogSource = 'frontend' | 'backend' | 'error' | 'database';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLog {
  id: string;
  source: LogSource;
  level: LogLevel;
  category: string;
  message: string;
  metadata: Record<string, any> | null;
  userId: string | null;
  createdAt: string;
}

export interface LogSettings {
  frontendClicksEnabled: boolean;
  backendRequestsEnabled: boolean;
  errorsEnabled: boolean;
  databaseQueriesEnabled: boolean;
  consoleLogsEnabled: boolean;
}

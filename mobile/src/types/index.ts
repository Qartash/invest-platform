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
  ticketPrice: string;
  totalTickets: number;
  ticketsSold: number;
  priceTierCount: number;
  priceTierIncrementPercent?: string;
  youtubeUrl?: string | null;
  resaleEnabled: boolean;
  resaleListingsCount?: number;
  resaleTicketsCount?: number;
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
  statusBeforeReview?: ProjectStatus | null;
  deletionRequestedAt?: string | null;
  deletedAt?: string | null;
  coverImageUrl?: string;
  createdAt: string;
  deadline?: string | null;
  daysLeft?: number | null;
  pricing: TicketPricing;
}

export type ExpenseCategory = 'investment_spend' | 'daily' | 'one_time' | 'other';

export interface ProjectExpense {
  id: string;
  projectId: string;
  amount: string;
  category: ExpenseCategory;
  description: string;
  date: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface ProjectIncome {
  id: string;
  projectId: string;
  amount: string;
  description: string;
  date: string;
  createdAt: string;
}

export interface ProjectFinancialReport {
  id: string;
  projectId: string;
  period: string;
  turnoverAmount: number;
  expensesAmount: number;
  netProfit: number;
  createdAt: string;
}

export type BudgetItemStatus = 'not_started' | 'awaiting_payment' | 'completed';

export interface ProjectBudgetItem {
  id: string;
  projectId: string;
  title: string;
  amount: string;
  status: BudgetItemStatus;
  order: number;
  createdAt: string;
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

export interface ProjectPurchase {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
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

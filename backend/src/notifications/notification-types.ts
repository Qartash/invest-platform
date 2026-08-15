// Every kind of notification the platform can raise.
//
// The value is a contract with the app: it is stored in the row, sent over the
// wire, and used as the i18n key (`notifications.items.<type>.title`/`.body`) the
// app renders. Renaming one silently blanks every notification already in the
// database, so add rather than rename.
//
// Deliberately a plain varchar column and not a Postgres enum: this list is long
// and will keep growing, and every addition to a real enum needs an ALTER TYPE
// that cannot run inside a transaction. Nothing here is worth that.
export enum NotificationType {
  // ── Investor ─────────────────────────────────────────────────────────────
  TICKETS_PURCHASED = 'tickets_purchased',
  /** The seller's copy: their listing was taken, in full or in part. */
  LISTING_SOLD = 'listing_sold',
  /** The buyer's copy of the same resale. */
  LISTING_BOUGHT = 'listing_bought',
  PROJECT_FUNDED = 'project_funded',
  FINANCIAL_REPORT_PUBLISHED = 'financial_report_published',
  DIVIDENDS_RECEIVED = 'dividends_received',
  PROJECT_REFUNDED = 'project_refunded',
  PROJECT_CLOSED = 'project_closed',
  PROJECT_DELETED = 'project_deleted',
  PROJECT_RISK_CHANGED = 'project_risk_changed',
  PROJECT_ADMIN_EDITED = 'project_admin_edited',

  // ── Founder ──────────────────────────────────────────────────────────────
  PROJECT_APPROVED = 'project_approved',
  PROJECT_REJECTED = 'project_rejected',
  PROJECT_DELETION_APPROVED = 'project_deletion_approved',
  PROJECT_DELETION_REJECTED = 'project_deletion_rejected',
  INVESTMENT_RECEIVED = 'investment_received',
  FUND_RELEASE_APPROVED = 'fund_release_approved',
  FUND_RELEASE_REJECTED = 'fund_release_rejected',
  WORK_APPLICATION_RECEIVED = 'work_application_received',
  WORK_SUBMITTED = 'work_submitted',
  WORK_MILESTONE_SUBMITTED = 'work_milestone_submitted',

  // ── Worker ───────────────────────────────────────────────────────────────
  WORK_APPLICATION_SELECTED = 'work_application_selected',
  WORK_APPLICATION_REJECTED = 'work_application_rejected',
  WORK_ACCEPTED = 'work_accepted',
  WORK_MILESTONE_ACCEPTED = 'work_milestone_accepted',
  WORK_CANCELLED = 'work_cancelled',
  WORK_REVIEW_RECEIVED = 'work_review_received',

  // ── Both sides of a work ─────────────────────────────────────────────────
  WORK_DISPUTE_OPENED = 'work_dispute_opened',
  WORK_DISPUTE_RESOLVED = 'work_dispute_resolved',

  // ── Wallet ───────────────────────────────────────────────────────────────
  WALLET_DEPOSITED = 'wallet_deposited',
  WALLET_WITHDRAWN = 'wallet_withdrawn',
  PROJECT_FUNDS_WITHDRAWN = 'project_funds_withdrawn',

  // ── Referrals & partners ─────────────────────────────────────────────────
  REFERRAL_JOINED = 'referral_joined',
  REFERRAL_EARNING_ACCRUED = 'referral_earning_accrued',
  REFERRAL_EARNING_PAID = 'referral_earning_paid',
  REFERRAL_EARNING_CANCELLED = 'referral_earning_cancelled',
  PARTNER_APPLICATION_APPROVED = 'partner_application_approved',
  PARTNER_APPLICATION_REJECTED = 'partner_application_rejected',
  PARTNER_APPLICATION_CHANGES_REQUESTED = 'partner_application_changes_requested',
  PARTNER_REVOKED = 'partner_revoked',
  PARTNER_PAYOUT_SETTLED = 'partner_payout_settled',

  // ── Activity & quests ────────────────────────────────────────────────────
  STREAK_REWARDED = 'streak_rewarded',
  DAILY_DRAW_WON = 'daily_draw_won',
  QUEST_REWARDED = 'quest_rewarded',
  PROJECT_QUEST_ADDED = 'project_quest_added',

  // ── Questions & updates ──────────────────────────────────────────────────
  /** A founder's copy: somebody asked about their project. */
  QUESTION_ASKED = 'question_asked',
  /** The asker's copy: the founder replied. */
  QUESTION_ANSWERED = 'question_answered',
  /** Anyone following the thread, when a follow-up lands under it. */
  QUESTION_THREAD_REPLY = 'question_thread_reply',
  /**
   * The asker's copy again, once enough other people have said they want the
   * same answer. Sent once per question — see the dedupe key at the call site.
   */
  QUESTION_TRENDING = 'question_trending',
  /** Every ticket holder, when the founder posts news. */
  PROJECT_UPDATE_POSTED = 'project_update_posted',
  /** The author, when a moderator takes their question or answer out of view. */
  CONTENT_HIDDEN = 'content_hidden',
  /**
   * The founder's nudge: questions are sitting unanswered past the promised
   * window, or the project has said nothing for a month. Both are the same
   * message with a different payload, and both are deduped so a daily job
   * cannot stack them up.
   */
  QUESTIONS_AWAITING_ANSWER = 'questions_awaiting_answer',
  PROJECT_SILENT = 'project_silent',

  // ── Account ──────────────────────────────────────────────────────────────
  ACCOUNT_BANNED = 'account_banned',
  ACCOUNT_UNBANNED = 'account_unbanned',
  ACCOUNT_DELETED = 'account_deleted',
  ACCOUNT_RESTORED = 'account_restored',
  ACCOUNT_EDITED_BY_ADMIN = 'account_edited_by_admin',

  // ── Moderator queue ──────────────────────────────────────────────────────
  MOD_PROJECT_SUBMITTED = 'mod_project_submitted',
  MOD_PROJECT_DELETION_REQUESTED = 'mod_project_deletion_requested',
  MOD_FUND_RELEASE_REQUESTED = 'mod_fund_release_requested',
  MOD_WORK_DISPUTED = 'mod_work_disputed',
  MOD_PARTNER_APPLIED = 'mod_partner_applied',
  MOD_PARTNER_PAYOUT_DUE = 'mod_partner_payout_due',
  MOD_CONTENT_REPORTED = 'mod_content_reported',
  MOD_REFERRAL_POOL_EMPTY = 'mod_referral_pool_empty',
  MOD_DIVIDEND_LEDGER_MISMATCH = 'mod_dividend_ledger_mismatch',
  // No counterpart for wiping the platform: a wipe deletes every account except
  // the administrator who asked for it, so there is nobody left to tell.
  MOD_DEMO_SEEDED = 'mod_demo_seeded',
}

/**
 * The variable parts of a notification's text, plus whatever the app needs to
 * open the thing it is about.
 *
 * Only ids and figures live here — never a rendered sentence. The app owns the
 * wording in three languages, so a text stored at send time would be frozen in
 * whichever language the sender happened to be using, and would never pick up a
 * correction. `projectTitle` is the one apparent exception: a project's title is
 * itself a translated object, and it is copied in rather than joined so a
 * notification still reads sensibly after the project is deleted.
 */
export interface NotificationPayload {
  [key: string]: unknown;
  projectId?: string;
  projectTitle?: Record<string, string> | string | null;
  workId?: string;
  workTitle?: string | null;
  amount?: number;
  quantity?: number;
  comment?: string | null;
  actorName?: string | null;
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload?: NotificationPayload | null;
  /**
   * Collapses repeats. A second notification with the same user, type and key is
   * dropped while the first one is still unread — which is what keeps an hourly
   * job from filling a moderator's list with the same warning 24 times a day.
   */
  dedupeKey?: string | null;
}

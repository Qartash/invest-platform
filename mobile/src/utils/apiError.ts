import type { TFunction } from 'i18next';

// Backend exceptions carry English prose — `throw new BadRequestException('Insufficient
// funds')` — and screens were passing that string straight into showAlert. On a Russian
// interface a withdrawal over balance read "Произошла ошибка / Insufficient funds".
//
// Of the ~100 distinct messages the backend can throw, most describe a state the user
// cannot do anything about ("Milestone not found", "Not your project") and only make
// sense to a developer. Those get one translated sentence. The ones a user can actually
// act on are listed below and translated properly; the list is deliberately short and
// hand-picked rather than exhaustive, because a machine-translated "Work has no escrow"
// helps nobody.
//
// The server's own text is still shown under __DEV__, where it is the fastest way to see
// which branch fired.

// Exact match on the backend's message string. Brittle by nature — changing the wording
// there silently drops the translation here — which is the price of not making every
// service emit an error code. The generic fallback keeps that failure quiet rather than
// broken: an unmatched message reads as a plain refusal, never as English.
const MESSAGE_KEYS: Record<string, string> = {
  'Insufficient funds': 'errors.insufficientFunds',
  'Insufficient wallet balance': 'errors.insufficientFunds',
  'Insufficient wallet balance to pay dividends': 'errors.insufficientFundsDividends',
  'Amount must be positive': 'errors.amountMustBePositive',
  'Asking price must be positive': 'errors.amountMustBePositive',
  'Quantity must be a positive integer': 'errors.invalidQuantity',
  'Invalid quantity': 'errors.invalidQuantity',
  'Not enough tickets available': 'errors.notEnoughTickets',
  'Not enough tickets to list': 'errors.notEnoughTickets',
  'Email already taken': 'errors.emailTaken',
  'Email already registered': 'errors.emailTaken',
  'Username already taken': 'errors.usernameTaken',
  'Invalid credentials': 'errors.invalidCredentials',
  'Account is banned': 'errors.accountBanned',
  'You must be verified to create a project': 'errors.verificationRequired',
  'Project is not open for investment': 'errors.projectClosedForInvestment',
  'Cannot buy your own listing': 'errors.cannotBuyOwnListing',
  'This listing is no longer for sale': 'errors.listingGone',
  'Resale is not enabled for this project': 'errors.resaleDisabled',
  'You already have an application in progress': 'errors.applicationInProgress',
  'Cannot change the pricing or the offered equity share after tickets have been sold.':
    'errors.stakeLockedAfterSale',
  'Cannot set the goal below the amount already collected.': 'errors.goalBelowCollected',
  'This project already has changes pending review. Wait for the moderator to approve or reject it first.':
    'errors.editAlreadyPending',
  'An invite code is required to register': 'errors.inviteRequired',
  'This invite code does not exist': 'errors.inviteUnknown',
  'This invite code is not active yet': 'errors.inviteNotActive',
  'Wrong wipe password': 'errors.wrongWipePassword',
  'The demo project already exists — wipe the data first': 'errors.demoAlreadySeeded',
  'ADMIN_WIPE_PASSWORD is not configured on this server': 'errors.wipeNotConfigured',
};

// Backend prose that varies at runtime, so an exact match cannot catch it.
const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/^Cannot set the ticket count below the \d+ already sold\.$/, 'errors.ticketCountBelowSold'],
];

/**
 * The human-readable message for a failed request.
 *
 * Pass the result as showAlert's second argument; the first stays t('common.error').
 * Validation failures from class-validator arrive as an array of strings rather than one,
 * which is another way English used to reach the screen.
 */
export function apiErrorMessage(err: any, t: TFunction): string {
  // The rate limiter in front of /auth answers 429, and it is the one refusal a person
  // fixes by doing nothing for a while — worth saying so rather than letting it fall
  // through to "the server refused", which invites another attempt and another block.
  // Matched on the status: the text the guard throws is its own, not one of ours below.
  if (err?.response?.status === 429) return t('errors.tooManyAttempts');

  const raw = err?.response?.data?.message;
  const message = Array.isArray(raw) ? raw[0] : raw;

  if (typeof message === 'string') {
    const key = MESSAGE_KEYS[message] ?? MESSAGE_PATTERNS.find(([re]) => re.test(message))?.[1];
    if (key) return t(key);
  }

  // No response body at all means the request never landed — a dropped connection or a
  // backend that is down. Worth saying apart from a refusal, because one is worth retrying
  // and the other is not.
  const generic = err?.response ? t('common.serverRefused') : t('common.loadFailed');

  return __DEV__ && typeof message === 'string' ? `${generic}\n\n[dev] ${message}` : generic;
}

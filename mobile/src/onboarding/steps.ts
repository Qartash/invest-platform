import { GuideArticle, Tour, TourId, TourStep } from './types';

/**
 * What each tour walks through.
 *
 * A step is a place plus a paragraph: `route` says where to stand, `target` says what to
 * point at, and the copy lives in the locale files under the step's id. Steps with neither
 * a target nor a reachable one still show — centred, with no cutout — which is what makes
 * the tour survive an empty feed or an account with no projects of its own.
 *
 * Order matters twice over: it is the order a newcomer meets the app in, and `route` changes
 * between neighbouring steps are what drive the navigation.
 */

const HOME: TourStep['route'] = { tab: 'HomeTab', screen: 'Home' };
const PROFILE: TourStep['route'] = { tab: 'ProfileTab', screen: 'Profile' };

const investorSteps: TourStep[] = [
  { id: 'home.feed', target: 'home.header', route: HOME },
  { id: 'home.tabs', target: 'home.tabs', route: HOME },
  { id: 'home.card', target: 'home.card', route: HOME },
  { id: 'home.progress', target: 'home.card', route: HOME },
  { id: 'nav.bar', target: 'nav.bar', route: HOME },

  // The project pages below are routed by the host, which substitutes the first project in
  // the cached feed. With an empty feed they degrade to centred cards on the home screen.
  { id: 'project.hero', target: 'project.hero' },
  { id: 'project.price', target: 'project.price' },
  { id: 'project.buy', target: 'project.buy' },
  { id: 'project.rounds', target: 'project.rounds' },
  { id: 'project.metrics', target: 'project.metrics' },
  { id: 'project.tabs', target: 'project.tabs' },
  { id: 'project.more', target: 'project.more' },
  { id: 'project.resale', target: 'project.resale' },

  { id: 'wallet.balance', target: 'wallet.balance', route: { tab: 'ProfileTab', screen: 'Wallet' } },
  { id: 'wallet.totals', target: 'wallet.totals', route: { tab: 'ProfileTab', screen: 'Wallet' } },
  { id: 'wallet.form', target: 'wallet.form', route: { tab: 'ProfileTab', screen: 'Wallet' } },
  { id: 'wallet.history', target: 'wallet.history', route: { tab: 'ProfileTab', screen: 'Wallet' } },

  { id: 'portfolio.summary', target: 'portfolio.summary', route: { tab: 'ProfileTab', screen: 'Portfolio' } },
  { id: 'portfolio.holding', target: 'portfolio.holding', route: { tab: 'ProfileTab', screen: 'Portfolio' } },

  { id: 'profile.identity', target: 'profile.identity', route: PROFILE },
  { id: 'profile.finance', target: 'profile.finance', route: PROFILE },
  { id: 'profile.community', target: 'profile.community', route: PROFILE },
  { id: 'profile.account', target: 'profile.account', route: PROFILE },
  { id: 'profile.appearance', target: 'profile.appearance', route: PROFILE },
  { id: 'profile.guide', target: 'profile.guide', route: PROFILE },
];

const founderSteps: TourStep[] = [
  { id: 'founder.head', target: 'founder.head', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.tabs', target: 'founder.head', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.create', target: 'founder.create', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.card', target: 'founder.card', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },

  { id: 'create.rail', target: 'create.rail', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },
  { id: 'create.basics', target: 'create.body', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },
  { id: 'create.raise', target: 'create.body', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },
  { id: 'create.equity', target: 'create.body', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },
  { id: 'create.rounds', target: 'create.body', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },
  { id: 'create.review', target: 'create.nav', route: { tab: 'ProjectsTab', screen: 'CreateProject' } },

  { id: 'founder.moderation', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.finance', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.works', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
  { id: 'founder.dividends', route: { tab: 'ProjectsTab', screen: 'MyProjects' } },
];

const referralSteps: TourStep[] = [
  { id: 'referrals.code', target: 'referrals.code', route: { tab: 'ProfileTab', screen: 'Referrals' } },
  { id: 'referrals.earned', target: 'referrals.earned', route: { tab: 'ProfileTab', screen: 'Referrals' } },
  { id: 'referrals.stats', target: 'referrals.stats', route: { tab: 'ProfileTab', screen: 'Referrals' } },
  { id: 'referrals.ladder', target: 'referrals.ladder', route: { tab: 'ProfileTab', screen: 'Referrals' } },
  { id: 'referrals.tree', route: { tab: 'ProfileTab', screen: 'ReferralTree' } },
  { id: 'quests.list', target: 'quests.list', route: { tab: 'ProfileTab', screen: 'Quests' } },
  { id: 'quests.bonus', target: 'quests.bonus', route: { tab: 'ProfileTab', screen: 'Quests' } },
  { id: 'partner.apply', target: 'partner.card', route: { tab: 'ProfileTab', screen: 'Partner' } },
];

const adminSteps: TourStep[] = [
  { id: 'admin.queue', target: 'admin.queue', route: { tab: 'ModerationTab', screen: 'ModerationList' } },
  { id: 'admin.tabs', target: 'admin.tabs', route: { tab: 'ModerationTab', screen: 'ModerationList' } },
  { id: 'admin.decision', route: { tab: 'ModerationTab', screen: 'ModerationList' } },
  { id: 'admin.reports', route: { tab: 'ProfileTab', screen: 'Profile' } },
];

export const TOURS: Record<TourId, Tour> = {
  investor: { id: 'investor', steps: investorSteps },
  founder: { id: 'founder', steps: founderSteps },
  referrals: { id: 'referrals', steps: referralSteps },
  admin: { id: 'admin', steps: adminSteps },
};

/** The welcome slides. One key each under `guide.intro.<id>`. */
export const INTRO_SLIDES = ['purpose', 'ticket', 'wallet', 'invite'] as const;

/** The reference half of onboarding — readable at any time, in any order. */
export const GUIDE_ARTICLES: GuideArticle[] = [
  { id: 'platform', icon: 'layers' },
  { id: 'invest', icon: 'chart', tour: 'investor' },
  { id: 'wallet', icon: 'wallet' },
  { id: 'portfolio', icon: 'briefcase' },
  { id: 'founder', icon: 'star', tour: 'founder' },
  { id: 'referrals', icon: 'users', tour: 'referrals' },
  { id: 'quests', icon: 'checklist' },
  { id: 'safety', icon: 'shield' },
];

/** Steps that describe one screen, for the `?` button in that screen's header. */
export function stepsForScreen(target: string): TourStep[] {
  const prefix = `${target}.`;
  return Object.values(TOURS)
    .flatMap((tour) => tour.steps)
    .filter((step) => step.id.startsWith(prefix));
}

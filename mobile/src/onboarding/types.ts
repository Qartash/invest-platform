/** The four guided tours. Each one is a branch of the app a person can be new to. */
export type TourId = 'investor' | 'founder' | 'referrals' | 'admin';

/** Which tab (and, inside it, which screen) a step wants to be looked at on. */
export interface StepRoute {
  tab: 'HomeTab' | 'ProjectsTab' | 'ProfileTab' | 'ModerationTab';
  screen?: string;
  params?: Record<string, unknown>;
}

export interface TourStep {
  /**
   * Stable identifier, and also where the copy lives: `guide.steps.<id>.title` and
   * `guide.steps.<id>.body`. Renaming one means renaming three keys in three locales,
   * so pick a name that survives the screen being redesigned.
   */
  id: string;
  /**
   * The `TourTarget` to cut out of the scrim. Omitted — or registered by a screen that
   * isn't mounted, or scrolled out of view — leaves the card centred with no cutout,
   * which is a legitimate posture for a step that talks about a whole screen.
   */
  target?: string;
  /** Where to take the user before showing this step. */
  route?: StepRoute;
}

export interface Tour {
  id: TourId;
  steps: TourStep[];
}

/** A section of the reference guide — the part of onboarding that outlives the tour. */
export interface GuideArticle {
  /** Copy lives at `guide.articles.<id>.title` and `guide.articles.<id>.body`. */
  id: string;
  icon: 'wallet' | 'briefcase' | 'chart' | 'users' | 'checklist' | 'shield' | 'star' | 'layers';
  /** Offered as "walk me through it" at the foot of the article. */
  tour?: TourId;
}

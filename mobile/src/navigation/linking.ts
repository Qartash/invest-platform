import { LinkingOptions } from '@react-navigation/native';

/**
 * URL routing for the web build.
 *
 * Without this the whole app lived at `/`: reloading on a project card dropped the user back
 * on the projects list, the browser's back button walked out of the site instead of back a
 * screen, and there was no way to link anyone to a project.
 *
 * Web only, and deliberately so. Deep links on native would need a registered URL scheme and
 * `expo-linking`, and adding a native dependency costs a new build — this fixes the browser,
 * which is where the defect is. `prefixes` is empty because on web React Navigation reads
 * `window.location` and never needs to strip a scheme.
 *
 * The shape mirrors the navigator tree exactly (tab -> stack -> screen); a path here that does
 * not correspond to a real screen name is silently ignored, so keep it in step with the
 * ParamLists in this folder.
 */
const APP_NAME = 'Invest Platform';

/**
 * Browser tab title. React Navigation's default formatter falls back to the route name, so
 * the tab (and any bookmark made from it) read "ProjectsTab". Screens that set a header title
 * reuse it; everything else gets the app name rather than an internal identifier.
 *
 * Lives here next to the routing config, but it is a NavigationContainer prop of its own —
 * not part of `linking`.
 */
export const documentTitle = {
  formatter: (options: { title?: string } | undefined) =>
    options?.title ? `${options.title} · ${APP_NAME}` : APP_NAME,
};

export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [],
  config: {
    screens: {
      // --- signed out ---
      Login: 'login',
      Register: 'register',

      // --- signed in ---
      HomeTab: {
        screens: {
          Home: '',
          ProjectDetail: 'projects/:projectId',
          ProjectFinance: 'projects/:projectId/finance',
          ProjectWorks: 'projects/:projectId/works',
        },
      },
      ProjectsTab: {
        screens: {
          MyProjects: 'my-projects',
          // projectId is optional here (the same form creates and edits), so it rides as a
          // query param rather than a path segment.
          CreateProject: 'my-projects/edit',
          ProjectFinance: 'my-projects/:projectId/finance',
          ProjectWorks: 'my-projects/:projectId/works',
        },
      },
      ModerationTab: {
        screens: {
          ModerationList: 'moderation',
          // Listed before the :projectId route so the literal segment wins the match.
          ModerationUser: 'moderation/users/:userId',
          ModerationDetail: 'moderation/:projectId',
          ModerationEdit: 'moderation/:projectId/edit',
        },
      },
      ProfileTab: {
        screens: {
          Profile: 'profile',
          EditProfile: 'profile/edit',
          Wallet: 'wallet',
          Portfolio: 'portfolio',
          Reports: 'reports',
          Referrals: 'invites',
          ReferralTree: 'invites/tree',
          ReferralEarnings: 'invites/earnings',
          Quests: 'quests',
          Partner: 'partner',
        },
      },
    },
  },
};

import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { checkIn } from '../api/activity';
import { HomeStackNavigator } from './InvestorNavigator';
import { ProjectsStackNavigator } from './FounderNavigator';
import { ProfileStackNavigator } from './ProfileNavigator';
import { lazyScreen } from './lazyScreen';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';
import { logEvent } from '../utils/logger';
import { TabBarIcon, TabIconName } from '../components/TabBarIcon';
import { BottomDock } from '../components/BottomDock';
import { SideRail } from '../components/SideRail';
import { useBreakpoint } from '../theme';

const Tab = createBottomTabNavigator();

// The whole moderation stack — the queue, a project under review, a user's file — loads only
// once an administrator opens the tab. Everyone else has the tab hidden anyway, and it is a
// large amount of code to hand to people who will never see it.
const ModerationStackNavigator = lazyScreen(() =>
  import('./ModerationNavigator').then((m) => ({ default: m.ModerationStackNavigator })),
);

function tabOptions(title: string, icon: TabIconName) {
  return {
    title,
    tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
      <TabBarIcon name={icon} color={color} size={size} focused={focused} />
    ),
  };
}

export function MainNavigator() {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  // Which bar to draw is decided here rather than inside the bar itself: `tabBarPosition`
  // is what turns the navigator's own container from a column into a row, and only the
  // navigator can set it. Splitting the decision across two files would let the rail be
  // rendered into a bottom slot, or the dock into a left one.
  const { isWide } = useBreakpoint();

  // Record a daily check-in when the authenticated app mounts. This is what keeps
  // the activity streak alive — and, at seven consecutive days, qualifies a
  // referral without a deposit. Best-effort: a failure never blocks the app.
  useEffect(() => {
    checkIn().catch(() => {});
    // Primes the unread badge for the whole session. The bell refreshes it
    // whenever its screen is focused, but the profile row only reads the count —
    // without this, signing in and going straight to the profile would show a
    // zero regardless of what is waiting.
    void useNotificationsStore.getState().refreshUnread();
  }, []);

  return (
    <Tab.Navigator
      // Both bars own their colours and selected state, so the tint/label/bar options above
      // them no longer apply — `title` survives as the accessible tab name, and as the
      // visible label once the rail has room for it.
      tabBar={(props) => (isWide ? <SideRail {...props} /> : <BottomDock {...props} />)}
      screenOptions={{ headerShown: false, tabBarPosition: isWide ? 'left' : 'bottom' }}
      screenListeners={{
        focus: (e) => logEvent('navigation', 'Tab focus', { tab: e.target?.split('-')[0] }),
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={tabOptions(t('home.title'), 'projects')} />
      <Tab.Screen
        name="ProjectsTab"
        component={ProjectsStackNavigator}
        options={tabOptions(t('founder.myProjects'), 'myProjects')}
      />
      {isAdmin && (
        <Tab.Screen
          name="ModerationTab"
          component={ModerationStackNavigator}
          options={tabOptions(t('founder.moderation'), 'moderation')}
        />
      )}
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={tabOptions(t('profile.title'), 'profile')} />
    </Tab.Navigator>
  );
}

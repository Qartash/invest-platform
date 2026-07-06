import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { HomeStackNavigator } from './InvestorNavigator';
import { ProjectsStackNavigator } from './FounderNavigator';
import { ProfileStackNavigator } from './ProfileNavigator';
import { ModerationStackNavigator } from './ModerationNavigator';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';
import { logEvent } from '../utils/logger';

const Tab = createBottomTabNavigator();

export function MainNavigator() {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
      screenListeners={{
        focus: (e) => logEvent('navigation', 'Tab focus', { tab: e.target?.split('-')[0] }),
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: t('home.title') }} />
      <Tab.Screen name="ProjectsTab" component={ProjectsStackNavigator} options={{ title: t('founder.myProjects') }} />
      {isAdmin && (
        <Tab.Screen
          name="ModerationTab"
          component={ModerationStackNavigator}
          options={{ title: t('founder.moderation') }}
        />
      )}
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ title: t('profile.title') }} />
    </Tab.Navigator>
  );
}

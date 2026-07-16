import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { HomeStackNavigator } from './InvestorNavigator';
import { ProjectsStackNavigator } from './FounderNavigator';
import { ProfileStackNavigator } from './ProfileNavigator';
import { ModerationStackNavigator } from './ModerationNavigator';
import { useAuthStore } from '../store/authStore';
import { typography, useTheme } from '../theme';
import { logEvent } from '../utils/logger';
import { TabBarIcon, TabIconName } from '../components/TabBarIcon';

const Tab = createBottomTabNavigator();

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
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: typography.eyebrow.fontSize, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
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

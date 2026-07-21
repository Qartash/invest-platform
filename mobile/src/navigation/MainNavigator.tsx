import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { HomeStackNavigator } from './InvestorNavigator';
import { ProjectsStackNavigator } from './FounderNavigator';
import { ProfileStackNavigator } from './ProfileNavigator';
import { ModerationStackNavigator } from './ModerationNavigator';
import { useAuthStore } from '../store/authStore';
import { logEvent } from '../utils/logger';
import { TabBarIcon, TabIconName } from '../components/TabBarIcon';
import { BottomDock } from '../components/BottomDock';

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

  return (
    <Tab.Navigator
      // The dock owns its own colours and selected state, so the tint/label/bar options
      // above it no longer apply — `title` survives only as the accessible tab name.
      tabBar={(props) => <BottomDock {...props} />}
      screenOptions={{ headerShown: false }}
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

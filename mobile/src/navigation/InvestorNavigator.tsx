import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../screens/investor/HomeScreen';
import { ProjectDetailScreen } from '../screens/investor/ProjectDetailScreen';
import { ProjectFinanceScreen } from '../screens/investor/ProjectFinanceScreen';
import { ProjectWorksScreen } from '../screens/investor/ProjectWorksScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

export type InvestorHomeStackParamList = {
  Home: undefined;
  // `openTab` is how a notification lands on the thing it is about — a question
  // notification that drops the reader on the overview tab loses most of them.
  ProjectDetail: {
    projectId: string;
    scrollToResale?: boolean;
    openTab?: 'about' | 'updates' | 'questions' | 'team' | 'market' | 'activity';
  };
  ProjectFinance: { projectId: string };
  ProjectWorks: { projectId: string };
  Notifications: undefined;
};

const HomeStack = createNativeStackNavigator<InvestorHomeStackParamList>();

export function HomeStackNavigator() {
  const { t } = useTranslation();
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      {/* Draws its own back button over the cover hero, so the native header would only
          add an empty bar above the image. */}
      <HomeStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <HomeStack.Screen
        name="ProjectFinance"
        component={ProjectFinanceScreen}
        options={{ headerShown: true, title: t('project.finance.title') }}
      />
      <HomeStack.Screen
        name="ProjectWorks"
        component={ProjectWorksScreen}
        options={{ headerShown: true, title: t('works.title') }}
      />
      {/* Registered in the profile stack as well, so the bell in a header and the
          row in the profile each open it inside the tab the user is already in
          rather than throwing them across the app. */}
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
    </HomeStack.Navigator>
  );
}

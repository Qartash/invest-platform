import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../screens/investor/HomeScreen';
import { ProjectDetailScreen } from '../screens/investor/ProjectDetailScreen';
import { ProjectFinanceScreen } from '../screens/investor/ProjectFinanceScreen';

export type InvestorHomeStackParamList = {
  Home: undefined;
  ProjectDetail: { projectId: string; scrollToResale?: boolean };
  ProjectFinance: { projectId: string };
};

const HomeStack = createNativeStackNavigator<InvestorHomeStackParamList>();

export function HomeStackNavigator() {
  const { t } = useTranslation();
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ headerShown: true, title: '' }} />
      <HomeStack.Screen
        name="ProjectFinance"
        component={ProjectFinanceScreen}
        options={{ headerShown: true, title: t('project.finance.title') }}
      />
    </HomeStack.Navigator>
  );
}

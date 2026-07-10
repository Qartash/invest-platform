import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ModerationScreen } from '../screens/admin/ModerationScreen';
import { ModerationDetailScreen } from '../screens/admin/ModerationDetailScreen';

export type ModerationStackParamList = {
  ModerationList: undefined;
  ModerationDetail: { projectId: string };
};

const ModerationStack = createNativeStackNavigator<ModerationStackParamList>();

export function ModerationStackNavigator() {
  const { t } = useTranslation();
  return (
    <ModerationStack.Navigator screenOptions={{ headerShown: false }}>
      <ModerationStack.Screen name="ModerationList" component={ModerationScreen} />
      <ModerationStack.Screen
        name="ModerationDetail"
        component={ModerationDetailScreen}
        options={{ headerShown: true, title: t('founder.moderation') }}
      />
    </ModerationStack.Navigator>
  );
}

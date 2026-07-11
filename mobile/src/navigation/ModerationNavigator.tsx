import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ModerationScreen } from '../screens/admin/ModerationScreen';
import { ModerationDetailScreen } from '../screens/admin/ModerationDetailScreen';
import { ModerationUserScreen } from '../screens/admin/ModerationUserScreen';
import { CreateProjectScreen } from '../screens/founder/CreateProjectScreen';

export type ModerationStackParamList = {
  ModerationList: undefined;
  ModerationDetail: { projectId: string };
  ModerationEdit: { projectId: string; adminEdit: true };
  ModerationUser: { userId: string };
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
      <ModerationStack.Screen
        name="ModerationEdit"
        // The founder's create/edit form reused in admin mode (route param
        // adminEdit) — it saves through the admin endpoint and skips the
        // pending-changes flow. Cast: the screen is typed for the founder stack.
        component={CreateProjectScreen as unknown as React.ComponentType<any>}
        options={{ headerShown: true, title: t('founder.editProject') }}
      />
      <ModerationStack.Screen
        name="ModerationUser"
        component={ModerationUserScreen}
        options={{ headerShown: true, title: t('moderation.users.title') }}
      />
    </ModerationStack.Navigator>
  );
}

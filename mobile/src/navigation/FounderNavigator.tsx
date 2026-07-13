import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MyProjectsScreen } from '../screens/founder/MyProjectsScreen';
import { CreateProjectScreen } from '../screens/founder/CreateProjectScreen';
import { ProjectFinanceScreen } from '../screens/founder/ProjectFinanceScreen';
import { ProjectWorksScreen } from '../screens/founder/ProjectWorksScreen';

export type FounderStackParamList = {
  MyProjects: undefined;
  // adminEdit is set when the same form is mounted in the moderation stack —
  // saving then goes through the admin endpoint instead of pending changes.
  CreateProject: { projectId?: string; adminEdit?: boolean } | undefined;
  ProjectFinance: { projectId: string };
  ProjectWorks: { projectId: string };
};

const ProjectsStack = createNativeStackNavigator<FounderStackParamList>();

export function ProjectsStackNavigator() {
  const { t } = useTranslation();
  return (
    <ProjectsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProjectsStack.Screen name="MyProjects" component={MyProjectsScreen} />
      <ProjectsStack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.projectId ? t('founder.editProject') : t('founder.createProject'),
        })}
      />
      <ProjectsStack.Screen
        name="ProjectFinance"
        component={ProjectFinanceScreen}
        options={{ headerShown: true, title: t('project.finance.title') }}
      />
      <ProjectsStack.Screen
        name="ProjectWorks"
        component={ProjectWorksScreen}
        options={{ headerShown: true, title: t('works.title') }}
      />
    </ProjectsStack.Navigator>
  );
}

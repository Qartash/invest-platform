import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MyProjectsScreen } from '../screens/founder/MyProjectsScreen';
import { CreateProjectScreen } from '../screens/founder/CreateProjectScreen';
import { ProjectFinanceScreen } from '../screens/founder/ProjectFinanceScreen';

export type FounderStackParamList = {
  MyProjects: undefined;
  CreateProject: { projectId?: string } | undefined;
  ProjectFinance: { projectId: string };
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
    </ProjectsStack.Navigator>
  );
}

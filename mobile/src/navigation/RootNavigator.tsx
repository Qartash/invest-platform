import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);

  return <NavigationContainer>{!user ? <AuthNavigator /> : <MainNavigator />}</NavigationContainer>;
}

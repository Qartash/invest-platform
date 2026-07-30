import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { useReferralStore } from '../store/referralStore';
import { useTheme } from '../theme';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// The app opens straight on the login form — a separate welcome screen only put a
// tap between the user and the thing they came to do. Registration is one level
// deeper, reached from the link at the bottom of the form.
//
// Unless the visitor arrived on an invite, in which case sign-up is the screen they came
// for and the login form is the wrong one to show: someone following a shared link almost
// certainly has no account, and "Welcome back — sign in to keep investing" over a form that
// never mentions the invite is how an invite gets abandoned. Their code is prefilled there.
export function AuthNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pendingCode = useReferralStore((s) => s.pendingCode);

  return (
    <Stack.Navigator
      // Read once, when the stack mounts: this decides where the visitor lands, and a code
      // arriving later must not yank the screen out from under someone mid-typing.
      initialRouteName={pendingCode ? 'Register' : 'Login'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: t('auth.login'),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

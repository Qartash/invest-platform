import React from 'react';
import { HeaderBackButton } from '@react-navigation/elements';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { WalletScreen } from '../screens/investor/WalletScreen';
import { PortfolioScreen } from '../screens/investor/PortfolioScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { useAuthStore } from '../store/authStore';

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Wallet: undefined;
  Portfolio: undefined;
  Reports: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Wallet/Portfolio can also be reached by jumping in from a different tab (e.g.
// "insufficient funds" while buying a ticket). When that happens before the
// Profile tab's own stack has ever mounted, there's no "Profile" screen behind
// this one to go back to — the native back button/gesture has nothing to do.
// Always navigating to the sibling "Profile" route (rather than relying on
// history) guarantees a way out no matter how this screen was reached.
function BackToProfileButton({ navigation }: { navigation: NativeStackNavigationProp<ProfileStackParamList, any> }) {
  return <HeaderBackButton displayMode="minimal" onPress={() => navigation.navigate('Profile')} />;
}

export function ProfileStackNavigator() {
  const { t } = useTranslation();
  // Reports is the platform-wide moderation dashboard — turnover across every account and a
  // by-name feed of everyone's deposits. Registering it only for admins keeps /reports from
  // being reachable by typing the URL now that the web build has real routes; the API
  // answers non-admins with 403 either way, so this is about not showing a broken screen.
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: true, title: t('profile.editProfile') }}
      />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: t('wallet.title'),
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: t('portfolio.title'),
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
      {isAdmin && (
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: t('reports.title'),
            headerLeft: () => <BackToProfileButton navigation={navigation} />,
          })}
        />
      )}
    </Stack.Navigator>
  );
}
